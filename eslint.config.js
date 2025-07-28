import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-node';
import prettier from 'eslint-plugin-prettier';

export default [
  // Ignore patterns (from .eslintignore)
  {
    ignores: [
      'public/**',
      'tmp/**',
      'log/**',
      'db/**',
      'vendor/**',
      'coverage/**',
      '.bundle/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      'electron-out/**',
      'app/assets/builds/**',
      'app/assets/stylesheets/**',
      'llm_docs/**',
      'config/environments/**',
      'config/initializers/**',
      'config/locales/**',
      'test/fixtures/**',
      'scripts/**',
      '*.rb',
      'Gemfile',
      'Rakefile',
      '*.log',
      '*.sql',
      '*.sqlite3',
      '.env*',
    ],
  },
  js.configs.recommended,
  {
    plugins: {
      prettier,
      import: importPlugin,
      node: nodePlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',

        // DOM APIs
        HTMLElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLTemplateElement: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        MessageEvent: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        customElements: 'readonly',
        CSS: 'readonly',
        DOMParser: 'readonly',
        navigator: 'readonly',
        MutationObserver: 'readonly',

        // Web APIs
        WebSocket: 'readonly',
        EventSource: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',

        // Rails/Turbo/Stimulus globals
        Turbo: 'readonly',
        Stimulus: 'readonly',
        Rails: 'readonly',

        // Node.js globals for Electron files
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // General JavaScript rules
      'no-console': 'off', // Console is fine for Rails apps
      'no-debugger': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-escape': 'warn',

      // Import rules
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': 'error',
      'import/newline-after-import': 'error',

      // Stimulus-friendly rules
      'class-methods-use-this': 'off', // Stimulus controllers often have methods that don't use 'this'
      'no-new': 'off', // new Stimulus.Application() is common

      // Rails-friendly rules
      camelcase: [
        'error',
        {
          properties: 'never', // Rails uses snake_case for data attributes
          ignoreDestructuring: true,
          allow: ['^data_', '^UNSAFE_'], // Allow data_ prefixes
        },
      ],
    },
  },
  {
    // Specific rules for Stimulus controllers
    files: ['app/javascript/controllers/**/*.js'],
    rules: {
      'import/prefer-default-export': 'off', // Stimulus controllers export as default
    },
  },
  {
    // Specific rules for Electron files
    files: ['electron/**/*.js', 'electron*.js'],
    languageOptions: {
      sourceType: 'commonjs', // Electron uses CommonJS
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    // Rails application.js and other entry points
    files: ['app/javascript/application.js', 'app/assets/javascripts/**/*.js'],
    rules: {
      'import/no-unresolved': 'off', // Rails handles imports differently
    },
  },
];
