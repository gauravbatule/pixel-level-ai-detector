import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const files = [
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_36 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_30 AM.png",
];

async function run() {
  for (const f of files) {
    const meta = await sharp(f).metadata();
    console.log(`\nFile: ${path.basename(f)}`);
    console.log(`  Format: ${meta.format}, Size: ${meta.width}x${meta.height}, Channels: ${meta.channels}`);
  }
}

run().catch(console.error);
