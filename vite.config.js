import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityApiPlugin } from './server/vitePluginSecurity.js';
import { smoothPerformancePlugin } from './server/vitePluginSmoothPerformance.js';

function nonBlockingCssPlugin() {
  return {
    name: 'non-blocking-css-lcp',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet"([^>]*?)href="(\/assets\/[^"]+\.css)"([^>]*)>/g,
        '<link rel="preload" as="style"$1href="$2"$3><link rel="stylesheet"$1href="$2"$3 media="print" onload="this.media=\'all\'">'
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), securityApiPlugin(), smoothPerformancePlugin(), nonBlockingCssPlugin()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/gsap')) {
            return 'vendor-gsap';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/*.zip', '**/commercial_assets/**', '**/dist/**']
    }
  }
});
