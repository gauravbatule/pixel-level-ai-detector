import sharp from 'sharp';
import fs from 'fs';

globalThis.ImageData = class ImageData { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
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
        sumR += dr; sumG += dg; sumB += db; count++;
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

async function run() {
  const p = 'test_dataset/real_photos_expanded/real_architecture_city.jpg';
  const meta = await sharp(p).metadata();
  const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const chroma = analyzeHighPassResiduals(imgData.data, info.width, info.height);
  const pf = performPixelForensics(imgData, info.width, info.height, false, 'balanced');
  const nf = performNoiseAnalysis(imgData, info.width, info.height);
  const ff = performFrequencyAnalysis(imgData, info.width, info.height);

  console.log('City metadata:', meta.width, meta.height);
  console.log('City chroma:', chroma);
  console.log('City noise:', { smoothRatio: nf.stats.smoothRatio, avgNoiseVar: nf.stats.averageNoiseVariance, bnc: nf.stats.brightnessNoiseCorrelation });
  console.log('City freq:', { avgHF: ff.stats.averageHighFreqRatio });

  const isLossless = false;
  const bnc = nf.stats.brightnessNoiseCorrelation;
  const avgNoiseVar = nf.stats.averageNoiseVariance;
  const editRatio = pf.stats.editedAreaRatio;

  // Let's trace isAuthenticCamera:
  const cond1 = (!isLossless && (avgNoiseVar < 320 || bnc <= -0.05 || chroma.rRB >= 0.970));
  console.log('cond1:', cond1, 'bnc <= -0.05:', bnc <= -0.05, 'chroma.rRB >= 0.970:', chroma.rRB >= 0.970);
}

run().catch(console.error);
