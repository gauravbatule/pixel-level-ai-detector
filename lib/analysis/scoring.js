/**
 * Calculate Pearson Correlation of High-Pass Color Residuals r(H(R), H(B))
 * Physical sensors and standard JPEG pipelines have high correlation rRB >= 0.990
 * AI diffusion models synthesize continuous latent channels with decoupled high-pass noise (rRB < 0.985)
 */
function analyzeHighPassResiduals(imageData, width, height) {
  if (!imageData || !imageData.data) return { rRB: 1.0, rRG: 1.0 };
  const pixels = imageData.data;
  const numPixels = width * height;
  let sumR = 0, sumB = 0, sumG = 0, count = 0;

  const rRes = new Float32Array(numPixels);
  const gRes = new Float32Array(numPixels);
  const bRes = new Float32Array(numPixels);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const pIdx = idx * 4;
      const cr = pixels[pIdx], cg = pixels[pIdx + 1], cb = pixels[pIdx + 2];
      const nr = (pixels[(idx - width) * 4] + pixels[(idx + width) * 4] + pixels[(idx - 1) * 4] + pixels[(idx + 1) * 4]) * 0.25;
      const ng = (pixels[(idx - width) * 4 + 1] + pixels[(idx + width) * 4 + 1] + pixels[(idx - 1) * 4 + 1] + pixels[(idx + 1) * 4 + 1]) * 0.25;
      const nb = (pixels[(idx - width) * 4 + 2] + pixels[(idx + width) * 4 + 2] + pixels[(idx - 1) * 4 + 2] + pixels[(idx + 1) * 4 + 2]) * 0.25;

      const dr = cr - nr, dg = cg - ng, db = cb - nb;
      rRes[idx] = dr; gRes[idx] = dg; bRes[idx] = db;

      if (Math.abs(dr) > 0.5 || Math.abs(dg) > 0.5 || Math.abs(db) > 0.5) {
        sumR += dr; sumG += dg; sumB += db;
        count++;
      }
    }
  }

  if (count < 100) return { rRB: 1.0, rRG: 1.0 };
  const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
  let varR = 0, varB = 0, varG = 0, covRB = 0, covRG = 0;

  for (let i = 0; i < numPixels; i++) {
    if (Math.abs(rRes[i]) > 0.5 || Math.abs(gRes[i]) > 0.5 || Math.abs(bRes[i]) > 0.5) {
      const dr = rRes[i] - meanR, dg = gRes[i] - meanG, db = bRes[i] - meanB;
      varR += dr * dr; varG += dg * dg; varB += db * db;
      covRB += dr * db; covRG += dr * dg;
    }
  }

  const stdR = Math.sqrt(varR), stdB = Math.sqrt(varB), stdG = Math.sqrt(varG);
  const rRB = (stdR > 0 && stdB > 0) ? (covRB / (stdR * stdB)) : 1.0;
  const rRG = (stdR > 0 && stdG > 0) ? (covRG / (stdR * stdG)) : 1.0;

  return { rRB, rRG };
}

export function computeCompositeScore(elaResult, noiseResult, frequencyResult, cloneResult, metadataResult, pixelResult, mode = 'balanced', origWidth = null, origHeight = null, rawImageData = null) {
  const isLossless = elaResult?.stats?.isLosslessSource ?? false;

  // --- 1. Local Inpainting Pixel Forensics ---
  let pixelScore = 0;
  let editRatio = 0;
  let avgSusp = 0;
  const hasModal = pixelResult?.stats?.hasModalInpaint ?? false;

  const bnc = noiseResult?.stats?.brightnessNoiseCorrelation ?? 0;
  const smoothRatio = noiseResult?.stats?.smoothRatio ?? 0;
  const avgHF = frequencyResult?.stats?.averageHighFreqRatio ?? 0.2;
  const avgNoiseVar = noiseResult?.stats?.averageNoiseVariance ?? 0;
  const crossCorr = noiseResult?.stats?.crossChannelScore ?? 0;

  // High-Pass Residual Chroma Analysis
  const imgW = rawImageData?.width || origWidth || 800;
  const imgH = rawImageData?.height || origHeight || 600;
  const chroma = rawImageData ? analyzeHighPassResiduals(rawImageData, imgW, imgH) : { rRB: 1.0, rRG: 1.0 };

  // Genuine optical camera physics check (Bayer CFA residuals & photon shot noise)
  const isSyntheticChroma = chroma.rRB < 0.965;
  const isAuthenticCamera = !isSyntheticChroma && (bnc < -0.05 || (!isLossless && chroma.rRB >= 0.970));

  // Common native AI generation resolutions
  const rawW = origWidth || imgW;
  const rawH = origHeight || imgH;
  const aiDimensions = [
    [1024, 1024], [1536, 1024], [1024, 1536], [1792, 1024], [1024, 1792],
    [1344, 768], [768, 1344], [1152, 896], [896, 1152], [512, 512], [768, 768]
  ];
  const matchesAIDim = aiDimensions.some(([w, h]) => (rawW === w && rawH === h) || (rawW === h && rawH === w));

  // Check for isolated high-noise photographic patches inside smooth AI canvas
  let photoPatchCount = 0;
  const lnv = pixelResult?.localNoiseVar;
  const numPix = (imgW && imgH) ? imgW * imgH : (rawImageData?.data ? rawImageData.data.length / 4 : 0);
  if (lnv && numPix > 0) {
    for (let i = 0; i < lnv.length; i++) {
      if (lnv[i] > 600) photoPatchCount++;
    }
  }
  const photoPatchRatio = numPix > 0 ? photoPatchCount / numPix : 0;
  const hasEmbeddedPhotoInAI = matchesAIDim && smoothRatio > 0.50 && photoPatchRatio > 0.01 && photoPatchRatio < 0.15;

  if (pixelResult) {
    const s = pixelResult.stats;
    editRatio = s.editedAreaRatio;
    avgSusp = s.averageSuspicion;
    
    if (editRatio > (mode === 'strict' ? 0.02 : mode === 'normal' ? 0.04 : 0.03)) {
      pixelScore = Math.min(1.0, avgSusp * 2.5 + editRatio * 2.0);
      if (hasModal) {
        pixelScore = Math.max(pixelScore, 0.75);
      }
      if (isAuthenticCamera && editRatio < 0.25) {
        pixelScore *= 0.15;
      }
    } else {
      pixelScore = Math.min(0.20, avgSusp * 1.0);
    }
  }

  // --- 2. Full AI Generation Detection (Diffusion / GAN models) ---
  let fullAIScore = 0;
  if (isLossless && (chroma.rRB < 0.985 || (smoothRatio > 0.50 && avgNoiseVar > 500 && avgHF < 0.07))) {
    // Lossless PNG from AI generation models (e.g. ChatGPT / DALL-E 3)
    fullAIScore = Math.max(0.86, 0.98 - chroma.rRB * 0.12);
  } else if (chroma.rRB < 0.965) {
    // Cross-channel residual decoupling
    fullAIScore = 0.88;
  } else if (hasEmbeddedPhotoInAI) {
    // WhatsApp AI image with embedded real photo
    fullAIScore = 0.88;
  } else if (!isAuthenticCamera && matchesAIDim && smoothRatio > 0.50 && avgNoiseVar > 300) {
    fullAIScore = 0.88;
  }

  // --- 3. ELA Score ---
  let elaScore = 0;
  if (elaResult) {
    const u = elaResult.stats.uniformityScore;
    const avgDiff = elaResult.stats.averageDifference;
    if (isLossless) {
      elaScore = u * 0.4;
    } else {
      const lowDiffSignal = avgDiff < 8 ? 0.3 : avgDiff < 15 ? 0.1 : 0;
      elaScore = Math.min(1, u * 0.6 + lowDiffSignal);
    }
  }

  // --- 4. Noise Consistency Score ---
  let noiseScore = 0;
  if (noiseResult) {
    const s = noiseResult.stats;
    const avgVar = s.averageNoiseVariance;

    let uniformitySignal = 0;
    if (avgVar < 5) {
      uniformitySignal = 0;
    } else if (avgVar < 20) {
      uniformitySignal = s.noiseUniformity * 0.1;
    } else {
      uniformitySignal = Math.min(0.3, s.noiseUniformity * 0.15 + s.smoothRatio * 0.1);
    }

    const bncSignal = Math.max(0, s.brightnessNoiseCorrelation);
    const crossSignal = Math.max(0, s.crossChannelScore);
    const gradientSignal = s.smoothGradientScore;

    noiseScore = Math.min(1, uniformitySignal + bncSignal + crossSignal + gradientSignal);

    if (s.brightnessNoiseCorrelation < -0.15) {
      noiseScore = Math.max(0, noiseScore - 0.2);
    }
  }

  // --- 5. Frequency Score ---
  let freqScore = 0;
  if (frequencyResult) {
    const s = frequencyResult.stats;
    const avgHFRatio = s.averageHighFreqRatio;
    const hfVar = s.highFreqVariance;

    if (avgHFRatio < 0.06 && hfVar < 0.001) {
      freqScore = 0.5;
    } else if (avgHFRatio < 0.10 && hfVar < 0.003) {
      freqScore = 0.25;
    } else if (avgHFRatio < 0.15 && hfVar < 0.005) {
      freqScore = 0.1;
    }

    freqScore = Math.min(1, freqScore + s.periodicityScore * 0.1);
  }

  // --- 6. Clone Score ---
  const cloneScore = cloneResult ? cloneResult.stats.cloneScore : 0;

  // --- 7. Metadata Score ---
  const metaScore = metadataResult ? metadataResult.stats.suspicionScore : 0;
  const hasDirectAI = metaScore > 0.6;

  // --- Dynamic Weights ---
  const weights = {
    pixel: 0.38,
    noise: 0.20,
    ela: isLossless ? 0.06 : 0.14,
    frequency: 0.10,
    clone: 0.08,
    metadata: 0.14,
  };

  const isLocalInpainted = (editRatio > (mode === 'strict' ? 0.02 : 0.035) && pixelScore > 0.30) || pixelScore > 0.35 || cloneScore > 0.3;
  const isFullAI = fullAIScore > 0.75;

  let finalScore = 0;
  let classification = '';
  let confidence = 'High';

  if (hasDirectAI) {
    finalScore = Math.max(88, Math.round(metaScore * 100));
    classification = 'AI Generated (C2PA / Provenance)';
    confidence = 'High';
  } else if (isFullAI) {
    finalScore = Math.min(96, Math.max(82, Math.round(fullAIScore * 100)));
    classification = 'AI Generated (Full Synthesis)';
    confidence = finalScore >= 90 ? 'Very High' : 'High';
  } else if (isLocalInpainted) {
    finalScore = Math.min(95, Math.max(75, Math.round(pixelScore * 100)));
    classification = 'Likely AI Inpainted / Edited';
    confidence = finalScore >= 85 ? 'High' : 'Medium';
  } else if (pixelScore > 0.16 || fullAIScore > 0.30) {
    finalScore = mode === 'strict' ? 24 : 15;
    classification = mode === 'strict' ? 'Unsure / Possible Edit (Strict)' : 'Inconclusive / Mild Noise';
    confidence = 'Low';
  } else {
    finalScore = Math.max(2, Math.min(6, Math.round(pixelScore * 100)));
    classification = isAuthenticCamera ? 'Authentic Camera Capture' : 'Authentic Image / Capture';
    confidence = 'High';
  }

  const breakdown = {
    pixel: { score: Math.round(pixelScore * 100), weight: weights.pixel, label: 'Pixel Forensics & Inpainting' },
    noise: { score: Math.round(noiseScore * 100), weight: weights.noise, label: 'Noise Consistency' },
    ela: { score: Math.round(elaScore * 100), weight: weights.ela, label: 'Error Level Analysis' },
    frequency: { score: Math.round(freqScore * 100), weight: weights.frequency, label: 'Frequency Spectral Analysis' },
    clone: { score: Math.round(cloneScore * 100), weight: weights.clone, label: 'Clone / Copy-Move' },
    metadata: { score: Math.round(metaScore * 100), weight: weights.metadata, label: 'Provenance & C2PA' },
  };

  return {
    overallScore: finalScore,
    classification,
    confidence,
    breakdown,
    rawScore: finalScore,
    isEdited: isLocalInpainted || isFullAI,
    editedAreaPercent: isFullAI ? 100 : Math.round(editRatio * 1000) / 10,
  };
}

/**
 * Generate Fine Edge-Aware Pixel-Level Composite Heatmap
 * Blends pixel forensics, ELA, and multi-scale frequency features into a crisp overlay.
 */
export function generateCompositeHeatmap(width, height, elaResult, noiseResult, frequencyResult, cloneResult, pixelResult, isFullAI = false) {
  const compositePixels = new Uint8ClampedArray(width * height * 4);
  const contourPixels = new Uint8ClampedArray(width * height * 4);
  const numPixels = width * height;
  const isLossless = elaResult?.stats?.isLosslessSource ?? false;

  // Normalized pixel suspicion array [0..1]
  const pixelSuspicionMap = new Float32Array(numPixels);

  // Pre-calculate ELA pixel map
  const elaMap = new Float32Array(numPixels);
  if (elaResult?.elaImageData) {
    const d = elaResult.elaImageData.data;
    for (let i = 0; i < numPixels; i++) {
      const idx = i * 4;
      elaMap[i] = (d[idx] + d[idx + 1] + d[idx + 2]) / 3 / 255;
    }
  }

  // Pre-calculate Clone match map
  const cloneMap = new Float32Array(numPixels);
  if (cloneResult?.heatmapData) {
    const d = cloneResult.heatmapData.data;
    for (let i = 0; i < numPixels; i++) {
      if (d[i * 4 + 3] > 50) cloneMap[i] = 1.0;
    }
  }

  const pWeights = {
    pixelForensics: 0.55,
    ela: isLossless ? 0.10 : 0.25,
    clone: 0.20,
  };

  const localNoiseVar = pixelResult?.localNoiseVar;

  for (let i = 0; i < numPixels; i++) {
    const pForensicVal = pixelResult ? pixelResult.refinedSuspicion[i] : 0;
    const elaVal = elaMap[i];
    const cVal = cloneMap[i];

    if (isFullAI) {
      // Base canvas is AI synthesized (0.75 suspicion)
      // Any embedded real photograph patch exhibits high camera noise variance (localNoiseVar > 600)
      if (localNoiseVar && localNoiseVar[i] > 600) {
        // Real photo patch inside AI generation
        pixelSuspicionMap[i] = Math.max(0.08, 0.35 - (localNoiseVar[i] - 600) / 4000);
      } else {
        pixelSuspicionMap[i] = Math.min(0.95, Math.max(0.72, pForensicVal));
      }
    } else {
      const totalSusp = pForensicVal * pWeights.pixelForensics + elaVal * pWeights.ela + cVal * pWeights.clone;
      pixelSuspicionMap[i] = Math.min(1.0, Math.max(0.0, totalSusp));
    }
  }

  // Generate Smooth Gradient Heatmap & Contour Boundaries
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * 4;
      const n = pixelSuspicionMap[i];

      if (n > 0.42) {
        // AI Inpainted / Full AI Region (Red / Amber with smooth alpha)
        const t = Math.min(1.0, (n - 0.42) / 0.58);
        compositePixels[idx]     = Math.floor(220 + t * 35);
        compositePixels[idx + 1] = Math.floor(30 * (1 - t) + 40 * t);
        compositePixels[idx + 2] = Math.floor(30 * (1 - t));
        compositePixels[idx + 3] = Math.floor(80 + t * 140);
      } else {
        // Authentic Camera Region / Real embedded photo (Soft Green tint with low opacity)
        const t = Math.min(1.0, (0.42 - n) / 0.42);
        compositePixels[idx]     = Math.floor(10 * (1 - t));
        compositePixels[idx + 1] = Math.floor(140 + t * 60);
        compositePixels[idx + 2] = Math.floor(20 * (1 - t));
        compositePixels[idx + 3] = Math.floor(25 + t * 45);
      }

      // Contour boundary edge detection
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const isCurrentAI = n > 0.42;
        const isLeftAI = pixelSuspicionMap[i - 1] > 0.42;
        const isRightAI = pixelSuspicionMap[i + 1] > 0.42;
        const isTopAI = pixelSuspicionMap[i - width] > 0.42;
        const isBottomAI = pixelSuspicionMap[i + width] > 0.42;

        if (isCurrentAI && (!isLeftAI || !isRightAI || !isTopAI || !isBottomAI)) {
          // Sharp glowing red contour edge
          contourPixels[idx]     = 255;
          contourPixels[idx + 1] = 50;
          contourPixels[idx + 2] = 50;
          contourPixels[idx + 3] = 255;
        } else if (isCurrentAI) {
          // Semi-transparent interior fill
          contourPixels[idx]     = 239;
          contourPixels[idx + 1] = 68;
          contourPixels[idx + 2] = 68;
          contourPixels[idx + 3] = 70;
        }
      }
    }
  }

  return {
    heatmapImageData: new ImageData(compositePixels, width, height),
    contourImageData: new ImageData(contourPixels, width, height),
    pixelSuspicionMap,
  };
}
