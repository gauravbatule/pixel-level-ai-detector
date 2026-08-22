import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const files = [
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png",
];

async function run() {
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const meta = await sharp(f).metadata();
    const stats = await sharp(f).stats();
    console.log(`File: ${path.basename(f)}`);
    console.log(`  Format: ${meta.format}, Size: ${meta.width}x${meta.height}, Channels: ${meta.channels}`);
    console.log(`  Dominant: R=${stats.channels[0].mean.toFixed(1)}, G=${stats.channels[1].mean.toFixed(1)}, B=${stats.channels[2].mean.toFixed(1)}`);
    console.log(`  StdDev:   R=${stats.channels[0].stdev.toFixed(1)}, G=${stats.channels[1].stdev.toFixed(1)}, B=${stats.channels[2].stdev.toFixed(1)}`);
  }
}

run().catch(console.error);
