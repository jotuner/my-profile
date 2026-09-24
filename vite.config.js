import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        project01: 'pages/project-01.html',
        project02: 'pages/project-02.html',
        project03: 'pages/project-03.html',
        project04: 'pages/project-04.html',
      },
    },
  },
  server: {
    port: 5188,
    open: '/',
  },
});
