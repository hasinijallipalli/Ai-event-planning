import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro({
      preset: "cloudflare-module",
      compatibilityDate: "2026-08-28",
    }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: false,
  },
});
