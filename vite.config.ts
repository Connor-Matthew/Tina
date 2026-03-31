import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            target: 'node18',
            lib: {
              entry: 'src/main/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.cjs',
            },
          },
        },
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          build: {
            target: 'node18',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    }),
  ],
})
