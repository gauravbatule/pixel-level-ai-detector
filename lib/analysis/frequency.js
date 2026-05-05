/**
 * Frequency Domain Analysis Engine
 * 
 * Performs DCT-like analysis on 8x8 blocks to detect compression artifacts,
 * double-compression ghosts, and AI generation patterns.
 */

function dct8x8(block) {
  const N = 8;
  const result = new Float32Array(N * N);

  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let sum = 0;
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;

      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum += block[x * N + y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }

      result[u * N + v] = (2 / N) * cu * cv * sum;
    }
  }

  return result;
}

export function performFrequencyAnalysis(imageData, width, height) {
  const pixels = imageData.data;

  // Convert to grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }

  const blockSize = 8;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);

  // Analyze DCT coefficients for each block
  const blockData = [];
  const highFreqEnergies = [];
  const dcValues = [];

  // Limit to a reasonable subset for performance
  const maxBlocks = Math.min(blocksX * blocksY, 5000);
  const stride = Math.max(1, Math.floor((blocksX * blocksY) / maxBlocks));

  let blockIndex = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      blockIndex++;
      if (blockData.length >= maxBlocks || (stride > 1 && blockIndex % stride !== 0)) continue;

      // Extract 8x8 block
      const block = new Float32Array(64);
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          block[dy * blockSize + dx] = gray[(by * blockSize + dy) * width + (bx * blockSize + dx)];
        }
      }

      // Perform DCT
      const dct = dct8x8(block);

      // Calculate high-frequency energy (bottom-right triangle of DCT matrix)
      let highFreqEnergy = 0;
      let lowFreqEnergy = 0;
      let totalEnergy = 0;

      for (let u = 0; u < blockSize; u++) {
        for (let v = 0; v < blockSize; v++) {
          const energy = dct[u * blockSize + v] * dct[u * blockSize + v];
          totalEnergy += energy;
          if (u + v > 4) {
            highFreqEnergy += energy;
          } else {
            lowFreqEnergy += energy;
          }
        }
      }

      const dc = dct[0];
      dcValues.push(dc);
      highFreqEnergies.push(highFreqEnergy / (totalEnergy + 0.001));

      blockData.push({
        x: bx, y: by,
        dc,
        highFreqRatio: highFreqEnergy / (totalEnergy + 0.001),
        totalEnergy,
      });
    }
  }

  // Analyze patterns in DCT data
  const avgHighFreq = highFreqEnergies.reduce((a, b) => a + b, 0) / highFreqEnergies.length;
  const highFreqVariance = highFreqEnergies.reduce((a, b) => a + (b - avgHighFreq) ** 2, 0) / highFreqEnergies.length;

  // AI images often lack natural high-frequency details
  // and have more uniform DCT distributions
  const highFreqDeficiency = avgHighFreq < 0.15 ? 1 : Math.max(0, 1 - avgHighFreq / 0.3);

  // Check for periodicity in DC values (compression artifact indicator)
  let periodicityScore = 0;
  if (dcValues.length > 16) {
    const dcDiffs = [];
    for (let i = 1; i < dcValues.length; i++) {
      dcDiffs.push(Math.abs(dcValues[i] - dcValues[i - 1]));
    }
    const avgDcDiff = dcDiffs.reduce((a, b) => a + b, 0) / dcDiffs.length;
    const dcDiffVariance = dcDiffs.reduce((a, b) => a + (b - avgDcDiff) ** 2, 0) / dcDiffs.length;
    periodicityScore = Math.max(0, 1 - (dcDiffVariance / (avgDcDiff * avgDcDiff + 1)));
  }

  // Generate frequency heatmap visualization
  const heatmapPixels = new Uint8ClampedArray(pixels.length);

  for (const block of blockData) {
    const hfr = block.highFreqRatio;
    const abnormality = Math.abs(hfr - avgHighFreq) / (Math.sqrt(highFreqVariance) + 0.001);
    const intensity = Math.min(1, abnormality / 3);

    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        const px = block.x * blockSize + dx;
        const py = block.y * blockSize + dy;
        if (px < width && py < height) {
          const idx = (py * width + px) * 4;
          // Cyan for anomalous frequency patterns
          heatmapPixels[idx] = Math.floor((1 - intensity) * 30);
          heatmapPixels[idx + 1] = Math.floor(intensity * 200 + 40);
          heatmapPixels[idx + 2] = Math.floor(intensity * 255);
          heatmapPixels[idx + 3] = Math.floor(intensity * 160 + 50);
        }
      }
    }
  }

  return {
    heatmapData: new ImageData(heatmapPixels, width, height),
    stats: {
      averageHighFreqRatio: avgHighFreq,
      highFreqVariance,
      highFreqDeficiency,
      periodicityScore,
      blocksAnalyzed: blockData.length,
    },
    blockData,
  };
}
