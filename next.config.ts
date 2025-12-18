import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Webpack (Turbopack usually disables if custom webpack function is present)
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
