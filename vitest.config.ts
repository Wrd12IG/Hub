/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // `jsdom` non è tra le dipendenze: con l'ambiente predefinito jsdom quasi tutti i file di test non partivano. Gli ambienti che servono davvero
    // (componenti React) vanno richiesti nel file con `// @vitest-environment jsdom`, dopo aver aggiunto jsdom alle dipendenze di sviluppo.
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{ts,tsx}', '**/*.{spec,test}.{ts,tsx}'],
    exclude: [
      'node_modules', '.next',
      // Test di componenti React: richiedono jsdom e @testing-library, non ancora installati. DA RIATTIVARE quando si aggiunge jsdom.
      'components/chat/__tests__/video-call.test.tsx',
      'app/(app)/clients/[id]/meta-ads/__tests__/page.test.tsx',
      'app/(app)/clients/[id]/google-ads/__tests__/page.test.tsx',
    ],
    // Usa tsconfig dedicato ai test — moduleResolution: node invece di bundler
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
