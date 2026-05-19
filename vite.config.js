import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

const BACKEND = "http://127.0.0.1:8010";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/.netlify/functions": { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react")) return "react-core";
        },
      },
    },
  },
});
