/**
 * Clone / Copy-Move Detection Engine
 */

function computeBlockHash(pixels, width, x, y, bs) {
  let sR = 0, sG = 0, sB = 0, sSq = 0, c = 0;
  for (let dy = 0; dy < bs; dy++) {
    for (let dx = 0; dx < bs; dx++) {
      const idx = ((y + dy) * width + (x + dx)) * 4;
      sR += pixels[idx]; sG += pixels[idx+1]; sB += pixels[idx+2];
      const l = (pixels[idx] + pixels[idx+1] + pixels[idx+2]) / 3;
      sSq += l * l; c++;
    }
  }
  if (!c) return null;
  const aR = sR/c, aG = sG/c, aB = sB/c;
  return { avgR: Math.round(aR), avgG: Math.round(aG), avgB: Math.round(aB),
    variance: Math.round(((sSq/c) - ((aR+aG+aB)/3)**2) * 10) / 10, x, y };
}

export function performCloneDetection(imageData, width, height) {
  const pixels = imageData.data;
  const bs = 16, stride = 8, minDist = 40, simThresh = 4;
  const blocks = [];
  for (let y = 0; y <= height - bs; y += stride)
    for (let x = 0; x <= width - bs; x += stride) {
      const h = computeBlockHash(pixels, width, x, y, bs);
      if (h) blocks.push(h);
    }
  blocks.sort((a, b) => (a.avgR+a.avgG+a.avgB) - (b.avgR+b.avgG+b.avgB) || a.variance - b.variance);

  const clonePairs = [];
  for (let i = 0; i < blocks.length - 1 && clonePairs.length < 500; i++) {
    for (let j = i + 1; j < Math.min(i + 50, blocks.length); j++) {
      const sim = (Math.abs(blocks[i].avgR-blocks[j].avgR)+Math.abs(blocks[i].avgG-blocks[j].avgG)+Math.abs(blocks[i].avgB-blocks[j].avgB))/3 + Math.abs(blocks[i].variance-blocks[j].variance)*0.5;
      if (sim < simThresh) {
        const dx = blocks[j].x-blocks[i].x, dy = blocks[j].y-blocks[i].y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist > minDist) clonePairs.push({ block1:{x:blocks[i].x,y:blocks[i].y}, block2:{x:blocks[j].x,y:blocks[j].y}, similarity:sim, distance:dist });
      }
    }
  }

  const clusters = [], used = new Set();
  for (let i = 0; i < clonePairs.length; i++) {
    if (used.has(i)) continue;
    const cluster = [clonePairs[i]]; used.add(i);
    const dx1 = clonePairs[i].block2.x-clonePairs[i].block1.x, dy1 = clonePairs[i].block2.y-clonePairs[i].block1.y;
    for (let j = i+1; j < clonePairs.length; j++) {
      if (used.has(j)) continue;
      const dx2 = clonePairs[j].block2.x-clonePairs[j].block1.x, dy2 = clonePairs[j].block2.y-clonePairs[j].block1.y;
      if (Math.abs(dx1-dx2) < bs && Math.abs(dy1-dy2) < bs) { cluster.push(clonePairs[j]); used.add(j); }
    }
    if (cluster.length >= 3) clusters.push(cluster);
  }

  const heatmapPixels = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < heatmapPixels.length; i += 4) heatmapPixels[i+3] = 30;
  for (const cluster of clusters)
    for (const pair of cluster)
      for (const block of [pair.block1, pair.block2])
        for (let dy = 0; dy < bs; dy++)
          for (let dx = 0; dx < bs; dx++) {
            const px = block.x+dx, py = block.y+dy;
            if (px < width && py < height) {
              const idx = (py*width+px)*4;
              heatmapPixels[idx]=255; heatmapPixels[idx+1]=100; heatmapPixels[idx+2]=0; heatmapPixels[idx+3]=160;
            }
          }

  return {
    heatmapData: new ImageData(heatmapPixels, width, height),
    stats: { totalPairsFound: clonePairs.length, significantClusters: clusters.length,
      cloneScore: clusters.length > 0 ? Math.min(1, clusters.reduce((s,c)=>s+c.length,0)/50) : 0,
      blocksAnalyzed: blocks.length },
    clonePairs: clonePairs.slice(0, 50), clusters,
  };
}
