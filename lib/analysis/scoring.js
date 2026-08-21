/**
 * Composite Forensic Scoring & Pixel-Level Heatmap Engine
 *
 * Integrates:
 * 1. Multi-scale pixel-level forensic residuals & edge-guided boundary detection
 * 2. Noise consistency & Brightness-Noise Correlation (BNC)
 * 3. Error Level Analysis (ELA)
 * 4. Frequency domain DCT spectral analysis
 * 5. Clone / Copy-Move detection
 * 6. Metadata & C2PA provenance
 */

export function computeCompositeScore(elaResult, noiseResult, frequencyResult, cloneResult, metadataResult, pixelResult, mode = 'balanced') {
  const isLossless = elaResult?.stats?.isLosslessSource ?? false;

  // --- 1. Pixel Forensics Score ---
  let pixelScore = 0;
  let editRatio = 0;
  let avgSusp = 0;
  if (pixelResult) {
    const s = pixelResult.stats;
    editRatio = s.editedAreaRatio;
    avgSusp = s.averageSuspicion;
    
    if (editRatio > (mode === 'strict' ? 0.02 : mode === 'normal' ? 0.04 : 0.03)) {
      pixelScore = Math.min(1.0, avgSusp * 2.5 + editRatio * 2.0);
    } else {
      pixelScore = Math.min(0.20, avgSusp * 1.0);
    }
  }

  // --- 2. ELA Score ---
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

  // --- 3. Noise Consistency Score ---
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

  // --- 4. Frequency Score ---
  let freqScore = 0;
  if (frequencyResult) {
    const s = frequencyResult.stats;
    const avgHF = s.averageHighFreqRatio;
    const hfVar = s.highFreqVariance;

    if (avgHF < 0.06 && hfVar < 0.001) {
      freqScore = 0.5;
    } else if (avgHF < 0.10 && hfVar < 0.003) {
      freqScore = 0.25;
    } else if (avgHF < 0.15 && hfVar < 0.005) {
      freqScore = 0.1;
    }

    freqScore = Math.min(1, freqScore + s.periodicityScore * 0.1);
  }

  // --- 5. Clone Score ---
  const cloneScore = cloneResult ? cloneResult.stats.cloneScore : 0;

  // --- 6. Metadata Score ---
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

  const isEdited = (editRatio > (mode === 'strict' ? 0.02 : 0.03)) || pixelScore > 0.35 || cloneScore > 0.3;

  let finalScore = 0;
  let classification = '';
  let confidence = 'High';

  if (hasDirectAI) {
    finalScore = Math.max(88, Math.round(metaScore * 100));
    classification = 'AI Generated (C2PA / Provenance)';
    confidence = 'High';
  } else if (isEdited) {
    finalScore = Math.min(95, Math.max(74, Math.round(pixelScore * 100)));
    classification = 'Likely AI Inpainted / Edited';
    confidence = finalScore >= 85 ? 'High' : 'Medium';
  } else if (pixelScore > 0.16) {
    finalScore = mode === 'strict' ? 24 : 15;
    classification = mode === 'strict' ? 'Unsure / Possible Edit (Strict)' : 'Inconclusive / Mild Noise';
    confidence = 'Low';
  } else {
    finalScore = Math.max(2, Math.min(6, Math.round(pixelScore * 100)));
    classification = 'Authentic Image / Capture';
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
    isEdited,
    editedAreaPercent: Math.round(editRatio * 1000) / 10,
  };
}

/**
 * Generate Fine Edge-Aware Pixel-Level Composite Heatmap
 * Blends pixel forensics, ELA, and multi-scale frequency features into a crisp overlay.
 */
export function generateCompositeHeatmap(width, height, elaResult, noiseResult, frequencyResult, cloneResult, pixelResult) {
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

  for (let i = 0; i < numPixels; i++) {
    const pForensicVal = pixelResult ? pixelResult.refinedSuspicion[i] : 0;
    const elaVal = elaMap[i];
    const cVal = cloneMap[i];

    const totalSusp = pForensicVal * pWeights.pixelForensics + elaVal * pWeights.ela + cVal * pWeights.clone;
    pixelSuspicionMap[i] = Math.min(1.0, Math.max(0.0, totalSusp));
  }

  // Generate Smooth Gradient Heatmap & Contour Boundaries
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * 4;
      const n = pixelSuspicionMap[i];

      if (n > 0.42) {
        // AI Inpainted / Edited Region (Red / Amber with smooth alpha)
        const t = Math.min(1.0, (n - 0.42) / 0.58);
        compositePixels[idx]     = Math.floor(220 + t * 35);
        compositePixels[idx + 1] = Math.floor(30 * (1 - t) + 40 * t);
        compositePixels[idx + 2] = Math.floor(30 * (1 - t));
        compositePixels[idx + 3] = Math.floor(80 + t * 140);
      } else {
        // Authentic Camera Region (Soft Green tint with low opacity)
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
