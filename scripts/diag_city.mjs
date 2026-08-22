import sharp from 'sharp';
import fs from 'fs';

globalThis.ImageData = class ImageData { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

async function diag() {
  const p = 'test_dataset/real_photos_expanded/real_architecture_city.jpg';
  const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
  const pf = performPixelForensics(imgData, info.width, info.height, false, 'balanced');
  const nf = performNoiseAnalysis(imgData, info.width, info.height);
  const ff = performFrequencyAnalysis(imgData, info.width, info.height);

  let photoPatchCount = 0;
  const lnv = pf.localNoiseVar;
  for (let i = 0; i < info.width * info.height; i++) {
    if (lnv[i] > 600) photoPatchCount++;
  }
  const photoPatchRatio = photoPatchCount / (info.width * info.height);

  console.log('City local noise patch ratio:', photoPatchRatio);
  console.log('City smooth ratio:', nf.stats.smoothRatio);
  console.log('City noise var:', nf.stats.averageNoiseVariance);
  console.log('City bnc:', nf.stats.brightnessNoiseCorrelation);
}

diag().catch(console.error);
