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

function analyzeHighPassResiduals(pixels, width, height) {
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

const newDownloads = [
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_36 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_30 AM.png",
  "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg"
];

async function inspectNew() {
  console.log("================================================================================");
  console.log("  INSPECTING NEWLY DOWNLOADED 100% AI IMAGES");
  console.log("================================================================================\n");

  for (const p of newDownloads) {
    if (!fs.existsSync(p)) continue;

    const image = sharp(p);
    const meta = await image.metadata();
    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const chroma = analyzeHighPassResiduals(imgData.data, info.width, info.height);
    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);
    const pixelRes = performPixelForensics(imgData, info.width, info.height, p.endsWith('.png'), 'balanced');

    console.log(`File: ${path.basename(p)}`);
    console.log(`  Dimensions:  ${meta.width} x ${meta.height}`);
    console.log(`  Chroma r(R,B): ${chroma.rRB.toFixed(4)} (rRG: ${chroma.rRG.toFixed(4)})`);
    console.log(`  BNC:         ${noiseRes.stats.brightnessNoiseCorrelation.toFixed(2)}`);
    console.log(`  SmoothRatio: ${(noiseRes.stats.smoothRatio * 100).toFixed(1)}%`);
    console.log(`  AvgNoiseVar: ${noiseRes.stats.averageNoiseVariance.toFixed(1)}`);
    console.log(`  AvgHF:       ${freqRes.stats.averageHighFreqRatio.toFixed(4)}`);
    console.log(`  EditRatio:   ${(pixelRes.stats.editedAreaRatio * 100).toFixed(1)}%`);
    console.log("");
  }
}

inspectNew().catch(console.error);
