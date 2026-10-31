import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityApiPlugin } from './server/vitePluginSecurity.js';

export default defineConfig({
  plugins: [react(), securityApiPlugin()],
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/*.zip', '**/commercial_assets/**', '**/dist/**']
    }
  }
});
