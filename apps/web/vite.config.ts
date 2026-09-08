import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: { dedupe: ["react", "react-dom", "remotion"] },
  plugins: [vue(), tailwindcss()],
  server: {
    port: 4621,
    strictPort: true,
    watch: { usePolling: true },
    proxy: {
      "/v1": "http://127.0.0.1:4620",
      "/healthz": "http://127.0.0.1:4620",
    },
  },
});
