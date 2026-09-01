import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 4610,
    proxy: {
      "/v1": "http://localhost:4600",
      "/healthz": "http://localhost:4600",
    },
  },
});
