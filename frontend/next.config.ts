import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path((?:.*)\\.wav)",
        headers: [
          {
            key: "Content-Type",
            value: "audio/wav",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
