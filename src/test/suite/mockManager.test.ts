import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { MockManager } from '../../mockManager';

suite('MockManager Test Suite', () => {
  let tempDir: string;
  let mockManager: MockManager;
  let context: vscode.ExtensionContext;

  suiteSetup(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-walled-garden-test-'));

    // Mock VS Code extension context
    context = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => []
      },
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
        setKeysForSync: () => {}
      },
      extensionPath: tempDir,
      extensionUri: vscode.Uri.file(tempDir),
      environmentVariableCollection: {
        persistent: false,
        description: '',
        variables: {},
        prepend: () => {},
        append: () => {},
        replace: () => {},
        clear: () => {},
        get: () => undefined,
        forEach: () => {},
        delete: () => {},
        getScoped: () => ({})
      },
      storagePath: tempDir,
      globalStoragePath: tempDir,
      logPath: tempDir,
      extensionMode: vscode.ExtensionMode.Test
    } as any;
  });

  suiteTeardown(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  setup(() => {
    mockManager = new MockManager(context);
  });

  teardown(async () => {
    // Properly disable mock manager to stop proxy server
    if (mockManager && mockManager.isEnabled()) {
      await mockManager.disable();
    }
  });

  test('should initialize with disabled state', () => {
    assert.strictEqual(mockManager.isEnabled(), false, 'Mock manager should start disabled');
  });

  test('should enable mock manager', async () => {
    await mockManager.enable();
    assert.strictEqual(mockManager.isEnabled(), true, 'Mock manager should be enabled after enable()');
  });

  test('should disable mock manager', async () => {
    await mockManager.enable();
    assert.strictEqual(mockManager.isEnabled(), true, 'Should be enabled first');

    await mockManager.disable();
    assert.strictEqual(mockManager.isEnabled(), false, 'Mock manager should be disabled after disable()');
  });

  test('should handle enable when already enabled', async () => {
    await mockManager.enable();
    assert.strictEqual(mockManager.isEnabled(), true);

    // Should not throw when enabling again
    await mockManager.enable();
    assert.strictEqual(mockManager.isEnabled(), true);
  });

  test('should handle disable when already disabled', async () => {
    assert.strictEqual(mockManager.isEnabled(), false);

    // Should not throw when disabling again
    await mockManager.disable();
    assert.strictEqual(mockManager.isEnabled(), false);
  });

  test('should reload configuration', async () => {
    // Create a test config file
    const configPath = path.join(tempDir, '.aws-mock.json');
    const testConfig = {
      version: '1.0',
      services: {
        s3: {
          buckets: {}
        }
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

    // Mock workspace APIs
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    // Create a mock workspace
    Object.defineProperty(vscode.workspace, 'getConfiguration', {
      value: (section?: string) => {
        if (section === 'awsWalledGarden') {
          return {
            get: (key: string) => {
              if (key === 'configFile') return '.aws-mock.json';
              return undefined;
            }
          } as any;
        }
        return originalGetConfiguration(section);
      },
      configurable: true
    });

    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{
        uri: vscode.Uri.file(tempDir),
        name: 'test-workspace',
        index: 0
      }],
      configurable: true
    });

    try {
      await mockManager.reloadConfig();
      // If no error is thrown, the test passes
      assert.ok(true, 'Configuration reload should succeed');
    } finally {
      // Restore original implementations
      Object.defineProperty(vscode.workspace, 'getConfiguration', {
        value: originalGetConfiguration,
        configurable: true
      });
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
    }
  });

  test('should handle missing configuration file gracefully', async () => {
    // Mock workspace APIs
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    Object.defineProperty(vscode.workspace, 'getConfiguration', {
      value: (section?: string) => {
        if (section === 'awsWalledGarden') {
          return {
            get: (key: string) => {
              if (key === 'configFile') return 'non-existent-config.json';
              return undefined;
            }
          } as any;
        }
        return originalGetConfiguration(section);
      },
      configurable: true
    });

    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{
        uri: vscode.Uri.file(tempDir),
        name: 'test-workspace',
        index: 0
      }],
      configurable: true
    });

    try {
      await mockManager.reloadConfig();
      // Should not throw error for missing config file
      assert.ok(true, 'Should handle missing config file gracefully');
    } finally {
      // Restore original implementations
      Object.defineProperty(vscode.workspace, 'getConfiguration', {
        value: originalGetConfiguration,
        configurable: true
      });
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
    }
  });
});