import { defineConfig } from '@vscode/test-electron';

export default defineConfig({
  launchArgs: ['--disable-extensions'],
  files: ['out/test/**/*.test.js'],
  mocha: {
    ui: 'tdd',
    color: true,
    timeout: 60000,
    slow: 5000
  }
});