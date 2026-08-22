import sharp from 'sharp';
import fs from 'fs';

globalThis.ImageData = class ImageData { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { performNoiseAnalysis } from '../lib/analysis/noise.js';

async function diag() {
  const p = 'test_dataset/real_photos_expanded/real_coffee_table.jpg';
  const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
  const pf = performPixelForensics(imgData, info.width, info.height, false, 'balanced');
  const nf = performNoiseAnalysis(imgData, info.width, info.height);

  console.log('Coffee stats:');
  console.log('  smoothRatio:', nf.stats.smoothRatio);
  console.log('  avgNoiseVar:', nf.stats.averageNoiseVariance);
  console.log('  bnc:', nf.stats.brightnessNoiseCorrelation);
  console.log('  pf stats:', pf.stats);
}

diag().catch(console.error);
