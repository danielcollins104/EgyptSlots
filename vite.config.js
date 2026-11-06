import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityApiPlugin } from './server/vitePluginSecurity.js';

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
  plugins: [react(), securityApiPlugin(), nonBlockingCssPlugin()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-graphics': ['pixi.js', 'gsap']
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
