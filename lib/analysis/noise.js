/**
 * Noise Pattern Analysis Engine
 * 
 * Analyzes noise consistency across the image. AI-generated images typically
 * have unnaturally uniform or synthetic noise patterns compared to real
 * camera sensor noise.
 */

export function performNoiseAnalysis(imageData, width, height) {
  const pixels = imageData.data;

  // Convert to grayscale luminance
  const luminance = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    luminance[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }

  // Apply 3x3 Laplacian high-pass filter to extract noise
  const noiseMap = new Float32Array(width * height);
  const laplacian = [
    0, -1, 0,
    -1, 4, -1,
    0, -1, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          sum += luminance[idx] * laplacian[(ky + 1) * 3 + (kx + 1)];
        }
      }
      noiseMap[y * width + x] = Math.abs(sum);
    }
  }

  // Compute local noise variance in sliding blocks
  const blockSize = 16;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  const blockVariances = [];

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;

      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const val = noiseMap[(by * blockSize + dy) * width + (bx * blockSize + dx)];
          sum += val;
          sumSq += val * val;
          count++;
        }
      }

      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      blockVariances.push({ x: bx, y: by, mean, variance });
    }
  }

  // Compute overall noise statistics
  const allVariances = blockVariances.map(b => b.variance);
  const avgVariance = allVariances.reduce((a, b) => a + b, 0) / allVariances.length;
  const varianceOfVariances = allVariances.reduce((a, b) => a + (b - avgVariance) ** 2, 0) / allVariances.length;

  // AI images have very low variance-of-variances (uniform noise)
  // Real camera images have higher variance-of-variances (varying noise by region)
  const noiseUniformity = Math.max(0, Math.min(1, 1 - (varianceOfVariances / (avgVariance * avgVariance + 1))));

  // Detect suspiciously smooth areas (AI hallmark)
  const smoothThreshold = avgVariance * 0.3;
  let smoothBlockCount = 0;
  for (const bv of blockVariances) {
    if (bv.variance < smoothThreshold) smoothBlockCount++;
  }
  const smoothRatio = smoothBlockCount / blockVariances.length;

  // Generate noise visualization heatmap
  const heatmapPixels = new Uint8ClampedArray(pixels.length);
  let maxNoise = 0;
  for (let i = 0; i < noiseMap.length; i++) {
    if (noiseMap[i] > maxNoise) maxNoise = noiseMap[i];
  }
  if (maxNoise === 0) maxNoise = 1;

  for (let i = 0; i < width * height; i++) {
    const normalized = Math.min(1, noiseMap[i] / (maxNoise * 0.5));
    const idx = i * 4;

    // Purple for high noise, dark for low noise
    heatmapPixels[idx] = Math.floor(normalized * 180 + 20);     // R
    heatmapPixels[idx + 1] = Math.floor(normalized * 40);        // G
    heatmapPixels[idx + 2] = Math.floor(normalized * 255);       // B
    heatmapPixels[idx + 3] = Math.floor(normalized * 160 + 60);  // A
  }

  // Generate block-level inconsistency map
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
          // Red = inconsistent noise, Green = consistent
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
    },
    blockVariances,
  };
}
