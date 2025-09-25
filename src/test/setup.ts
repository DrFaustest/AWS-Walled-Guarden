// Setup file for mocking vscode in tests
const mockVscode = require('./vscode-mock');

// Mock vscode globally before any test files are loaded
(global as any).vscode = mockVscode.vscode;

// Also mock it in the require cache
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return mockVscode.vscode;
  }
  return originalRequire.apply(this, arguments);
};