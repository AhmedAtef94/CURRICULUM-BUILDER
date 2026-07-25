import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site under /<repo-name>/, not the domain root,
// so assets must be requested from that sub-path. The deploy workflow passes
// the repo name in via VITE_BASE; local dev and other hosts fall back to "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, open: true },
});
