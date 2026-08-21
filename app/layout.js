import "./globals.css";

const SITE_URL = "https://aidetector.synthrex.in";
const TITLE = "AI Detect — Pixel-Level AI & Inpainting Detection by Synthrex";
const DESCRIPTION =
  "Enterprise-grade forensic suite for detecting AI-generated and manipulated pixels in images. Real-time PRNU sensor noise profiling, chromatic illuminant vector analysis, and splice seam localization.";

export const metadata = {
  title: {
    default: TITLE,
    template: "%s | AI Detect by Synthrex",
  },
  description: DESCRIPTION,
  keywords: [
    "AI Detect",
    "Synthrex",
    "aidetector.synthrex.in",
    "AI image detection",
    "pixel level AI detector",
    "detect AI generated images",
    "image forensics",
    "PRNU sensor noise",
    "error level analysis",
    "C2PA provenance",
    "deepfake detector",
    "AI inpainting detection",
    "ChatGPT image detection",
    "DALL-E detection",
    "Midjourney detection",
  ],
  authors: [{ name: "Synthrex", url: "https://synthrex.in" }],
  creator: "Synthrex",
  publisher: "Synthrex",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "AI Detect — Synthrex",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1024,
        height: 1024,
        alt: "AI Detect by Synthrex Logo & Interface",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/synthrex_logo.jpg",
    apple: "/synthrex_logo.jpg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/synthrex_logo.jpg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
