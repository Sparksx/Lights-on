import { defineConfig } from 'vite';
import { resolve } from 'path';

// When the backend isn't running, proxy errors must send a response
// to the browser — otherwise requests hang and block script loading.
function handleProxyError(proxy) {
  proxy.on('error', (err, req, res) => {
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('');
    }
  });
}

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
        configure: handleProxyError,
      },
      '/auth': {
        target: 'http://localhost:3000',
        configure: handleProxyError,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        configure: handleProxyError,
      },
    },
  },
});
