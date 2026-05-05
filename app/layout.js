import "./globals.css";

const SITE_URL = "https://ai-pixel-detector.vercel.app";
const TITLE = "AI Pixel Detector — Detect AI-Edited Pixels in Any Image";
const DESCRIPTION =
  "Free, open-source pixel-level forensic tool that detects AI-generated and AI-edited regions in images. Runs entirely in your browser — no uploads, no server.";

export const metadata = {
  title: {
    default: TITLE,
    template: "%s | AI Pixel Detector",
  },
  description: DESCRIPTION,
  keywords: [
    "AI image detection",
    "AI pixel detector",
    "detect AI generated images",
    "image forensics",
    "error level analysis",
    "C2PA detection",
    "deepfake detector",
    "AI art detector",
    "ChatGPT image detection",
    "DALL-E detection",
    "Midjourney detection",
    "image manipulation detection",
    "pixel level analysis",
    "open source",
  ],
  authors: [{ name: "Gaurav Batule", url: "https://github.com/gauravbatule" }],
  creator: "Gaurav Batule",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "AI Pixel Detector",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "AI Pixel Detector",
              description: DESCRIPTION,
              url: SITE_URL,
              applicationCategory: "SecurityApplication",
              operatingSystem: "Any",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              author: {
                "@type": "Person",
                name: "Gaurav Batule",
                url: "https://github.com/gauravbatule",
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
