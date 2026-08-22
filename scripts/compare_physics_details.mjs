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

const targetAI = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";
const targetKitchen = "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg";
const targetLinkedIn = "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png";

async function compare() {
  for (const [name, p] of [["WhatsApp AI Card", targetAI], ["Real Kitchen", targetKitchen], ["Real LinkedIn", targetLinkedIn]]) {
    const image = sharp(p);
    const meta = await image.metadata();
    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const pixelRes = performPixelForensics(imgData, info.width, info.height, false, 'balanced');
    console.log(`\n=== ${name} ===`);
    console.log("  editedPixelCount:", pixelRes.stats.editedPixelCount);
    console.log("  editedAreaRatio:", pixelRes.stats.editedAreaRatio);
    console.log("  averageSuspicion:", pixelRes.stats.averageSuspicion);

    // Count pixels with high local noise variance (photo patch)
    let photoPatchPixels = 0;
    const lnv = pixelRes.localNoiseVar;
    for (let i = 0; i < info.width * info.height; i++) {
      if (lnv[i] > 600) photoPatchPixels++;
    }
    console.log("  photoPatchPixels (variance > 600):", photoPatchPixels, `(${(photoPatchPixels / (info.width * info.height) * 100).toFixed(2)}%)`);
  }
}

compare().catch(console.error);
