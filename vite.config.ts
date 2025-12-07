import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        '@tauri-apps/api',
        '@tauri-apps/plugin-updater',
        '@tauri-apps/plugin-process',
        '@tauri-apps/plugin-http',
      ],
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
