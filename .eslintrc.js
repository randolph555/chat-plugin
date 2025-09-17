module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  globals: {
    chrome: 'readonly',
    // 我们的全局类
    GitHubAPI: 'readonly',
    LLMManager: 'readonly',
    ContextManager: 'readonly',
    FileReferenceManager: 'readonly',
    ImageHandler: 'readonly',
    StorageManager: 'readonly',
    MessageRenderer: 'readonly',
    ChatWindow: 'readonly',
    GitHubChatAssistant: 'readonly'
  },
  rules: {
    // 错误级别规则
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'no-console': 'off', // 允许console，因为这是调试工具
    'prefer-const': 'error',
    'no-var': 'error',
    
    // 代码风格
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'comma-dangle': ['error', 'never'],
    
    // 最佳实践
    'eqeqeq': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // ES6+
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    
    // 异步处理
    'no-async-promise-executor': 'error',
    'require-await': 'warn',
    
    // Chrome Extension 特定
    'no-chrome-extension-specific': 'off'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-undef': 'off' // Jest全局函数
      }
    },
    {
      files: ['scripts/build.js', 'scripts/dev.js'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-console': 'off'
      }
    }
  ]
};