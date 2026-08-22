import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Prototyping-era code leans on `any` in a few Firestore helpers;
      // keep this a warning rather than a hard build failure for now.
      '@typescript-eslint/no-explicit-any': 'warn',
      // UI copy is French and apostrophes (l'app, aujourd'hui...) are everywhere;
      // escaping every one as &apos; would hurt readability for no real benefit.
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default eslintConfig
