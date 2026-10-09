import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt(
  { ignores: ['.tools/**'] },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': [
        'error',
        {
          html: { void: 'always', normal: 'any', component: 'always' },
          svg: 'always',
          math: 'always',
        },
      ],
    },
  },
  // shadcn-vue sources: an optional `class` prop without default is the intended pattern.
  {
    files: ['app/components/ui/**/*.vue'],
    rules: { 'vue/require-default-prop': 'off' },
  },
)
