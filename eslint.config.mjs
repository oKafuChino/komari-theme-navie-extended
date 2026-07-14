import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    ignores: ['docs/superpowers/**'],
    unocss: true,
    vue: true,
  },
  {
    files: ['tests/**/*.test.mjs'],
    rules: {
      'test/no-import-node-test': 'off',
    },
  },
)
