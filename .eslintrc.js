module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': 'warn',
    semi: 'warn',
    'brace-style': 'warn'
  }
}
