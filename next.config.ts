import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Coin logos are served from CoinGecko's CDN.
    remotePatterns: [
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
    ],
  },
};

export default nextConfig;
