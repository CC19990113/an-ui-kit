import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fromRoot = (file: string): string => resolve(import.meta.dirname, file);

export default defineConfig({
  plugins: [
    react(),
    // Tailwind v4 没有 PostCSS 配置，preflight 由插件在 `styles/tailwind.css` 里编译。
    tailwindcss(),
  ],
  resolve: {
    alias: [
      // Vue 页面用运行时模板（`createApp({ template })`）来验证
      // `app.config.compilerOptions.isCustomElement`，所以需要带编译器的完整构建。
      // 只替换裸 `vue`，不碰 `vue/dist/*` 之类的子路径。
      { find: /^vue$/, replacement: 'vue/dist/vue.esm-bundler.js' },
    ],
  },
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  build: {
    rollupOptions: {
      input: {
        index: fromRoot('index.html'),
        native: fromRoot('native.html'),
        react: fromRoot('react.html'),
        tailwind: fromRoot('tailwind.html'),
        vue: fromRoot('vue.html'),
      },
    },
  },
});
