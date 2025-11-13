// next.config.mjs
import createMDX from "@next/mdx";

const withMDX = createMDX({ extension: /\.mdx?$/ });

/** @type {import('next').NextConfig} */
const baseConfig = {
  serverExternalPackages: ["razorpay"],
  outputFileTracingRoot: process.cwd(),

  images: {
    // Next 16: explicitly declare allowed qualities used by <Image quality={...}>
    qualities: [60, 75, 80, 85, 90, 100],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "nazmi-boutique-2.onrender.com", pathname: "/**" },
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/**" },
    ],
  },

  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  // Allow dev access via LAN IPs to /_next/* assets
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...((process.env.NEXT_DEV_ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)),
  ],

  // ✅ proxy all /api/* to your Flask backend
  async rewrites() {
    const BACKEND =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:5000"
        : "https://nazmi-boutique-2.onrender.com");
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

// Wrap with MDX and export ONE default
export default withMDX(baseConfig);
