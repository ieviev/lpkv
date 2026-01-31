import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { resolve } from "path";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
});
