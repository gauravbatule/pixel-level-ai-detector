# Design System — Pixel Forensics Studio (Hallmark Anti-AI-Slop Edition)

A locked, precision-engineered design system built for high-stakes image forensics and pixel-level AI manipulation detection. Every view and component strictly references these tokens.

/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */

## 1. Genre
**Editorial & Modern Laboratory Workbench** (`workbench-studio-05`)
- Purpose: High-trust scientific digital forensics, PRNU sensor noise profiling, and multi-spectral inpainting localization.
- Aesthetic: Deep obsidian slate canvas, 1px architectural hairline rules, stark typographic hierarchy, and surgical signal accents.

## 2. Macrostructure Family
- Base Structure: **Workbench & Split Studio (#05 / #15)**
  - Top: Precision Navigation Bar with live engine status indicator and latency readout.
  - Core: Diptych Inspection Viewport with interactive split slider, multi-spectral view tabs, and live Hover HUD.
  - Lower Grid: Asymmetric Bento Telemetry (Verdict Card 4-col + Signal Matrix 4-col + Spatial Analysis 4-col).
  - Bottom: Benchmark Sample Vault (Quick-load paired test cases including White Modal Inpainting & Desert Red Road).

## 3. Theme Tokens (`tokens.css`)
```css
:root {
  /* Canvas & Ink (Paper + Ink + Accent model) */
  --color-paper:       oklch(0.12 0.01 260);      /* #090a0f Deep Obsidian */
  --color-paper-2:     oklch(0.16 0.015 260);     /* #11131a Elevated Slate */
  --color-paper-card:  oklch(0.18 0.018 260);     /* #151822 Card Surface */
  --color-ink:         oklch(0.98 0.005 260);     /* #f8fafc Crisp Primary Text */
  --color-ink-2:       oklch(0.72 0.02 260);      /* #94a3b8 Secondary Metadata */
  --color-ink-muted:   oklch(0.50 0.02 260);      /* #64748b Muted Labels */
  
  /* Hairline Rules */
  --color-rule:        oklch(0.24 0.01 260 / 0.4); /* 1px Architectural Hairline */
  --color-rule-active: oklch(0.40 0.02 260 / 0.8);

  /* Forensic Signal Accents (<= 5% visual footprint) */
  --color-signal-ai:    oklch(0.63 0.24 28);      /* #ef4444 Signal Crimson */
  --color-signal-auth:  oklch(0.72 0.19 155);     /* #10b981 Signal Emerald */
  --color-signal-warn:  oklch(0.76 0.18 75);      /* #f59e0b Signal Amber */
  --color-accent:       oklch(0.62 0.21 255);     /* #3b82f6 Technical Cobalt */
  --color-focus:        oklch(0.62 0.21 255);

  /* 2+1 Typographic Stack */
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body:    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  /* 4-Point Named Spacing Scale */
  --space-3xs: 0.25rem;  /* 4px */
  --space-2xs: 0.5rem;   /* 8px */
  --space-xs:  0.75rem;  /* 12px */
  --space-sm:  1rem;     /* 16px */
  --space-md:  1.5rem;   /* 24px */
  --space-lg:  2rem;     /* 32px */
  --space-xl:  3rem;     /* 48px */
  --space-2xl: 4.5rem;   /* 72px */

  /* Radii & Motion */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 180ms;
}
```

## 4. Anti-Slop Safeguards
- **Zero generic AI gradient cards**: No floating purple blobs or unconstrained blur circles.
- **Zero decorative clichés**: Every element, border, and badge conveys real cryptographic or forensic state.
- **Strict measure & line-height**: Body copy max 65ch, monospaced coordinate badges at strict 11px size.
- **8-State Interactive Completeness**: All buttons, tabs, split controls, and drag-and-drop zones support Default, Hover, Active, Focus-Visible, Loading, Disabled, Success, and Error.
- **Pre-emit Verification**: All responsive breakpoints verified at 320px, 375px, 768px, 1280px, and 1920px.
