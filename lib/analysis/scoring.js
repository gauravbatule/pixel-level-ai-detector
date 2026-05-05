/**
 * Composite Scoring Engine
 * Combines results from all analysis engines into a unified AI probability score.
 */

export function computeCompositeScore(elaResult, noiseResult, frequencyResult, cloneResult, metadataResult) {
  const weights = {
    ela: 0.25,
    noise: 0.25,
    frequency: 0.20,
    clone: 0.10,
    metadata: 0.20,
  };

  // ELA Score: High uniformity = more likely AI
  const elaScore = elaResult
    ? Math.min(1, elaResult.stats.uniformityScore * 0.6 + (elaResult.stats.averageDifference < 10 ? 0.4 : 0))
    : 0.5;

  // Noise Score: High uniformity + high smooth ratio = more likely AI
  const noiseScore = noiseResult
    ? Math.min(1, noiseResult.stats.noiseUniformity * 0.5 + noiseResult.stats.smoothRatio * 0.5)
    : 0.5;

  // Frequency Score: Low high-freq content + high periodicity = more likely AI
  const freqScore = frequencyResult
    ? Math.min(1, frequencyResult.stats.highFreqDeficiency * 0.6 + frequencyResult.stats.periodicityScore * 0.4)
    : 0.5;

  // Clone Score: Direct from clone detection
  const cloneScore = cloneResult ? cloneResult.stats.cloneScore : 0;

  // Metadata Score: Direct suspicion score
  const metaScore = metadataResult ? metadataResult.stats.suspicionScore : 0.5;

  // Weighted composite
  const rawScore = (
    elaScore * weights.ela +
    noiseScore * weights.noise +
    freqScore * weights.frequency +
    cloneScore * weights.clone +
    metaScore * weights.metadata
  );

  // Apply sigmoid-like scaling for more decisive results
  const scaledScore = 1 / (1 + Math.exp(-8 * (rawScore - 0.45)));
  const finalScore = Math.round(scaledScore * 100);

  // Determine classification
  let classification, confidence;
  if (metaScore > 0.7) {
    classification = 'AI Generated';
    confidence = 'High';
  } else if (finalScore >= 75) {
    classification = 'AI Generated';
    confidence = finalScore >= 90 ? 'Very High' : 'High';
  } else if (finalScore >= 55) {
    classification = 'Likely AI Modified';
    confidence = 'Medium';
  } else if (finalScore >= 35) {
    classification = 'Inconclusive';
    confidence = 'Low';
  } else {
    classification = 'Likely Authentic';
    confidence = finalScore <= 15 ? 'High' : 'Medium';
  }

  // Check for editing-specific signals
  const isEdited = cloneScore > 0.3 || (
    elaResult && elaResult.stats.globalVariance > 200
  );
  if (isEdited && classification === 'Likely Authentic') {
    classification = 'Possibly Edited';
    confidence = 'Medium';
  }

  // Generate per-pixel composite mask
  const breakdown = {
    ela: { score: Math.round(elaScore * 100), weight: weights.ela, label: 'Error Level Analysis' },
    noise: { score: Math.round(noiseScore * 100), weight: weights.noise, label: 'Noise Consistency' },
    frequency: { score: Math.round(freqScore * 100), weight: weights.frequency, label: 'Frequency Analysis' },
    clone: { score: Math.round(cloneScore * 100), weight: weights.clone, label: 'Clone Detection' },
    metadata: { score: Math.round(metaScore * 100), weight: weights.metadata, label: 'Metadata Analysis' },
  };

  return {
    overallScore: finalScore,
    classification,
    confidence,
    breakdown,
    rawScore: Math.round(rawScore * 100),
    isEdited,
  };
}

/**
 * Generate composite heatmap from individual analysis results
 */
export function generateCompositeHeatmap(width, height, elaResult, noiseResult, frequencyResult, cloneResult) {
  const compositePixels = new Uint8ClampedArray(width * height * 4);

  // Pre-compute block-level maps for noise and frequency (they're block-based)
  const noiseBlockMap = new Float32Array(width * height);
  const freqBlockMap = new Float32Array(width * height);

  if (noiseResult?.blockVariances) {
    const bs = 16;
    const avgVar = noiseResult.stats.averageNoiseVariance;
    for (const block of noiseResult.blockVariances) {
      const deviation = Math.abs(block.variance - avgVar) / (avgVar + 1);
      const score = Math.min(1, deviation * 2);
      for (let dy = 0; dy < bs; dy++) {
        for (let dx = 0; dx < bs; dx++) {
          const px = block.x * bs + dx;
          const py = block.y * bs + dy;
          if (px < width && py < height) {
            noiseBlockMap[py * width + px] = score;
          }
        }
      }
    }
  }

  if (frequencyResult?.blockData) {
    const bs = 8;
    const avgHF = frequencyResult.stats.averageHighFreqRatio;
    const hfVar = frequencyResult.stats.highFreqVariance;
    for (const block of frequencyResult.blockData) {
      const abnormality = Math.abs(block.highFreqRatio - avgHF) / (Math.sqrt(hfVar) + 0.001);
      const score = Math.min(1, abnormality / 3);
      for (let dy = 0; dy < bs; dy++) {
        for (let dx = 0; dx < bs; dx++) {
          const px = block.x * bs + dx;
          const py = block.y * bs + dy;
          if (px < width && py < height) {
            freqBlockMap[py * width + px] = score;
          }
        }
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;

    // Per-pixel ELA contribution
    let elaScore = 0;
    if (elaResult?.elaImageData) {
      const d = elaResult.elaImageData.data;
      elaScore = (d[idx] + d[idx + 1] + d[idx + 2]) / 3 / 255;
    }

    // Block-level noise contribution
    const noiseScore = noiseBlockMap[i];

    // Block-level frequency contribution
    const freqScore = freqBlockMap[i];

    // Clone contribution (binary - cloned or not)
    let cloneScore = 0;
    if (cloneResult?.heatmapData) {
      const d = cloneResult.heatmapData.data;
      if (d[idx + 3] > 50) cloneScore = 1;
    }

    // Weighted pixel-level suspicion score
    const suspicion = (
      elaScore * 0.35 +
      noiseScore * 0.25 +
      freqScore * 0.25 +
      cloneScore * 0.15
    );

    const n = Math.min(1, Math.max(0, suspicion * 2.0));

    // Clear red/green pixel-level highlighting
    // Red channel = suspicion level (AI-edited), Green channel = authenticity
    if (n > 0.35) {
      // AI-edited: red highlight with intensity proportional to suspicion
      const t = Math.min(1, (n - 0.35) / 0.65);
      compositePixels[idx]     = Math.floor(200 + t * 55);   // R: 200-255
      compositePixels[idx + 1] = Math.floor(30 * (1 - t));   // G: 30-0
      compositePixels[idx + 2] = Math.floor(30 * (1 - t));   // B: 30-0
      compositePixels[idx + 3] = Math.floor(100 + t * 120);  // A: 100-220
    } else {
      // Authentic: green highlight
      const t = Math.min(1, (0.35 - n) / 0.35);
      compositePixels[idx]     = Math.floor(20 * (1 - t));    // R: 20-0
      compositePixels[idx + 1] = Math.floor(140 + t * 80);   // G: 140-220
      compositePixels[idx + 2] = Math.floor(30 * (1 - t));   // B: 30-0
      compositePixels[idx + 3] = Math.floor(60 + t * 80);    // A: 60-140
    }
  }

  return new ImageData(compositePixels, width, height);
}
