import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // `''` loads every key, not just the VITE_-prefixed ones the browser sees.
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';

  // `true` binds every interface — what a forwarded port or another device on
  // the network needs. Anything else is passed through as a hostname, so the
  // literal strings "false"/"" must be mapped to false or Vite tries to resolve
  // them as a host and fails to start.
  const hostEnv = String(env.VITE_HOST || '').trim().toLowerCase();
  const host = hostEnv === 'true' ? true
    : (hostEnv === '' || hostEnv === 'false') ? false
      : env.VITE_HOST.trim();

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_PORT) || 5173,
      host,
      // Keeps the browser on one origin in development — no CORS preflight, no
      // token juggling. Skipped when VITE_API_URL points at another host, since
      // the app then calls the API directly.
      proxy: env.VITE_API_URL ? undefined : {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
      },
    },
  };
});
