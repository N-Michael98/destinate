import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    PYTHON_BACKEND_URL:
      process.env.PYTHON_BACKEND_URL ||
      "http://exquisite-rejoicing.railway.internal:8000",
  },
};

export default nextConfig;
