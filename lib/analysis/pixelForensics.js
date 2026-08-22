/**
 * Pure Mathematical & Physical Pixel Forensics Engine (Zero Color Bias)
 * 
 * Replaces hardcoded color heuristics with physical & mathematical image forensics:
 * 1. Multi-scale High-Pass Noise Residuals (Laplacian 3x3 filter)
 * 2. Integral-Image Local Noise Variance Field (9x9 sliding window)
 * 3. Multi-Channel Splice Boundary Seam Discontinuity (Sobel on inter-channel gradients)
 * 4. Diffusion Micro-Texture Discordance (Boundary sharpness vs Texture smoothness)
 * 5. Guided Bilateral Spatial Edge Regularization
 */

export function performPixelForensics(imageData, width, height, isScreenshotOrLossless = false, mode = 'balanced') {
  const pixels = imageData.data;
  const numPixels = width * height;

  const rChan = new Float32Array(numPixels);
  const gChan = new Float32Array(numPixels);
  const bChan = new Float32Array(numPixels);
  const lum = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
    rChan[i] = r;
    gChan[i] = g;
    bChan[i] = b;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // --- 1. Multi-scale High-Pass Noise Residuals (Laplacian 3x3) ---
  const res3x3 = new Float32Array(numPixels);
  let totalNoise = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const lapLum = 8 * lum[idx] - (
        lum[idx - width - 1] + lum[idx - width] + lum[idx - width + 1] +
        lum[idx - 1] + lum[idx + 1] +
        lum[idx + width - 1] + lum[idx + width] + lum[idx + width + 1]
      );
      const val = Math.abs(lapLum) / 8;
      res3x3[idx] = val;
      totalNoise += val;
    }
  }

  const baselineNoise = totalNoise / numPixels;

  // --- 2. Integral-Image Local Noise Variance (9x9 window) ---
  const localNoiseVar = new Float32Array(numPixels);
  const nWinR = 4;
  const integral = new Float64Array((width + 1) * (height + 1));
  const integralSq = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0, rowSumSq = 0;
    const iRow = (y + 1) * (width + 1);
    const prevIRow = y * (width + 1);
    const pixRow = y * width;
    for (let x = 0; x < width; x++) {
      const val = res3x3[pixRow + x];
      rowSum += val;
      rowSumSq += val * val;
      integral[iRow + (x + 1)] = integral[prevIRow + (x + 1)] + rowSum;
      integralSq[iRow + (x + 1)] = integralSq[prevIRow + (x + 1)] + rowSumSq;
    }
  }

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - nWinR);
    const y1 = Math.min(height, y + nWinR + 1);
    const hCount = y1 - y0;
    const rIdx = y * width;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - nWinR);
      const x1 = Math.min(width, x + nWinR + 1);
      const count = hCount * (x1 - x0);

      const pA = y0 * (width + 1) + x0;
      const pB = y0 * (width + 1) + x1;
      const pC = y1 * (width + 1) + x0;
      const pD = y1 * (width + 1) + x1;

      const sum = integral[pD] - integral[pB] - integral[pC] + integral[pA];
      const sumSq = integralSq[pD] - integralSq[pB] - integralSq[pC] + integralSq[pA];
      const mean = sum / count;
      const variance = Math.max(0, (sumSq / count) - (mean * mean));
      localNoiseVar[rIdx + x] = variance;
    }
  }

  // --- 3. Inter-Channel Splice Boundary Seam Discontinuity (Color Delta Gradient) ---
  const seamMap = new Float32Array(numPixels);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const gxRG = (rChan[idx + 1] - gChan[idx + 1]) - (rChan[idx - 1] - gChan[idx - 1]);
      const gyRG = (rChan[idx + width] - gChan[idx + width]) - (rChan[idx - width] - gChan[idx - width]);
      const gxGB = (gChan[idx + 1] - bChan[idx + 1]) - (gChan[idx - 1] - bChan[idx - 1]);
      const gyGB = (gChan[idx + width] - bChan[idx + width]) - (gChan[idx - width] - bChan[idx - width]);

      const mag = Math.sqrt(gxRG * gxRG + gyRG * gyRG) + Math.sqrt(gxGB * gxGB + gyGB * gyGB);
      seamMap[idx] = Math.min(1.0, mag / 38.0);
    }
  }

  // --- 4. Diffusion Micro-Texture Discordance ---
  const diffusionDiscordance = new Float32Array(numPixels);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const gx = lum[idx + 1] - lum[idx - 1];
      const gy = lum[idx + width] - lum[idx - width];
      const edgeGrad = Math.sqrt(gx * gx + gy * gy);
      const textureVar = localNoiseVar[idx];

      if (edgeGrad > 18 && textureVar < 5.0) {
        diffusionDiscordance[idx] = Math.min(1.0, (edgeGrad / (textureVar + 1.0)) / 22.0);
      }
    }
  }

  // --- 5. Pure Physical Fusion (Zero Color Rules) ---
  const rawSuspicion = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const sm = seamMap[i];
    const dd = diffusionDiscordance[i];
    rawSuspicion[i] = Math.min(1.0, sm * 0.65 + dd * 0.35);
  }

  const refinedSuspicion = guidedBilateralFilter(rawSuspicion, lum, width, height, 4, 12.0);

  let editedPixelCount = 0;
  let totalSuspicion = 0;
  for (let i = 0; i < numPixels; i++) {
    const p = refinedSuspicion[i];
    totalSuspicion += p;
    if (p > 0.30) editedPixelCount++;
  }

  return {
    rawSuspicion,
    refinedSuspicion,
    spliceMap: seamMap,
    localNoiseVar,
    baselineNoise,
    res3x3,
    stats: {
      editedPixelCount,
      editedAreaRatio: editedPixelCount / numPixels,
      averageSuspicion: totalSuspicion / numPixels,
      hasModalInpaint: false,
      baselineNoise,
    }
  };
}

/**
 * Fast Guided Bilateral Filter
 */
function guidedBilateralFilter(src, guide, width, height, radius = 3, spatialSigma = 8.0) {
  const dst = new Float32Array(width * height);
  const colorSigma = 16.0;
  const twoColorSigmaSq = 2 * colorSigma * colorSigma;

  for (let y = radius; y < height - radius; y++) {
    const rowOffset = y * width;
    for (let x = radius; x < width - radius; x++) {
      const centerIdx = rowOffset + x;
      const centerGuide = guide[centerIdx];

      let weightSum = 0;
      let valSum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const neighborRow = (y + dy) * width;
        for (let dx = -radius; dx <= radius; dx++) {
          const neighborIdx = neighborRow + (x + dx);
          const diffGuide = guide[neighborIdx] - centerGuide;

          const spatialDistSq = dx * dx + dy * dy;
          const rangeDistSq = diffGuide * diffGuide;

          const weight = Math.exp(-spatialDistSq / (2 * radius * radius) - rangeDistSq / twoColorSigmaSq);
          weightSum += weight;
          valSum += src[neighborIdx] * weight;
        }
      }

      dst[centerIdx] = weightSum > 0 ? valSum / weightSum : src[centerIdx];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y < radius || y >= height - radius || x < radius || x >= width - radius) {
        dst[y * width + x] = src[y * width + x];
      }
    }
  }

  return dst;
}
