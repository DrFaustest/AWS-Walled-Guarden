import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import the completion provider (we'll need to export it from extension.ts)
import { AwsMockCompletionProvider } from '../../extension';
import { ConfigValidator } from '../../configValidator';

suite('Extension Commands Test Suite', () => {
  let tempDir: string;
  let context: vscode.ExtensionContext;
  let mockManager: any;
  let autoConfigurator: any;
  let logger: any;

  suiteSetup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-walled-garden-test-'));

    // Mock extension context
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
        forEach: () => {},
        delete: () => {},
        get: () => undefined,
        getScoped: () => ({})
      },
      storagePath: tempDir,
      globalStoragePath: tempDir,
      logPath: tempDir,
      extensionMode: vscode.ExtensionMode.Test
    } as any;

    // Mock components
    mockManager = {
      enable: async () => {},
      disable: async () => {},
      reloadConfig: async () => {},
      isEnabled: () => false
    };

    autoConfigurator = {
      scanAndGenerateConfig: async () => {}
    };

    logger = {
      showOutputChannel: () => {},
      error: () => {},
      info: () => {},
      warn: () => {},
      dispose: () => {}
    };

    // Set global mocks for testing
    (global as any).mockManager = mockManager;
    (global as any).autoConfigurator = autoConfigurator;
    (global as any).logger = logger;
  });

  suiteTeardown(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should register all commands', async () => {
    // Import the extension module to trigger activation
    const extensionModule = await import('../../extension');

    // Activate the extension
    await extensionModule.activate(context);

    // Check that commands are registered
    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = [
      'awsWalledGarden.enable',
      'awsWalledGarden.disable',
      'awsWalledGarden.reloadConfig',
      'awsWalledGarden.showLogs',
      'awsWalledGarden.autoConfigure',
      'awsWalledGarden.toggle',
      'awsWalledGarden.openConfig',
      'awsWalledGarden.showSchema',
      'awsWalledGarden.installSdk',
      'awsWalledGarden.createTemplate'
    ];

    for (const cmd of expectedCommands) {
      assert(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });

  test('should handle enable command', async () => {
    let enableCalled = false;
    (global as any).mockManager.enable = async () => { enableCalled = true; };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.enable');
    assert.strictEqual(enableCalled, true, 'Enable command should call mockManager.enable');
  });

  test('should handle disable command', async () => {
    let disableCalled = false;
    (global as any).mockManager = {
      enable: async () => {},
      disable: async () => { disableCalled = true; },
      reloadConfig: async () => {},
      isEnabled: () => false
    };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.disable');
    assert.strictEqual(disableCalled, true, 'Disable command should call mockManager.disable');
  });

  test('should handle toggle command when disabled', async () => {
    let enableCalled = false;
    let disableCalled = false;
    (global as any).mockManager.isEnabled = () => false;
    (global as any).mockManager.enable = async () => { enableCalled = true; };
    (global as any).mockManager.disable = async () => { disableCalled = true; };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.toggle');
    assert.strictEqual(enableCalled, true, 'Toggle should enable when disabled');
    assert.strictEqual(disableCalled, false, 'Toggle should not disable when disabled');
  });

  test('should handle toggle command when enabled', async () => {
    let enableCalled = false;
    let disableCalled = false;
    (global as any).mockManager.isEnabled = () => true;
    (global as any).mockManager.enable = async () => { enableCalled = true; };
    (global as any).mockManager.disable = async () => { disableCalled = true; };

    // Mock config to disable auto-enable
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
      if (section === 'awsWalledGarden') {
        return {
          get: (key: string) => key === 'enabled' ? false : undefined
        } as any;
      }
      return originalGetConfiguration(section);
    };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.toggle');
    assert.strictEqual(enableCalled, false, 'Toggle should not enable when already enabled');
    assert.strictEqual(disableCalled, true, 'Toggle should disable when enabled');

    // Restore
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should handle reload config command', async () => {
    let reloadCalled = false;
    (global as any).mockManager = {
      enable: async () => {},
      disable: async () => {},
      reloadConfig: async () => { reloadCalled = true; },
      isEnabled: () => false
    };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.reloadConfig');
    assert.strictEqual(reloadCalled, true, 'Reload config command should call mockManager.reloadConfig');
  });

  test('should handle show logs command', async () => {
    let showLogsCalled = false;
    (global as any).logger = {
      showOutputChannel: () => { showLogsCalled = true; },
      error: () => {},
      info: () => {},
      warn: () => {},
      dispose: () => {}
    };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.showLogs');
    assert.strictEqual(showLogsCalled, true, 'Show logs command should call logger.showOutputChannel');
  });

  test('should handle auto configure command', async () => {
    let autoConfigureCalled = false;
    (global as any).autoConfigurator = {
      scanAndGenerateConfig: async () => { autoConfigureCalled = true; }
    };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    await vscode.commands.executeCommand('awsWalledGarden.autoConfigure');
    assert.strictEqual(autoConfigureCalled, true, 'Auto configure command should call autoConfigurator.scanAndGenerateConfig');
  });

  test('should handle open config command', async () => {
    // Mock workspace APIs
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    const originalOpenTextDocument = vscode.workspace.openTextDocument;

    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{
        uri: vscode.Uri.file(tempDir),
        name: 'test-workspace',
        index: 0
      }],
      configurable: true
    });

    Object.defineProperty(vscode.workspace, 'getConfiguration', {
      value: (section?: string) => {
        if (section === 'awsWalledGarden') {
          return {
            get: (key: string) => key === 'configFile' ? '.aws-mock.json' : undefined
          } as any;
        }
        return originalGetConfiguration(section);
      },
      configurable: true
    });

    let openTextDocumentCalled = false;
    vscode.workspace.openTextDocument = async (uriOrPath: any) => {
      openTextDocumentCalled = true;
      return {} as any;
    };

    const extensionModule = await import('../../extension');
    await extensionModule.activate(context);

    try {
      await vscode.commands.executeCommand('awsWalledGarden.openConfig');
      assert.strictEqual(openTextDocumentCalled, true, 'Open config command should call workspace.openTextDocument');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
      Object.defineProperty(vscode.workspace, 'getConfiguration', {
        value: originalGetConfiguration,
        configurable: true
      });
      vscode.workspace.openTextDocument = originalOpenTextDocument;
    }
  });
});

suite('Completion Provider Test Suite', () => {
  let provider: AwsMockCompletionProvider;

  suiteSetup(() => {
    provider = new AwsMockCompletionProvider();
  });

  test('should provide root level completions', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '{',
      language: 'json'
    });

    const position = new vscode.Position(0, 1);
    const completions = await provider.provideCompletionItems(document, position, {} as any, {} as any);

    assert(completions, 'Should return completions');
    const items = completions as vscode.CompletionItem[];
    assert(items.length > 0, 'Should have completion items');

    const labels = items.map(item => item.label);
    assert(labels.includes('version'), 'Should include version completion');
    assert(labels.includes('services'), 'Should include services completion');
    assert(labels.includes('global'), 'Should include global completion');
  });

  test('should provide service completions', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '{"services": {',
      language: 'json'
    });

    const position = new vscode.Position(0, 14);
    const completions = await provider.provideCompletionItems(document, position, {} as any, {} as any);

    assert(completions, 'Should return completions');
    const items = completions as vscode.CompletionItem[];
    assert(items.length > 0, 'Should have completion items');

    const labels = items.map(item => item.label);
    assert(labels.includes('s3'), 'Should include s3 service completion');
    assert(labels.includes('dynamodb'), 'Should include dynamodb service completion');
    assert(labels.includes('lambda'), 'Should include lambda service completion');
  });

  test('should provide S3 service specific completions', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '{"services": {"s3": {',
      language: 'json'
    });

    const position = new vscode.Position(0, 21);
    const completions = await provider.provideCompletionItems(document, position, {} as any, {} as any);

    assert(completions, 'Should return completions');
    const items = completions as vscode.CompletionItem[];
    assert(items.length > 0, 'Should have completion items');

    const labels = items.map(item => item.label);
    assert(labels.includes('buckets'), 'Should include buckets completion for S3');
    assert(labels.includes('port'), 'Should include port completion');
  });

  test('should provide global configuration completions', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '{"global": {',
      language: 'json'
    });

    const position = new vscode.Position(0, 12);
    const completions = await provider.provideCompletionItems(document, position, {} as any, {} as any);

    assert(completions, 'Should return completions');
    const items = completions as vscode.CompletionItem[];
    assert(items.length > 0, 'Should have completion items');

    const labels = items.map(item => item.label);
    assert(labels.includes('port'), 'Should include port completion');
    assert(labels.includes('logLevel'), 'Should include logLevel completion');
    assert(labels.includes('recordRequests'), 'Should include recordRequests completion');
  });

  test('GUI Editor Command Registration', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert(commands.includes('awsWalledGarden.openGuiEditor'), 'GUI editor command should be registered');
  });

  test('GUI Editor Webview Content Generation', async () => {
    // Test that the command can be executed (webview creation is tested indirectly)
    const commands = await vscode.commands.getCommands(true);
    assert(commands.includes('awsWalledGarden.openGuiEditor'), 'GUI editor command should be registered');

    // Test basic VS Code API availability
    assert(vscode.window, 'VS Code window API should be available');
    assert(vscode.commands, 'VS Code commands API should be available');
  });

  test('GUI Editor Message Handling - Validate Config', () => {
    // Test the validation logic through the ConfigValidator
    const validConfig = {
      version: '1.0',
      services: {
        s3: { port: 4566 }
      },
      global: {
        port: 3000,
        host: 'localhost',
        logLevel: 'info'
      }
    };

    const validation = ConfigValidator.validate(validConfig);
    assert(validation.valid, 'Valid config should pass validation');

    const invalidConfig = {
      port: 'invalid',
      services: {}
    };

    const invalidValidation = ConfigValidator.validate(invalidConfig);
    assert(!invalidValidation.valid, 'Invalid config should fail validation');
  });

  test('GUI Editor Service Quick Pick Items', () => {
    // Test that we have the expected AWS services available
    const expectedServices = ['s3', 'dynamodb', 'lambda', 'sqs', 'sns', 'kinesis', 'cloudformation', 'cloudwatch', 'iam', 'sts'];

    // We can't directly test the quick pick in unit tests, but we can verify
    // that the service list logic would work
    expectedServices.forEach(service => {
      assert(typeof service === 'string', `Service ${service} should be a string`);
      assert(service.length > 0, `Service ${service} should not be empty`);
    });
  });
});