import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  experimental: {
    // Giảm memory webpack giữ trong lúc compile
    webpackMemoryOptimizations: true,
  },
  webpack: (config) => {
    // Xử lý 1 module mỗi lúc thay vì song song → giảm peak memory
    config.parallelism = 1;
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com"
      }
    ]
  }
};

export default nextConfig;
