import { node } from '@jubstaa/config/eslint/node'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    globalIgnores(['dist']),
    ...node({ tsconfigRootDir: import.meta.dirname }),
    {
        files: ['test/**'],
        rules: { 'perfectionist/sort-sets': 'off' },
    },
])
