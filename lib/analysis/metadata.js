/**
 * Metadata Analysis Engine
 * Parses image metadata for AI generation signatures.
 * Supports JPEG, PNG, WebP. Detects C2PA content credentials,
 * OpenAI/ChatGPT, DALL-E, Midjourney, Stable Diffusion, and more.
 */

export function performMetadataAnalysis(file, imageData, width, height) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = new Uint8Array(e.target.result);
      const meta = extractBasicMeta(buffer, file);
      resolve(analyzeMetadata(meta, file, width, height));
    };
    reader.readAsArrayBuffer(file);
  });
}

function extractBasicMeta(buffer, file) {
  const meta = {
    exifFound: false, software: null, make: null, model: null,
    dateTime: null, gps: false, xmp: null, aiSignatures: [],
    hasC2PA: false, pngChunks: [], rawTags: {},
  };

  // Extract ASCII strings to check for EXIF tags
  try {
    const headerStr = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, Math.min(buffer.length, 65536)));
    
    // Check for Make / Model / Software tags in EXIF
    const makeMatch = headerStr.match(/(?:Make|Apple|Canon|Nikon|Sony|Samsung|Google|FUJIFILM|Panasonic|Olympus|Leica)\x00?([a-zA-Z0-9\s\-_]{2,30})/i);
    if (makeMatch) meta.make = makeMatch[0].trim().replace(/\x00/g, '');

    const modelMatch = headerStr.match(/(?:iPhone|Galaxy|Pixel|EOS|Alpha|ILCE|D\d{3,4}|HERO|SM-[A-Z0-9]+)[a-zA-Z0-9\s\-_]{0,20}/i);
    if (modelMatch) meta.model = modelMatch[0].trim();

    const softMatch = headerStr.match(/(?:Software|Creator|SoftwareApp)\x00?([a-zA-Z0-9\.\s\-_]{2,40})/i);
    if (softMatch) meta.software = softMatch[1].trim();

    const dateMatch = headerStr.match(/\b(20\d{2}[:\/\-]\d{2}[:\/\-]\d{2}\s+\d{2}:\d{2}:\d{2})\b/);
    if (dateMatch) meta.dateTime = dateMatch[1];
  } catch (e) {}

  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    meta.isJpeg = true;
    let offset = 2;
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0xFF) {
        const marker = buffer[offset + 1];
        const size = (buffer[offset + 2] << 8) | buffer[offset + 3];
        if (marker === 0xE1) {
          meta.exifFound = true;
          try {
            const chunk = new TextDecoder('ascii', { fatal: false })
              .decode(buffer.slice(offset + 4, offset + 2 + Math.min(size, 4000)));
            checkAISignatures(chunk, meta);
          } catch (e) {}
        }
        if (marker === 0xE1 || marker === 0xE2 || marker === 0xEB) {
          try {
            const chunk = new TextDecoder('ascii', { fatal: false })
              .decode(buffer.slice(offset + 4, offset + 2 + Math.min(size, 8000)));
            if (/c2pa|jumbf|contentcredentials|content.credentials/i.test(chunk)) {
              meta.hasC2PA = true;
            }
            checkAISignatures(chunk, meta);
          } catch (e) {}
        }
        if (marker === 0xDA) break;
        offset += size + 2;
      } else {
        offset++;
      }
    }
  }

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    meta.isPng = true;
    let offset = 8;
    while (offset < buffer.length - 8) {
      const chunkLen = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
      const chunkType = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]);
      meta.pngChunks.push(chunkType);

      const scanChunk = chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt'
        || chunkType === 'eXIf' || chunkType === 'caBX' || chunkType === 'cpBX';

      if (chunkType === 'eXIf') meta.exifFound = true;
      if (chunkType === 'caBX' || chunkType === 'cpBX') meta.hasC2PA = true;

      if (scanChunk) {
        try {
          const textData = new TextDecoder('ascii', { fatal: false })
            .decode(buffer.slice(offset + 8, offset + 8 + Math.min(chunkLen, 8000)));
          checkAISignatures(textData, meta);
          if (/c2pa|jumbf|contentcredentials|content.credentials/i.test(textData)) {
            meta.hasC2PA = true;
          }
        } catch (e) {}
      }

      if (chunkType === 'IEND') break;
      offset += 12 + chunkLen;
      if (chunkLen < 0 || offset < 0) break;
    }
  }

  // WebP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    meta.isWebP = true;
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
      const chunkSize = buffer[offset + 4] | (buffer[offset + 5] << 8) | (buffer[offset + 6] << 16) | (buffer[offset + 7] << 24);
      if (chunkId === 'EXIF') {
        meta.exifFound = true;
        try {
          const textData = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(offset + 8, offset + 8 + Math.min(chunkSize, 4000)));
          checkAISignatures(textData, meta);
        } catch (e) {}
      }
      if (chunkId === 'XMP ') {
        try {
          const textData = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(offset + 8, offset + 8 + Math.min(chunkSize, 8000)));
          checkAISignatures(textData, meta);
          if (/c2pa|jumbf|contentcredentials/i.test(textData)) meta.hasC2PA = true;
        } catch (e) {}
      }
      offset += 8 + chunkSize + (chunkSize % 2);
      if (chunkSize <= 0) break;
    }
  }

  // Scan raw bytes — scan up to 200KB for signatures
  const scanLen = Math.min(buffer.length, 200000);
  try {
    const textSample = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, scanLen));
    checkAISignatures(textSample, meta);
    if (/c2pa|jumbf|contentcredentials|content.credentials/i.test(textSample)) {
      meta.hasC2PA = true;
    }
  } catch (e) {}

  // Also scan from end of file (C2PA boxes often appended at end)
  if (buffer.length > 200000) {
    try {
      const tailSample = new TextDecoder('ascii', { fatal: false })
        .decode(buffer.slice(Math.max(0, buffer.length - 100000)));
      checkAISignatures(tailSample, meta);
      if (/c2pa|jumbf|contentcredentials|content.credentials/i.test(tailSample)) {
        meta.hasC2PA = true;
      }
    } catch (e) {}
  }

  return meta;
}

function checkAISignatures(text, meta) {
  const aiPatterns = [
    { pattern: /openai/i, name: 'OpenAI' },
    { pattern: /chatgpt/i, name: 'ChatGPT' },
    { pattern: /dall[·\-\s]?e/i, name: 'DALL-E' },
    { pattern: /gpt[\-\s]?4[\-\s]?o/i, name: 'GPT-4o' },
    { pattern: /gpt[\-\s]?image/i, name: 'GPT Image' },
    { pattern: /midjourney/i, name: 'Midjourney' },
    { pattern: /stable[\s\-]?diffusion/i, name: 'Stable Diffusion' },
    { pattern: /comfyui/i, name: 'ComfyUI' },
    { pattern: /automatic1111|a1111/i, name: 'Automatic1111' },
    { pattern: /novelai/i, name: 'NovelAI' },
    { pattern: /firefly/i, name: 'Adobe Firefly' },
    { pattern: /invoke[\s\-]?ai/i, name: 'InvokeAI' },
    { pattern: /dreamstudio/i, name: 'DreamStudio' },
    { pattern: /leonardo[\s\.]?ai/i, name: 'Leonardo.AI' },
    { pattern: /runway/i, name: 'Runway ML' },
    { pattern: /flux[\s\-]?1|flux[\s\-]?pro|flux[\s\-]?dev/i, name: 'Flux' },
    { pattern: /ideogram/i, name: 'Ideogram' },
    { pattern: /google[\s\-]?imagen|imagen[\s\-]?3/i, name: 'Google Imagen' },
    { pattern: /gemini[\s\-]?image/i, name: 'Gemini' },
    { pattern: /copilot[\s\-]?designer/i, name: 'Copilot Designer' },
    { pattern: /bing[\s\-]?image[\s\-]?creator/i, name: 'Bing Image Creator' },
    { pattern: /sora/i, name: 'Sora' },
  ];
  const editPatterns = [
    { pattern: /photoshop/i, name: 'Adobe Photoshop' },
    { pattern: /gimp/i, name: 'GIMP' },
    { pattern: /lightroom/i, name: 'Adobe Lightroom' },
    { pattern: /canva/i, name: 'Canva' },
    { pattern: /pixlr/i, name: 'Pixlr' },
    { pattern: /affinity/i, name: 'Affinity' },
  ];
  for (const p of aiPatterns)
    if (p.pattern.test(text) && !meta.aiSignatures.includes(p.name))
      meta.aiSignatures.push(p.name);
  for (const p of editPatterns)
    if (p.pattern.test(text) && !meta.aiSignatures.includes(p.name))
      meta.aiSignatures.push(p.name);
}

function analyzeMetadata(meta, file, width, height) {
  const findings = [];
  let suspicionScore = 0;

  // C2PA content credentials found — strong AI indicator
  if (meta.hasC2PA) {
    findings.push({ type: 'critical', message: 'C2PA content credentials detected — image has AI provenance data', weight: 0.7 });
    suspicionScore += 0.7;
  }

  // AI tool signatures found
  if (meta.aiSignatures.length > 0) {
    findings.push({ type: 'critical', message: `AI tool signature detected: ${meta.aiSignatures.join(', ')}`, weight: 0.8 });
    suspicionScore += 0.8;
  }

  // Missing EXIF on JPEG — mild signal only (social media strips EXIF too)
  if (!meta.exifFound && meta.isJpeg) {
    findings.push({ type: 'info', message: 'No EXIF data found — common in AI-generated or social media images', weight: 0.1 });
    suspicionScore += 0.1;
  }

  // PNG without EXIF + matching AI-only dimensions = very mild suspicion
  // Exclude common monitor resolutions to avoid flagging screenshots
  if (meta.isPng && !meta.exifFound) {
    const monitorResolutions = [1920, 1080, 2560, 1440, 3840, 2160, 1366, 768, 1536, 864, 1280, 720];
    const isMonitorRes = monitorResolutions.includes(width) && monitorResolutions.includes(height);

    if (!isMonitorRes) {
      const aiOnlyDimensions = [256, 512, 768, 1024, 1344, 1792];
      const matchesDim = aiOnlyDimensions.includes(width) || aiOnlyDimensions.includes(height);
      const ratio = width / height;
      const commonAIRatios = [1, 1.333, 0.75, 1.778, 0.5625, 1.5, 0.667];
      const matchesRatio = commonAIRatios.some(r => Math.abs(ratio - r) < 0.02);

      if (matchesDim && matchesRatio) {
        findings.push({ type: 'info', message: 'PNG with AI-typical dimensions and aspect ratio', weight: 0.12 });
        suspicionScore += 0.12;
      } else if (matchesDim) {
        findings.push({ type: 'info', message: 'PNG with AI-common resolution', weight: 0.05 });
        suspicionScore += 0.05;
      }
    }
  }

  // Check file size to resolution ratio
  const pixelCount = width * height;
  const bytesPerPixel = file.size / pixelCount;
  if (bytesPerPixel < 0.3 && meta.isJpeg) {
    findings.push({ type: 'info', message: 'Unusually high compression ratio', weight: 0.1 });
    suspicionScore += 0.1;
  }

  // Check aspect ratio
  const ratio = width / height;
  const commonAIRatios = [1, 1.333, 0.75, 1.778, 0.5625, 1.5, 0.667];
  const isCommonRatio = commonAIRatios.some(r => Math.abs(ratio - r) < 0.02);
  if (isCommonRatio && !meta.isPng) {
    findings.push({ type: 'info', message: `Standard AI aspect ratio (${width}x${height})`, weight: 0.05 });
    suspicionScore += 0.05;
  }

  // Common AI resolution patterns
  const commonAIDimensions = [512, 768, 1024, 1536, 2048, 1080, 1920];
  if ((commonAIDimensions.includes(width) || commonAIDimensions.includes(height)) && !meta.isPng) {
    findings.push({ type: 'info', message: 'Resolution matches common AI generation size', weight: 0.05 });
    suspicionScore += 0.05;
  }

  if (findings.length === 0) {
    findings.push({ type: 'pass', message: 'No suspicious metadata patterns detected', weight: 0 });
  }

  return {
    findings,
    stats: {
      suspicionScore: Math.min(1, suspicionScore),
      exifPresent: meta.exifFound,
      hasC2PA: meta.hasC2PA,
      make: meta.make || null,
      model: meta.model || null,
      software: meta.software || null,
      dateTime: meta.dateTime || null,
      fileFormat: meta.isJpeg ? 'JPEG' : meta.isPng ? 'PNG' : meta.isWebP ? 'WebP' : 'Other',
      fileSize: file.size,
      dimensions: `${width}x${height}`,
      bytesPerPixel: Math.round(bytesPerPixel * 100) / 100,
      aiToolsDetected: meta.aiSignatures,
    },
  };
}
