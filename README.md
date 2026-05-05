# AI Pixel Detector

Pixel-level forensic tool that detects AI-generated and AI-edited regions in images. Everything runs in your browser — no images are uploaded anywhere.

Upload any JPEG, PNG, or WebP image and get a visual heatmap showing which pixels were likely generated or modified by AI (red) versus authentic camera-captured regions (green).

## How It Works

The tool combines five independent forensic analysis engines into a single composite heatmap:

| Engine | What It Does |
|--------|-------------|
| **Error Level Analysis (ELA)** | Re-compresses the image and measures pixel-level differences. AI-generated regions compress more uniformly than camera noise. |
| **Noise Pattern Analysis** | Applies a Laplacian high-pass filter and compares noise variance across 16x16 blocks. Real photos have consistent sensor noise; AI images have synthetic or missing noise. |
| **Frequency Domain Analysis** | Runs 2D DCT on 8x8 blocks and measures high-frequency content distribution. AI generators produce characteristic frequency signatures. |
| **Clone/Copy-Move Detection** | Hashes image blocks and finds near-duplicate regions that indicate copy-paste manipulation. |
| **Metadata & C2PA Analysis** | Parses EXIF, XMP, PNG chunks, and raw bytes for AI tool signatures (OpenAI, ChatGPT, DALL-E, Midjourney, Stable Diffusion, etc.) and C2PA content credentials. |

Each engine produces a per-pixel or per-block suspicion score. These are weighted and combined into a composite heatmap overlaid on the original image.

## Detected AI Tools

The metadata engine scans for signatures from:

- OpenAI / ChatGPT / GPT-4o / DALL-E
- Midjourney
- Stable Diffusion / ComfyUI / Automatic1111
- Adobe Firefly
- Google Imagen / Gemini
- Flux / Ideogram / Leonardo.AI
- Runway ML / Sora / NovelAI
- Bing Image Creator / Copilot Designer
- C2PA / JUMBF content credentials

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **React 19** — single client component, no server-side processing
- **HTML5 Canvas API** — all image processing done in pure JavaScript
- **Zero external dependencies** for analysis — no TensorFlow, no ONNX, no WASM

## Running Locally

```bash
git clone https://github.com/gauravbatule/pixel-level-ai-detector.git
cd pixel-level-ai-detector
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Privacy

All analysis runs client-side in your browser. No images are transmitted to any server. No data is collected.

## License

MIT
