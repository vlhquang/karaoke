import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  typescript: {
    // Disable type checking during next build (run separately to save memory)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Disable linting during next build (run separately to save memory)
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Giảm memory webpack giữ trong lúc compile
    webpackMemoryOptimizations: true,
    workerThreads: false,
    cpus: 1,
    optimizePackageImports: [
      "lucide-react",
      "three",
      "@react-three/fiber",
      "@react-three/drei"
    ],
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
