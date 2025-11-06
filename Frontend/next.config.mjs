// next.config.mjs
import createMDX from "@next/mdx";
const withMDX = createMDX({ extension: /\.mdx?$/ });

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["razorpay"],
  outputFileTracingRoot: process.cwd(),

  images: {
    // Add 'domains' for a broad allow-list (coexists with remotePatterns)
    domains: ["res.cloudinary.com", "nazmi-boutique-2.onrender.com", "localhost", "127.0.0.1"],

    formats: ["image/avif", "image/webp"],

    // Be permissive with paths so any Cloudinary transformation/version works
    remotePatterns: [
      // Cloudinary (entire host)
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      // If you ever have old http links, uncomment the next line:
      // { protocol: "http", hostname: "res.cloudinary.com", pathname: "/**" },

      // Render backend (if it ever returns absolute file URLs)
      { protocol: "https", hostname: "nazmi-boutique-2.onrender.com", pathname: "/**" },

      // Local dev API (adjust ports as needed)
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/**" },
    ],
  },

  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
};

export default withMDX(nextConfig);
