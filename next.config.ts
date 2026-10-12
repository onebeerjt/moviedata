import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read the generated JSON from disk at request time.
  outputFileTracingIncludes: {
    "/*": ["./data/site/**/*"],
  },
  // The Free page grew into "Find a movie" (free + your services) at /watch.
  async redirects() {
    return [{ source: "/free", destination: "/watch", permanent: true }];
  },
};

export default nextConfig;
