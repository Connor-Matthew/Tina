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
      },
      preload: {
        input: 'src/preload/index.ts',
      },
    }),
  ],
})
