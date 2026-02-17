import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    copyPublicDir: false,
  },
  server: {
    port: 8000,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
      '/auth': {
        target: 'http://localhost:3000',
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
    },
  },
});
