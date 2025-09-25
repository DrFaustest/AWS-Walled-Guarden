import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MockManager } from './mockManager';
import { Logger } from './logger';
import { AutoConfigurator } from './autoConfigurator';
import { ErrorHandler } from './errorHandler';
import { ConfigValidator } from './configValidator';

let mockManager: MockManager | undefined;
let logger: Logger;
let autoConfigurator: AutoConfigurator;
let statusBarItem: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  logger = (global as any).logger || Logger.getInstance();
  logger.info('AWS Walled Garden extension is now active!');

  // Initialize the mock manager and auto configurator
  // Use global mocks if available (for testing)
  mockManager = (global as any).mockManager || new MockManager(context);
  autoConfigurator = (global as any).autoConfigurator || new AutoConfigurator();

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'awsWalledGarden.toggle';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // Create diagnostic collection for configuration validation
  diagnosticCollection = vscode.languages.createDiagnosticCollection('aws-mock-config');
  context.subscriptions.push(diagnosticCollection);

  // Register completion provider for .aws-mock.json files
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { pattern: '**/.aws-mock.json' },
    new AwsMockCompletionProvider(),
    '"', ':', '.', '/'
  );
  context.subscriptions.push(completionProvider);

  // Register commands
  const enableCommand = vscode.commands.registerCommand('awsWalledGarden.enable', async () => {
    if (!mockManager) {
      await ErrorHandler.showUserFriendlyError('Mock manager not initialized');
      return;
    }
    try {
      await mockManager.enable();
      updateStatusBar();
      await ErrorHandler.showSuccessWithActions('AWS Walled Garden enabled successfully!');
    } catch (error) {
      logger.error('Failed to enable AWS Walled Garden', error);
      await ErrorHandler.showUserFriendlyError(error);
    }
  });

  const disableCommand = vscode.commands.registerCommand('awsWalledGarden.disable', async () => {
    if (!mockManager) {
      await ErrorHandler.showUserFriendlyError('Mock manager not initialized');
      return;
    }
    try {
      await mockManager.disable();
      updateStatusBar();
      await ErrorHandler.showSuccessWithActions('AWS Walled Garden disabled successfully!');
    } catch (error) {
      logger.error('Failed to disable AWS Walled Garden', error);
      await ErrorHandler.showUserFriendlyError(error);
    }
  });

  const reloadConfigCommand = vscode.commands.registerCommand('awsWalledGarden.reloadConfig', async () => {
    if (!mockManager) {
      await ErrorHandler.showUserFriendlyError('Mock manager not initialized');
      return;
    }
    try {
      await mockManager.reloadConfig();
      updateStatusBar();
      await ErrorHandler.showSuccessWithActions('Configuration reloaded successfully!');
    } catch (error) {
      logger.error('Failed to reload AWS Walled Garden', error);
      await ErrorHandler.showUserFriendlyError(error, 'config');
    }
  });

  const showLogsCommand = vscode.commands.registerCommand('awsWalledGarden.showLogs', () => {
    logger.showOutputChannel();
  });

  const autoConfigureCommand = vscode.commands.registerCommand('awsWalledGarden.autoConfigure', async () => {
    try {
      await autoConfigurator.scanAndGenerateConfig();
      await ErrorHandler.showSuccessWithActions(
        'Auto-configuration completed successfully! Check the generated proxy configuration.',
        [
          { title: 'Open Config', isCloseAffordance: false },
          { title: 'Show Logs', isCloseAffordance: true }
        ]
      );
    } catch (error) {
      logger.error('Auto-configuration failed', error);
      await ErrorHandler.showUserFriendlyError(error, 'auto-config');
    }
  });

  const toggleCommand = vscode.commands.registerCommand('awsWalledGarden.toggle', async () => {
    const mgr = (global as any).mockManager || mockManager;
    if (!mgr) {
      await ErrorHandler.showUserFriendlyError('Mock manager not initialized');
      return;
    }
    try {
      if (mgr.isEnabled()) {
        await mgr.disable();
        await ErrorHandler.showSuccessWithActions('AWS Walled Garden disabled successfully!');
      } else {
        await mgr.enable();
        await ErrorHandler.showSuccessWithActions('AWS Walled Garden enabled successfully!');
      }
      updateStatusBar();
    } catch (error) {
      logger.error('Failed to toggle AWS Walled Garden', error);
      await ErrorHandler.showUserFriendlyError(error);
    }
  });

  const openConfigCommand = vscode.commands.registerCommand('awsWalledGarden.openConfig', async () => {
    const configFile = vscode.workspace.getConfiguration('awsWalledGarden').get('configFile', '.aws-mock.json');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const configUri = vscode.Uri.joinPath(workspaceFolder.uri, configFile);
      try {
        await vscode.workspace.openTextDocument(configUri);
        await ErrorHandler.showSuccessWithActions('Configuration file opened successfully!');
      } catch (error) {
        await ErrorHandler.showUserFriendlyError(error);
      }
    } else {
      await ErrorHandler.showUserFriendlyError('No workspace folder found');
    }
  });

  const showSchemaCommand = vscode.commands.registerCommand('awsWalledGarden.showSchema', async () => {
    const extensionPath = context.extensionPath;
    const schemaPath = path.join(extensionPath, 'aws-mock-config.schema.json');
    try {
      const schemaUri = vscode.Uri.file(schemaPath);
      const doc = await vscode.workspace.openTextDocument(schemaUri);
      await vscode.window.showTextDocument(doc);
      await ErrorHandler.showSuccessWithActions('Configuration schema opened successfully!');
    } catch (error) {
      await ErrorHandler.showUserFriendlyError(error);
    }
  });

  const installSdkCommand = vscode.commands.registerCommand('awsWalledGarden.installSdk', async (version?: string) => {
    const sdkVersion = version || await vscode.window.showQuickPick(['v2', 'v3'], {
      placeHolder: 'Select AWS SDK version to install'
    });

    if (!sdkVersion) return;

    const packageName = sdkVersion === 'v2' ? 'aws-sdk' : '@aws-sdk/client-s3';
    const terminal = vscode.window.createTerminal('AWS SDK Install');
    terminal.show();
    terminal.sendText(`npm install ${packageName}`);
    await ErrorHandler.showSuccessWithActions(`Installing AWS SDK ${sdkVersion}... Check the terminal for progress.`);
  });

  const createTemplateCommand = vscode.commands.registerCommand('awsWalledGarden.createTemplate', async () => {
    try {
      const config = vscode.workspace.getConfiguration('awsWalledGarden');
      const configFile = config.get('configFile', '.aws-mock.json');
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const configPath = path.join(workspaceFolder.uri.fsPath, configFile);
        const template = ConfigValidator.createTemplate();
        const templateContent = JSON.stringify(template, null, 2);

        // Check if file already exists
        const configUri = vscode.Uri.file(configPath);
        let doc: vscode.TextDocument;
        try {
          doc = await vscode.workspace.openTextDocument(configUri);
          const overwrite = await vscode.window.showWarningMessage(
            `Configuration file ${configFile} already exists. Overwrite it?`,
            'Yes', 'No'
          );
          if (overwrite !== 'Yes') {
            return;
          }
        } catch {
          // File doesn't exist, create it
          doc = await vscode.workspace.openTextDocument({
            content: templateContent,
            language: 'json'
          });
          await vscode.workspace.fs.writeFile(configUri, Buffer.from(templateContent, 'utf8'));
        }

        await vscode.window.showTextDocument(doc);
        await ErrorHandler.showSuccessWithActions('Template configuration created successfully!');
      } else {
        await ErrorHandler.showUserFriendlyError('No workspace folder found');
      }
    } catch (error) {
      await ErrorHandler.showUserFriendlyError(error);
    }
  });

  const openGuiEditorCommand = vscode.commands.registerCommand('awsWalledGarden.openGuiEditor', async () => {
    try {
      const config = vscode.workspace.getConfiguration('awsWalledGarden');
      const configFile = config.get('configFile', '.aws-mock.json');
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        await ErrorHandler.showUserFriendlyError('No workspace folder found');
        return;
      }

      const configPath = path.join(workspaceFolder.uri.fsPath, configFile);
      let configData: any = {};

      // Try to load existing configuration
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        configData = JSON.parse(configContent);
      } catch {
        // File doesn't exist or is invalid, use empty config
        configData = { version: '1.0', services: {} };
      }

      // Create and show the webview
      const panel = vscode.window.createWebviewPanel(
        'awsMockConfigEditor',
        'AWS Walled Garden Configuration Editor',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        }
      );

      // Set the webview content
      panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, configData);

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type) {
            case 'saveConfig':
              try {
                const configContent = JSON.stringify(message.config, null, 2);
                fs.writeFileSync(configPath, configContent);
                await vscode.window.showInformationMessage('Configuration saved successfully!');
                
                // Reload configuration if the extension is enabled
                if (mockManager && mockManager.isEnabled()) {
                  await mockManager.reloadConfig();
                }
                
                // Validate the saved configuration
                await validateConfigurationFile(vscode.Uri.file(configPath));
              } catch (error) {
                await vscode.window.showErrorMessage(`Failed to save configuration: ${(error as Error).message}`);
              }
              break;
            case 'validateConfig':
              try {
                const validation = ConfigValidator.validate(message.config);
                panel.webview.postMessage({
                  type: 'validationResult',
                  result: validation
                });
              } catch (error) {
                panel.webview.postMessage({
                  type: 'validationError',
                  error: (error as Error).toString()
                });
              }
              break;
            case 'showQuickPick':
              try {
                const selectedService = await vscode.window.showQuickPick(
                  message.items.map((item: any) => ({
                    label: item.label,
                    description: item.description
                  })),
                  {
                    placeHolder: 'Select AWS service to add'
                  }
                );
                
                if (selectedService) {
                  panel.webview.postMessage({
                    type: 'addService',
                    service: selectedService
                  });
                }
              } catch (error) {
                await vscode.window.showErrorMessage(`Failed to show service picker: ${(error as Error).message}`);
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      await ErrorHandler.showSuccessWithActions('GUI Configuration Editor opened successfully!');
    } catch (error) {
      await ErrorHandler.showUserFriendlyError(error);
    }
  });

  context.subscriptions.push(enableCommand, disableCommand, reloadConfigCommand, showLogsCommand, autoConfigureCommand, toggleCommand, openConfigCommand, showSchemaCommand, installSdkCommand, createTemplateCommand, openGuiEditorCommand);

  // Auto-enable if configured
  const config = vscode.workspace.getConfiguration('awsWalledGarden');
  if (config.get('enabled', true) && mockManager) {
    mockManager.enable().catch((err: any) => {
      console.error('Failed to auto-enable AWS Walled Garden:', err);
    });
  }

  // Watch for configuration file changes
  const configFile = config.get('configFile', '.aws-mock.json');
  const watcher = vscode.workspace.createFileSystemWatcher(`**/${configFile}`);
  watcher.onDidChange(async (uri) => {
    if (mockManager && mockManager.isEnabled()) {
      await mockManager.reloadConfig();
    }
    // Validate configuration on change
    await validateConfigurationFile(uri);
  });
  watcher.onDidCreate(async (uri) => {
    if (mockManager && mockManager.isEnabled()) {
      await mockManager.reloadConfig();
    }
    // Validate configuration on creation
    await validateConfigurationFile(uri);
  });
  watcher.onDidDelete(async (uri) => {
    if (mockManager) {
      await mockManager.disable();
    }
    // Clear diagnostics when file is deleted
    diagnosticCollection?.delete(uri);
  });
  context.subscriptions.push(watcher);

  // Validate existing configuration files on startup
  vscode.workspace.findFiles(`**/${configFile}`).then(async (uris) => {
    for (const uri of uris) {
      await validateConfigurationFile(uri);
    }
  });
}

function updateStatusBar() {
  if (!statusBarItem || !mockManager) {
    return;
  }

  const isEnabled = mockManager.isEnabled();
  statusBarItem.text = isEnabled ? '$(check) AWS Mock' : '$(x) AWS Mock';
  statusBarItem.tooltip = isEnabled
    ? 'AWS Walled Garden is active - Click to disable'
    : 'AWS Walled Garden is disabled - Click to enable';
  statusBarItem.color = isEnabled ? '#4CAF50' : '#F44336';
  statusBarItem.show();
}

async function validateConfigurationFile(uri: vscode.Uri) {
  if (!diagnosticCollection) {
    return;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const config = JSON.parse(document.getText());
    const validation = ConfigValidator.validate(config);

    const diagnostics: vscode.Diagnostic[] = [];

    for (const error of validation.errors) {
      const range = getRangeForPath(document, error.path);
      const diagnostic = new vscode.Diagnostic(
        range,
        error.message,
        error.severity === 'error' ? vscode.DiagnosticSeverity.Error :
        error.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
        vscode.DiagnosticSeverity.Information
      );

      if (error.suggestion) {
        diagnostic.code = {
          value: 'aws-mock-config-fix',
          target: vscode.Uri.parse(`command:awsWalledGarden.applySuggestion?${encodeURIComponent(JSON.stringify({
            uri: uri.toString(),
            path: error.path,
            suggestion: error.suggestion
          }))}`)
        };
      }

      diagnostics.push(diagnostic);
    }

    diagnosticCollection.set(uri, diagnostics);
  } catch (error) {
    // If JSON parsing fails, show a general error
    const range = new vscode.Range(0, 0, 0, 1);
    const diagnostic = new vscode.Diagnostic(
      range,
      'Invalid JSON syntax in configuration file',
      vscode.DiagnosticSeverity.Error
    );
    diagnosticCollection.set(uri, [diagnostic]);
  }
}

function getRangeForPath(document: vscode.TextDocument, path: string): vscode.Range {
  // Simple implementation - in a real scenario, you'd parse the JSON and find the exact range
  // For now, we'll return the first line as a fallback
  return new vscode.Range(0, 0, 0, document.lineAt(0).text.length);
}

export class AwsMockCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const line = document.lineAt(position.line).text;
    const linePrefix = line.substring(0, position.character);

    // Get the current JSON path context
    const path = this.getJsonPath(document, position);

    return this.getCompletionsForPath(path, linePrefix);
  }

  private getJsonPath(document: vscode.TextDocument, position: vscode.Position): string[] {
    const path: string[] = [];
    let depth = 0;
    const braces: string[] = [];

    for (let line = 0; line <= position.line; line++) {
      const lineText = document.lineAt(line).text;
      const endCol = line === position.line ? position.character : lineText.length;

      for (let col = 0; col < endCol; col++) {
        const char = lineText[col];

        if (char === '{' || char === '[') {
          braces.push(char);
          depth++;
        } else if (char === '}' || char === ']') {
          braces.pop();
          depth--;
        } else if (char === '"' && depth > 0) {
          // Look for property names
          const startQuote = col;
          col++; // Skip opening quote
          while (col < endCol && lineText[col] !== '"') {
            col++;
          }
          if (col < endCol) {
            const propertyName = lineText.substring(startQuote + 1, col);
            if (propertyName && !propertyName.includes(':') && !propertyName.includes(',')) {
              path.push(propertyName);
            }
          }
        }
      }
    }

    return path;
  }

  private getCompletionsForPath(path: string[], linePrefix: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    // Root level completions
    if (path.length === 0) {
      completions.push(
        this.createCompletionItem('version', 'Configuration version', '"1.0"', 'The version of the configuration schema'),
        this.createCompletionItem('services', 'AWS service configurations', '{\n  \n}', 'Object containing AWS service mock configurations'),
        this.createCompletionItem('global', 'Global configuration options', '{\n  \n}', 'Global settings that apply to all services')
      );
    }
    // Services level completions
    else if (path.length === 1 && path[0] === 'services') {
      const supportedServices = ConfigValidator.getSupportedServices();
      for (const service of supportedServices) {
        const example = this.getServiceExample(service);
        completions.push(
          this.createCompletionItem(service, `${service.toUpperCase()} service configuration`, example, `Mock configuration for AWS ${service.toUpperCase()} service`)
        );
      }
    }
    // Service-specific completions
    else if (path.length === 2 && path[0] === 'services') {
      const service = path[1];
      const serviceCompletions = this.getServiceCompletions(service);
      completions.push(...serviceCompletions);
    }
    // Global configuration completions
    else if (path.length === 1 && path[0] === 'global') {
      completions.push(
        this.createCompletionItem('port', 'Default port for all services', '3000', 'Port number for the proxy server'),
        this.createCompletionItem('host', 'Host to bind the proxy server', '"localhost"', 'Host address for the proxy server'),
        this.createCompletionItem('logLevel', 'Logging level', '"info"', 'Log level: error, warn, info, debug'),
        this.createCompletionItem('recordRequests', 'Record all requests', 'false', 'Whether to log all incoming requests'),
        this.createCompletionItem('delayResponses', 'Response delay in milliseconds', '0', 'Artificial delay for responses')
      );
    }

    return completions;
  }

  private createCompletionItem(label: string, detail: string, insertText: string, documentation?: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Property);
    item.detail = detail;
    item.insertText = insertText;
    if (documentation) {
      item.documentation = new vscode.MarkdownString(documentation);
    }
    return item;
  }

  private getServiceExample(service: string): string {
    const examples: { [key: string]: string } = {
      s3: '{\n  "buckets": {\n    "my-bucket": {\n      "objects": {\n        "example.txt": {\n          "content": "Hello World!",\n          "contentType": "text/plain"\n        }\n      }\n    }\n  }\n}',
      dynamodb: '{\n  "tables": {\n    "my-table": {\n      "items": [\n        {\n          "id": "123",\n          "name": "Example Item"\n        }\n      ]\n    }\n  }\n}',
      lambda: '{\n  "functions": {\n    "my-function": {\n      "response": {\n        "statusCode": 200,\n        "body": "Hello from Lambda!"\n      }\n    }\n  }\n}',
      sqs: '{\n  "queues": {\n    "my-queue": {\n      "messages": []\n    }\n  }\n}',
      sns: '{\n  "topics": {\n    "my-topic": {\n      "subscriptions": []\n    }\n  }\n}'
    };
    return examples[service] || '{\n  \n}';
  }

  private getServiceCompletions(service: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    switch (service) {
      case 's3':
        completions.push(
          this.createCompletionItem('buckets', 'S3 bucket configurations', '{\n  \n}', 'Object containing S3 bucket definitions'),
          this.createCompletionItem('port', 'Custom port for S3 service', '4569', 'Port number for S3 mock service'),
          this.createCompletionItem('region', 'AWS region', '"us-east-1"', 'AWS region for S3 service')
        );
        break;
      case 'dynamodb':
        completions.push(
          this.createCompletionItem('tables', 'DynamoDB table configurations', '{\n  \n}', 'Object containing DynamoDB table definitions'),
          this.createCompletionItem('port', 'Custom port for DynamoDB service', '8000', 'Port number for DynamoDB mock service'),
          this.createCompletionItem('region', 'AWS region', '"us-east-1"', 'AWS region for DynamoDB service')
        );
        break;
      case 'lambda':
        completions.push(
          this.createCompletionItem('functions', 'Lambda function configurations', '{\n  \n}', 'Object containing Lambda function definitions'),
          this.createCompletionItem('port', 'Custom port for Lambda service', '9001', 'Port number for Lambda mock service'),
          this.createCompletionItem('region', 'AWS region', '"us-east-1"', 'AWS region for Lambda service')
        );
        break;
      case 'sqs':
        completions.push(
          this.createCompletionItem('queues', 'SQS queue configurations', '{\n  \n}', 'Object containing SQS queue definitions'),
          this.createCompletionItem('port', 'Custom port for SQS service', '9324', 'Port number for SQS mock service'),
          this.createCompletionItem('region', 'AWS region', '"us-east-1"', 'AWS region for SQS service')
        );
        break;
      case 'sns':
        completions.push(
          this.createCompletionItem('topics', 'SNS topic configurations', '{\n  \n}', 'Object containing SNS topic definitions'),
          this.createCompletionItem('port', 'Custom port for SNS service', '9911', 'Port number for SNS mock service'),
          this.createCompletionItem('region', 'AWS region', '"us-east-1"', 'AWS region for SNS service')
        );
        break;
      default:
        completions.push(
          this.createCompletionItem('port', 'Custom port for service', '3000', 'Port number for this service'),
          this.createCompletionItem('region', 'AWS region', '"us-east-1"', 'AWS region for this service')
        );
    }

    return completions;
  }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, configData: any): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>AWS Walled Garden Configuration Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 30px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .section h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .form-group input, .form-group select, .form-group textarea {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
        }
        .service-item {
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border: 1px solid var(--vscode-list-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .service-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .service-name {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .remove-service {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
        }
        .remove-service:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .add-service {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .add-service:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .actions {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .validation-errors {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 10px;
            border-radius: 3px;
            margin-bottom: 20px;
        }
        .error-item {
            margin-bottom: 5px;
        }
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AWS Walled Garden Configuration Editor</h1>
            <p>Use this visual editor to create and modify your AWS mock configurations without editing JSON directly.</p>
        </div>

        <div id="validation-errors" class="validation-errors hidden">
            <h4>Configuration Errors:</h4>
            <div id="error-list"></div>
        </div>

        <div class="section">
            <h3>Global Configuration</h3>
            <div class="form-group">
                <label for="version">Version:</label>
                <input type="text" id="version" value="${configData.version || '1.0'}" readonly>
            </div>
            <div class="form-group">
                <label for="global-port">Port:</label>
                <input type="number" id="global-port" value="${configData.global?.port || 3000}" min="1024" max="65535">
            </div>
            <div class="form-group">
                <label for="global-host">Host:</label>
                <input type="text" id="global-host" value="${configData.global?.host || 'localhost'}">
            </div>
            <div class="form-group">
                <label for="global-logLevel">Log Level:</label>
                <select id="global-logLevel">
                    <option value="error" ${configData.global?.logLevel === 'error' ? 'selected' : ''}>Error</option>
                    <option value="warn" ${configData.global?.logLevel === 'warn' ? 'selected' : ''}>Warn</option>
                    <option value="info" ${configData.global?.logLevel === 'info' ? 'selected' : ''}>Info</option>
                    <option value="debug" ${configData.global?.logLevel === 'debug' ? 'selected' : ''}>Debug</option>
                </select>
            </div>
            <div class="form-group">
                <label for="global-recordRequests">
                    <input type="checkbox" id="global-recordRequests" ${configData.global?.recordRequests ? 'checked' : ''}>
                    Record Requests
                </label>
            </div>
            <div class="form-group">
                <label for="global-delayResponses">Response Delay (ms):</label>
                <input type="number" id="global-delayResponses" value="${configData.global?.delayResponses || 0}" min="0">
            </div>
        </div>

        <div class="section">
            <h3>AWS Services</h3>
            <button class="add-service" onclick="addService()">Add Service</button>
            <div id="services-container">
                <!-- Services will be rendered by JavaScript -->
            </div>
        </div>

        <div class="actions">
            <button class="btn btn-primary" onclick="saveConfig()">Save Configuration</button>
            <button class="btn btn-secondary" onclick="validateConfig()">Validate Configuration</button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let services = ${JSON.stringify(configData.services || {})};

        // Initialize the services display
        document.addEventListener('DOMContentLoaded', function() {
            updateServicesDisplay();
        });

        function renderServices(servicesData) {
            return Object.entries(servicesData).map(([serviceName, serviceConfig]) => 
                renderService(serviceName, serviceConfig)
            ).join('');
        }

        function renderService(serviceName, serviceConfig) {
            return \`
                <div class="service-item" data-service="\${serviceName}">
                    <div class="service-header">
                        <span class="service-name">\${serviceName.toUpperCase()}</span>
                        <button class="remove-service" onclick="removeService('\${serviceName}')">Remove</button>
                    </div>
                    \${renderServiceFields(serviceName, serviceConfig)}
                </div>
            \`;
        }

        function renderServiceFields(serviceName, serviceConfig) {
            switch(serviceName) {
                case 's3':
                    return renderS3Fields(serviceConfig);
                case 'dynamodb':
                    return renderDynamoDBFields(serviceConfig);
                case 'lambda':
                    return renderLambdaFields(serviceConfig);
                case 'sqs':
                    return renderSQSFields(serviceConfig);
                case 'sns':
                    return renderSNSFields(serviceConfig);
                default:
                    return renderGenericServiceFields(serviceName, serviceConfig);
            }
        }

        function renderS3Fields(config) {
            return \`
                <div class="form-group">
                    <label>Port (optional):</label>
                    <input type="number" value="\${config.port || ''}" min="1024" max="65535" onchange="updateServiceConfig('s3', 'port', this.value)">
                </div>
                <div class="form-group">
                    <label>Region (optional):</label>
                    <input type="text" value="\${config.region || ''}" onchange="updateServiceConfig('s3', 'region', this.value)">
                </div>
                <div class="form-group">
                    <label>Buckets (JSON):</label>
                    <textarea rows="8" onchange="updateServiceConfig('s3', 'buckets', JSON.parse(this.value))">\${JSON.stringify(config.buckets || {}, null, 2)}</textarea>
                </div>
            \`;
        }

        function renderDynamoDBFields(config) {
            return \`
                <div class="form-group">
                    <label>Port (optional):</label>
                    <input type="number" value="\${config.port || ''}" min="1024" max="65535" onchange="updateServiceConfig('dynamodb', 'port', this.value)">
                </div>
                <div class="form-group">
                    <label>Region (optional):</label>
                    <input type="text" value="\${config.region || ''}" onchange="updateServiceConfig('dynamodb', 'region', this.value)">
                </div>
                <div class="form-group">
                    <label>Tables (JSON):</label>
                    <textarea rows="8" onchange="updateServiceConfig('dynamodb', 'tables', JSON.parse(this.value))">\${JSON.stringify(config.tables || {}, null, 2)}</textarea>
                </div>
            \`;
        }

        function renderLambdaFields(config) {
            return \`
                <div class="form-group">
                    <label>Port (optional):</label>
                    <input type="number" value="\${config.port || ''}" min="1024" max="65535" onchange="updateServiceConfig('lambda', 'port', this.value)">
                </div>
                <div class="form-group">
                    <label>Region (optional):</label>
                    <input type="text" value="\${config.region || ''}" onchange="updateServiceConfig('lambda', 'region', this.value)">
                </div>
                <div class="form-group">
                    <label>Functions (JSON):</label>
                    <textarea rows="8" onchange="updateServiceConfig('lambda', 'functions', JSON.parse(this.value))">\${JSON.stringify(config.functions || {}, null, 2)}</textarea>
                </div>
            \`;
        }

        function renderSQSFields(config) {
            return \`
                <div class="form-group">
                    <label>Port (optional):</label>
                    <input type="number" value="\${config.port || ''}" min="1024" max="65535" onchange="updateServiceConfig('sqs', 'port', this.value)">
                </div>
                <div class="form-group">
                    <label>Region (optional):</label>
                    <input type="text" value="\${config.region || ''}" onchange="updateServiceConfig('sqs', 'region', this.value)">
                </div>
                <div class="form-group">
                    <label>Queues (JSON):</label>
                    <textarea rows="8" onchange="updateServiceConfig('sqs', 'queues', JSON.parse(this.value))">\${JSON.stringify(config.queues || {}, null, 2)}</textarea>
                </div>
            \`;
        }

        function renderSNSFields(config) {
            return \`
                <div class="form-group">
                    <label>Port (optional):</label>
                    <input type="number" value="\${config.port || ''}" min="1024" max="65535" onchange="updateServiceConfig('sns', 'port', this.value)">
                </div>
                <div class="form-group">
                    <label>Region (optional):</label>
                    <input type="text" value="\${config.region || ''}" onchange="updateServiceConfig('sns', 'region', this.value)">
                </div>
                <div class="form-group">
                    <label>Topics (JSON):</label>
                    <textarea rows="8" onchange="updateServiceConfig('sns', 'topics', JSON.parse(this.value))">\${JSON.stringify(config.topics || {}, null, 2)}</textarea>
                </div>
            \`;
        }

        function renderGenericServiceFields(serviceName, config) {
            return \`
                <div class="form-group">
                    <label>Port (optional):</label>
                    <input type="number" value="\${config.port || ''}" min="1024" max="65535" onchange="updateServiceConfig('\${serviceName}', 'port', this.value)">
                </div>
                <div class="form-group">
                    <label>Region (optional):</label>
                    <input type="text" value="\${config.region || ''}" onchange="updateServiceConfig('\${serviceName}', 'region', this.value)">
                </div>
                <div class="form-group">
                    <label>Configuration (JSON):</label>
                    <textarea rows="6" onchange="updateServiceConfig('\${serviceName}', 'config', JSON.parse(this.value))">\${JSON.stringify(config, null, 2)}</textarea>
                </div>
            \`;
        }

        function updateServiceConfig(serviceName, key, value) {
            if (!services[serviceName]) {
                services[serviceName] = {};
            }
            services[serviceName][key] = value;
        }

        function addService() {
            const serviceOptions = ['s3', 'dynamodb', 'lambda', 'sqs', 'sns', 'ec2', 'rds', 'cloudformation', 'iam', 'sts', 'ssm', 'secretsmanager', 'kms', 'cloudwatch', 'route53', 'elb', 'autoscaling', 'elasticache', 'redshift', 'athena', 'glue', 'stepfunctions', 'eventbridge', 'apigateway'];
            
            vscode.postMessage({
                type: 'showQuickPick',
                items: serviceOptions.map(s => ({ label: s, description: \`\${s.toUpperCase()} service\` }))
            });
        }

        function removeService(serviceName) {
            delete services[serviceName];
            updateServicesDisplay();
        }

        function updateServicesDisplay() {
            document.getElementById('services-container').innerHTML = renderServices(services);
        }

        function saveConfig() {
            const config = {
                version: document.getElementById('version').value,
                services: services,
                global: {
                    port: parseInt(document.getElementById('global-port').value),
                    host: document.getElementById('global-host').value,
                    logLevel: document.getElementById('global-logLevel').value,
                    recordRequests: document.getElementById('global-recordRequests').checked,
                    delayResponses: parseInt(document.getElementById('global-delayResponses').value)
                }
            };

            vscode.postMessage({
                type: 'saveConfig',
                config: config
            });
        }

        function validateConfig() {
            const config = {
                version: document.getElementById('version').value,
                services: services,
                global: {
                    port: parseInt(document.getElementById('global-port').value),
                    host: document.getElementById('global-host').value,
                    logLevel: document.getElementById('global-logLevel').value,
                    recordRequests: document.getElementById('global-recordRequests').checked,
                    delayResponses: parseInt(document.getElementById('global-delayResponses').value)
                }
            };

            vscode.postMessage({
                type: 'validateConfig',
                config: config
            });
        }

        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'addService':
                    if (message.service) {
                        services[message.service] = {};
                        updateServicesDisplay();
                    }
                    break;
                case 'validationResult':
                    showValidationResult(message.result);
                    break;
                case 'validationError':
                    showValidationError(message.error);
                    break;
            }
        });

        function showValidationResult(result) {
            const errorDiv = document.getElementById('validation-errors');
            const errorList = document.getElementById('error-list');
            
            if (result.valid) {
                errorDiv.classList.add('hidden');
                vscode.postMessage({ type: 'showInfo', message: 'Configuration is valid!' });
            } else {
                errorList.innerHTML = result.errors.map(error => 
                    \`<div class="error-item">\${error.message}</div>\`
                ).join('');
                errorDiv.classList.remove('hidden');
            }
        }

        function showValidationError(error) {
            vscode.postMessage({ type: 'showError', message: \`Validation error: \${error}\` });
        }
    </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {
  if (mockManager) {
    mockManager.disable().catch((err: any) => {
      logger.error('Error during deactivation', err);
    });
  }
  if (logger) {
    logger.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}