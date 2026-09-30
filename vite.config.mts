import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  base: "/static/build/",
  plugins: [tailwindcss()],
  build: {
    outDir: resolve(root, "web/static/build"),
    emptyOutDir: true,
    sourcemap: false,
    target: "chrome100",
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        runtime: resolve(root, "frontend/entries/runtime.ts"),
        broadcast: resolve(root, "frontend/entries/broadcast.ts"),
        studio: resolve(root, "frontend/entries/studio.ts"),
        controlCenter: resolve(root, "frontend/entries/control-center.ts"),
        platformConnectors: resolve(root, "frontend/entries/platform-connectors.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: asset => asset.name?.endsWith(".css") ? "[name][extname]" : "assets/[name]-[hash][extname]"
      }
    }
  }
});
