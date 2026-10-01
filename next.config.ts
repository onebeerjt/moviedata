import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read the generated JSON from disk at request time.
  outputFileTracingIncludes: {
    "/*": ["./data/site/**/*"],
  },
};

export default nextConfig;
