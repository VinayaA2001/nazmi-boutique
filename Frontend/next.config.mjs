// next.config.mjs
import createMDX from "@next/mdx";

const withMDX = createMDX({ extension: /\.mdx?$/ });

/** @type {import('next').NextConfig} */
const baseConfig = {
  serverExternalPackages: ["razorpay"],
  outputFileTracingRoot: process.cwd(),

  images: {
    // Allow these hosts (works alongside remotePatterns)
    domains: ["res.cloudinary.com", "nazmi-boutique-2.onrender.com", "localhost", "127.0.0.1"],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Cloudinary (any path)
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      // Backend absolute URLs (Render)
      { protocol: "https", hostname: "nazmi-boutique-2.onrender.com", pathname: "/**" },
      // Local dev backend
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/**" },
    ],
  },

  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,

  // ✅ proxy all /api/* to your Flask backend
  async rewrites() {
    const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
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
