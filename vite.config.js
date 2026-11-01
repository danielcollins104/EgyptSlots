import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityApiPlugin } from './server/vitePluginSecurity.js';

export default defineConfig({
  plugins: [react(), securityApiPlugin()],
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
