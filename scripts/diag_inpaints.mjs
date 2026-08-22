import sharp from 'sharp';
import fs from 'fs';

globalThis.ImageData = class ImageData { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

async function diag(p, name) {
  const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
  const pf = performPixelForensics(imgData, info.width, info.height, true, 'balanced');
  const nf = performNoiseAnalysis(imgData, info.width, info.height);
  const ff = performFrequencyAnalysis(imgData, info.width, info.height);
  console.log(`\n=== ${name} ===`);
  console.log('PF stats:', pf.stats);
  console.log('NF stats:', { smoothRatio: nf.stats.smoothRatio, avgNoiseVar: nf.stats.averageNoiseVariance, bnc: nf.stats.brightnessNoiseCorrelation });
}

async function run() {
  await diag('test_dataset/ai_inpainted/inpaint_modal.png', 'Inpaint Modal');
  await diag('test_dataset/ai_inpainted/inpaint_red_path.png', 'Inpaint Red Path');
}

run().catch(console.error);
