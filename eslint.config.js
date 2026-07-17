import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import ts from 'typescript-eslint';

export default defineConfig([
    globalIgnores(
        ['dist/**/*'],
        'Ignore build output',
    ),
    js.configs.recommended,
    ...ts.configs.recommended,
    {
        files: ['**/*.ts'],
        plugins: {
            import: importPlugin,
            'unused-imports': unusedImports,
        },
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'unused-imports/no-unused-imports': 'error',
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import/newline-after-import': ['error', { count: 1 }],
            'import/no-duplicates': 'error',
        },
    },
]);
