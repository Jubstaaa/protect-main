import { node } from '@jubstaa/config/eslint/node'
import { defineConfig } from 'eslint/config'

export default defineConfig([
    ...node({ tsconfigRootDir: import.meta.dirname }),
    {
        files: ['bin/**', 'src/index.mjs'],
        rules: { 'no-console': 'off' },
    },
    {
        files: ['test/**'],
        rules: { 'perfectionist/sort-sets': 'off' },
    },
])
