import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Toda la app es dinámica por usuario (cookies de sesión en cada página),
  // así que no usamos Cache Components. Ver README › Decisiones tomadas.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
