export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://ai-pixel-detector.vercel.app/sitemap.xml",
  };
}
