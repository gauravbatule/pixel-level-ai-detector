/**
 * Noise Pattern Analysis Engine
 *
 * Analyzes noise patterns to distinguish AI-generated from real camera images.
 * Key algorithms:
 * 1. Laplacian noise extraction + block variance analysis
 * 2. Brightness-noise correlation (BNC) — real cameras produce more noise
 *    in dark areas (shot noise). AI images don't have this property.
 * 3. Cross-channel noise correlation — real Bayer-demosaiced images have
 *    correlated noise across RGB. AI images don't.
 * 4. Smooth region analysis — AI images have unnaturally smooth gradients
 */

export function performNoiseAnalysis(imageData, width, height) {
  const pixels = imageData.data;
  const pixelCount = width * height;

  // Convert to grayscale + extract per-channel values
  const luminance = new Float32Array(pixelCount);
  const rChan = new Float32Array(pixelCount);
  const gChan = new Float32Array(pixelCount);
  const bChan = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    rChan[i] = pixels[idx];
    gChan[i] = pixels[idx + 1];
    bChan[i] = pixels[idx + 2];
    luminance[i] = 0.299 * rChan[i] + 0.587 * gChan[i] + 0.114 * bChan[i];
  }

  // --- 1. Laplacian noise extraction ---
  const noiseMap = new Float32Array(pixelCount);
  const noiseR = new Float32Array(pixelCount);
  const noiseG = new Float32Array(pixelCount);
  const noiseB = new Float32Array(pixelCount);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const t = (y - 1) * width + x;
      const b = (y + 1) * width + x;
      const l = y * width + (x - 1);
      const r = y * width + (x + 1);

      noiseMap[i] = Math.abs(4 * luminance[i] - luminance[t] - luminance[b] - luminance[l] - luminance[r]);
      noiseR[i] = Math.abs(4 * rChan[i] - rChan[t] - rChan[b] - rChan[l] - rChan[r]);
      noiseG[i] = Math.abs(4 * gChan[i] - gChan[t] - gChan[b] - gChan[l] - gChan[r]);
      noiseB[i] = Math.abs(4 * bChan[i] - bChan[t] - bChan[b] - bChan[l] - bChan[r]);
    }
  }

  // --- 2. Block variance analysis ---
  const blockSize = 16;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  const blockVariances = [];

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let sum = 0, sumSq = 0, count = 0;
      let lumSum = 0;

      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const i = (by * blockSize + dy) * width + (bx * blockSize + dx);
          const val = noiseMap[i];
          sum += val;
          sumSq += val * val;
          lumSum += luminance[i];
          count++;
        }
      }

      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      const avgBrightness = lumSum / count;
      blockVariances.push({ x: bx, y: by, mean, variance, avgBrightness });
    }
  }

  const allVariances = blockVariances.map(b => b.variance);
  const avgVariance = allVariances.reduce((a, b) => a + b, 0) / allVariances.length;
  const varianceOfVariances = allVariances.reduce((a, b) => a + (b - avgVariance) ** 2, 0) / allVariances.length;
  const noiseUniformity = Math.max(0, Math.min(1, 1 - (varianceOfVariances / (avgVariance * avgVariance + 1))));

  const smoothThreshold = avgVariance * 0.3;
  let smoothBlockCount = 0;
  for (const bv of blockVariances) {
    if (bv.variance < smoothThreshold) smoothBlockCount++;
  }
  const smoothRatio = smoothBlockCount / blockVariances.length;

  // --- 3. Brightness-Noise Correlation (BNC) ---
  // In real camera images, darker regions have proportionally more noise (shot noise).
  // AI images have brightness-independent noise.
  // Group blocks by brightness, compare noise levels.
  const darkBlocks = blockVariances.filter(b => b.avgBrightness < 80);
  const midBlocks = blockVariances.filter(b => b.avgBrightness >= 80 && b.avgBrightness < 180);
  const brightBlocks = blockVariances.filter(b => b.avgBrightness >= 180);

  let brightnessNoiseCorrelation = 0;
  const avgNoise = (blocks) => blocks.length > 0 ? blocks.reduce((s, b) => s + b.mean, 0) / blocks.length : 0;

  const darkNoise = avgNoise(darkBlocks);
  const midNoise = avgNoise(midBlocks);
  const brightNoise = avgNoise(brightBlocks);

  // Real cameras: dark regions have more high-frequency noise after Laplacian
  // because shot noise dominates. If dark > bright noise, that's camera-like.
  if (darkBlocks.length > 5 && brightBlocks.length > 5) {
    const noiseRatio = darkNoise / (brightNoise + 0.01);
    // Real photos: ratio > 1.2 (dark areas noisier). AI: ratio ≈ 1.0 (uniform).
    if (noiseRatio > 1.3) {
      brightnessNoiseCorrelation = -0.3; // negative = looks like real camera
    } else if (noiseRatio > 1.1) {
      brightnessNoiseCorrelation = -0.1;
    } else if (noiseRatio < 0.9) {
      brightnessNoiseCorrelation = 0.2; // inverted = suspicious
    } else {
      brightnessNoiseCorrelation = 0.15; // flat = AI-like
    }
  } else if (darkBlocks.length > 3 && midBlocks.length > 3) {
    const noiseRatio = darkNoise / (midNoise + 0.01);
    if (noiseRatio > 1.2) brightnessNoiseCorrelation = -0.2;
    else brightnessNoiseCorrelation = 0.1;
  }

  // --- 4. Cross-channel noise correlation ---
  // Real cameras: Bayer demosaicing creates correlated noise across R/G/B channels.
  // AI images: noise across channels is uncorrelated or absent.
  let crossChannelScore = 0;
  const sampleCount = Math.min(pixelCount, 50000);
  const sampleStride = Math.max(1, Math.floor(pixelCount / sampleCount));

  let sumRG = 0, sumRB = 0, sumGB = 0;
  let sumR2 = 0, sumG2 = 0, sumB2 = 0;
  let sumR = 0, sumG_acc = 0, sumB_acc = 0;
  let samples = 0;

  for (let i = width + 1; i < pixelCount - width - 1; i += sampleStride) {
    const nr = noiseR[i], ng = noiseG[i], nb = noiseB[i];
    if (nr + ng + nb < 0.5) continue; // skip flat areas
    sumR += nr; sumG_acc += ng; sumB_acc += nb;
    sumRG += nr * ng; sumRB += nr * nb; sumGB += ng * nb;
    sumR2 += nr * nr; sumG2 += ng * ng; sumB2 += nb * nb;
    samples++;
  }

  if (samples > 100) {
    const mR = sumR / samples, mG = sumG_acc / samples, mB = sumB_acc / samples;
    const varR = sumR2 / samples - mR * mR;
    const varG = sumG2 / samples - mG * mG;
    const varB = sumB2 / samples - mB * mB;

    const corrRG = (sumRG / samples - mR * mG) / (Math.sqrt(varR * varG) + 0.001);
    const corrRB = (sumRB / samples - mR * mB) / (Math.sqrt(varR * varB) + 0.001);
    const corrGB = (sumGB / samples - mG * mB) / (Math.sqrt(varG * varB) + 0.001);

    const avgCorr = (corrRG + corrRB + corrGB) / 3;

    // Real cameras: correlation 0.4-0.9 (Bayer demosaicing spreads noise)
    // AI images: correlation 0.85-1.0 (RGB generated together) or < 0.3 (independent noise)
    // Extremely high correlation (> 0.92) is suspicious — indicates synthetic luminance noise
    if (avgCorr > 0.92) {
      crossChannelScore = 0.25; // suspiciously high — noise is just luminance scaled
    } else if (avgCorr > 0.6) {
      crossChannelScore = -0.15; // normal camera range
    } else if (avgCorr > 0.3) {
      crossChannelScore = 0; // ambiguous
    } else {
      crossChannelScore = 0.15; // very low — AI-like independent channels
    }
  }

  // --- 5. Gradient smoothness analysis ---
  // AI images have unnaturally smooth gradients. Sample gradient transitions
  // and measure how "step-free" they are.
  let smoothGradientScore = 0;
  const gradientSamples = Math.min(2000, blocksX * blocksY);
  const gStride = Math.max(1, Math.floor(blocksX * blocksY / gradientSamples));
  let superSmooth = 0, totalGradSamples = 0;

  for (let by = 1; by < blocksY - 1; by++) {
    for (let bx = 1; bx < blocksX - 1; bx++) {
      if ((by * blocksX + bx) % gStride !== 0) continue;
      // Check 3x3 block neighborhood for smooth gradients
      const center = blockVariances[by * blocksX + bx];
      const left = blockVariances[by * blocksX + (bx - 1)];
      const right = blockVariances[by * blocksX + (bx + 1)];
      const top = blockVariances[(by - 1) * blocksX + bx];
      const bottom = blockVariances[(by + 1) * blocksX + bx];

      // Check if brightness changes smoothly but noise is extremely low
      const brightRange = Math.max(center.avgBrightness, left.avgBrightness, right.avgBrightness, top.avgBrightness, bottom.avgBrightness)
        - Math.min(center.avgBrightness, left.avgBrightness, right.avgBrightness, top.avgBrightness, bottom.avgBrightness);

      if (brightRange > 10 && brightRange < 80) {
        // There IS a gradient here. Check if noise is unnaturally low.
        const noiseInGradient = (center.mean + left.mean + right.mean + top.mean + bottom.mean) / 5;
        if (noiseInGradient < 3) {
          superSmooth++;
        }
        totalGradSamples++;
      }
    }
  }

  if (totalGradSamples > 20) {
    const smoothGradRatio = superSmooth / totalGradSamples;
    // > 40% of gradients being ultra-smooth is an AI hallmark
    smoothGradientScore = smoothGradRatio > 0.4 ? 0.3 : smoothGradRatio > 0.2 ? 0.15 : 0;
  }

  // --- Compose the noise heatmap ---
  const heatmapPixels = new Uint8ClampedArray(pixels.length);
  let maxNoise = 0;
  for (let i = 0; i < noiseMap.length; i++) {
    if (noiseMap[i] > maxNoise) maxNoise = noiseMap[i];
  }
  if (maxNoise === 0) maxNoise = 1;

  for (let i = 0; i < pixelCount; i++) {
    const normalized = Math.min(1, noiseMap[i] / (maxNoise * 0.5));
    const idx = i * 4;
    heatmapPixels[idx] = Math.floor(normalized * 180 + 20);
    heatmapPixels[idx + 1] = Math.floor(normalized * 40);
    heatmapPixels[idx + 2] = Math.floor(normalized * 255);
    heatmapPixels[idx + 3] = Math.floor(normalized * 160 + 60);
  }

  const inconsistencyMap = new Uint8ClampedArray(pixels.length);
  for (const block of blockVariances) {
    const deviation = Math.abs(block.variance - avgVariance) / (avgVariance + 1);
    const intensity = Math.min(1, deviation * 2);
    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        const px = block.x * blockSize + dx;
        const py = block.y * blockSize + dy;
        if (px < width && py < height) {
          const idx = (py * width + px) * 4;
          inconsistencyMap[idx] = Math.floor(intensity * 255);
          inconsistencyMap[idx + 1] = Math.floor((1 - intensity) * 180);
          inconsistencyMap[idx + 2] = 40;
          inconsistencyMap[idx + 3] = Math.floor(intensity * 150 + 50);
        }
      }
    }
  }

  return {
    noiseHeatmap: new ImageData(heatmapPixels, width, height),
    inconsistencyHeatmap: new ImageData(inconsistencyMap, width, height),
    stats: {
      averageNoiseVariance: avgVariance,
      varianceOfVariances,
      noiseUniformity,
      smoothRatio,
      totalBlocks: blockVariances.length,
      smoothBlocks: smoothBlockCount,
      brightnessNoiseCorrelation,
      crossChannelScore,
      smoothGradientScore,
    },
    blockVariances,
  };
}
