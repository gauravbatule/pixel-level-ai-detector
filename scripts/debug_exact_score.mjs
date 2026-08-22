import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

const targetPath = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";

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

async function debugExact() {
  const image = sharp(targetPath);
  const metadata = await image.metadata();

  let w = metadata.width, h = metadata.height; // 1536 x 1024
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const isLossless = false;
  const pixelResult = performPixelForensics(imgData, info.width, info.height, isLossless, 'balanced');
  const noiseResult = performNoiseAnalysis(imgData, info.width, info.height);
  const frequencyResult = performFrequencyAnalysis(imgData, info.width, info.height);

  const chroma = analyzeHighPassResiduals(imgData, info.width, info.height);
  const bnc = noiseResult?.stats?.brightnessNoiseCorrelation ?? 0;
  const smoothRatio = noiseResult?.stats?.smoothRatio ?? 0;
  const avgNoiseVar = noiseResult?.stats?.averageNoiseVariance ?? 0;

  const isSyntheticChroma = chroma.rRB < 0.965;
  const isAuthenticCamera = !isSyntheticChroma && (bnc < -0.05 || (!isLossless && chroma.rRB >= 0.970));

  const aiDimensions = [
    [1024, 1024], [1536, 1024], [1024, 1536], [1792, 1024], [1024, 1792],
    [1344, 768], [768, 1344], [1152, 896], [896, 1152], [512, 512], [768, 768]
  ];
  const matchesAIDim = aiDimensions.some(([dw, dh]) => (w === dw && h === dh) || (w === dh && h === dw));

  console.log("Variables when w=1536, h=1024:");
  console.log("  chroma.rRB:", chroma.rRB);
  console.log("  isSyntheticChroma:", isSyntheticChroma);
  console.log("  bnc:", bnc);
  console.log("  isAuthenticCamera:", isAuthenticCamera);
  console.log("  matchesAIDim:", matchesAIDim);
  console.log("  smoothRatio:", smoothRatio);
  console.log("  avgNoiseVar:", avgNoiseVar);

  let fullAIScore = 0;
  if (!isAuthenticCamera) {
    if (isLossless && (chroma.rRB < 0.985 || (smoothRatio > 0.70 && frequencyResult?.stats?.averageHighFreqRatio < 0.04))) {
      fullAIScore = Math.max(0.85, 0.98 - chroma.rRB * 0.12);
    } else if (matchesAIDim && smoothRatio > 0.50 && avgNoiseVar > 300 && bnc >= 0.0) {
      fullAIScore = 0.88;
    } else if (chroma.rRB < 0.950) {
      fullAIScore = 0.85;
    }
  } else if (matchesAIDim && smoothRatio > 0.50 && avgNoiseVar > 300 && bnc >= 0.0) {
    fullAIScore = 0.88;
  }

  console.log("  fullAIScore:", fullAIScore);
}

debugExact().catch(console.error);
