import tailwindcss from '@tailwindcss/vite'
import { themeInitializationScript } from './app/design-core/theme'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-05',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  // shadcn-vue sources live in app/components/ui and are imported explicitly (no auto-import).
  components: [{ path: '~/components', ignore: ['ui/**'] }],
  // Manrope variable font is bundled locally (OFL 1.1); no external font request.
  css: ['@fontsource-variable/manrope', '~/assets/styles/base.css'],
  vite: { plugins: [tailwindcss()] },
  runtimeConfig: { public: { apiBase: 'http://localhost:8000' } },
  app: {
    head: {
      title: 'PingoFin',
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        {
          name: 'viewport',
          // viewport-fit exposes safe areas; resizes-content keeps the chat composer above the virtual keyboard.
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
        },
      ],
      script: [{ innerHTML: themeInitializationScript, tagPosition: 'head' }],
    },
  },
})
