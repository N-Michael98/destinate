import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    PYTHON_BACKEND_URL:
      process.env.PYTHON_BACKEND_URL ||
      "https://exquisite-rejoicing-production.up.railway.app",
  },
};

export default nextConfig;
