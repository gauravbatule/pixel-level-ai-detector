/**
 * Error Level Analysis (ELA) Engine
 *
 * Re-compresses a JPEG image and compares it to the original to detect
 * compression inconsistencies that indicate manipulation or AI generation.
 */

export function performELA(imageData, width, height, quality = 0.9, amplification = 20, fileType = null) {
  return new Promise((resolve) => {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(imageData, 0, 0);

    const jpegDataUrl = srcCanvas.toDataURL('image/jpeg', quality);

    const recompImg = new Image();
    recompImg.onload = () => {
      const recompCanvas = document.createElement('canvas');
      recompCanvas.width = width;
      recompCanvas.height = height;
      const recompCtx = recompCanvas.getContext('2d');
      recompCtx.drawImage(recompImg, 0, 0);

      const recompData = recompCtx.getImageData(0, 0, width, height);
      const originalPixels = imageData.data;
      const recompPixels = recompData.data;

      const elaPixels = new Uint8ClampedArray(originalPixels.length);
      let totalDiff = 0;
      let maxDiff = 0;
      const blockSize = 8;
      const blockVariances = [];

      for (let i = 0; i < originalPixels.length; i += 4) {
        const diffR = Math.abs(originalPixels[i] - recompPixels[i]) * amplification;
        const diffG = Math.abs(originalPixels[i + 1] - recompPixels[i + 1]) * amplification;
        const diffB = Math.abs(originalPixels[i + 2] - recompPixels[i + 2]) * amplification;

        elaPixels[i] = Math.min(255, diffR);
        elaPixels[i + 1] = Math.min(255, diffG);
        elaPixels[i + 2] = Math.min(255, diffB);
        elaPixels[i + 3] = 255;

        const avg = (diffR + diffG + diffB) / 3;
        totalDiff += avg;
        if (avg > maxDiff) maxDiff = avg;
      }

      const pixelCount = width * height;
      const avgDiff = totalDiff / pixelCount;

      const blocksX = Math.floor(width / blockSize);
      const blocksY = Math.floor(height / blockSize);

      for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
          let blockSum = 0;
          let blockSumSq = 0;
          let count = 0;

          for (let dy = 0; dy < blockSize; dy++) {
            for (let dx = 0; dx < blockSize; dx++) {
              const px = bx * blockSize + dx;
              const py = by * blockSize + dy;
              const idx = (py * width + px) * 4;
              const val = (elaPixels[idx] + elaPixels[idx + 1] + elaPixels[idx + 2]) / 3;
              blockSum += val;
              blockSumSq += val * val;
              count++;
            }
          }

          const mean = blockSum / count;
          const variance = (blockSumSq / count) - (mean * mean);
          blockVariances.push({ x: bx, y: by, mean, variance });
        }
      }

      const allMeans = blockVariances.map(b => b.mean);
      const globalMean = allMeans.reduce((a, b) => a + b, 0) / allMeans.length;
      const globalVariance = allMeans.reduce((a, b) => a + (b - globalMean) ** 2, 0) / allMeans.length;

      // Exponential decay — only truly extreme uniformity (gv < 50) scores high
      const rawUniformity = Math.exp(-globalVariance / 80);

      // For non-JPEG: first-time compression creates inherently uniform ELA — not an AI signal
      const isPngOrLossless = fileType && (fileType === 'image/png' || fileType === 'image/webp');
      const adjustedUniformity = isPngOrLossless ? rawUniformity * 0.12 : rawUniformity;

      const heatmapPixels = new Uint8ClampedArray(originalPixels.length);
      for (let i = 0; i < originalPixels.length; i += 4) {
        const intensity = (elaPixels[i] + elaPixels[i + 1] + elaPixels[i + 2]) / 3;
        const normalized = Math.min(1, intensity / 128);
        heatmapPixels[i] = Math.floor(normalized * 255);
        heatmapPixels[i + 1] = Math.floor((1 - normalized) * 200);
        heatmapPixels[i + 2] = Math.floor(normalized * 100);
        heatmapPixels[i + 3] = Math.floor(normalized * 180 + 40);
      }

      resolve({
        elaImageData: new ImageData(elaPixels, width, height),
        heatmapData: new ImageData(heatmapPixels, width, height),
        stats: {
          averageDifference: avgDiff,
          maxDifference: maxDiff,
          uniformityScore: adjustedUniformity,
          globalVariance,
          blockCount: blockVariances.length,
          isLosslessSource: isPngOrLossless,
        },
        blockVariances,
      });
    };

    recompImg.src = jpegDataUrl;
  });
}
