import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// In dev the UI runs on :8080 and /api goes to a local axemobile-server
// (npm run server). The desktop build talks to the engine inside the app.
export default defineConfig({
  server: {
    port: 8080,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3847" },
  },
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2021" },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
