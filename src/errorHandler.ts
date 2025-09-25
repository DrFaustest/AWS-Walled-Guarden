import * as vscode from 'vscode';

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestions: string[];
  actions?: vscode.MessageItem[];
  documentation?: string;
}

export class ErrorHandler {
  private static readonly ERROR_MAPPINGS: Record<string, UserFriendlyError> = {
    // Configuration errors
    'ENOENT': {
      title: 'Configuration File Not Found',
      message: 'The AWS Walled Garden configuration file (.aws-mock.json) could not be found.',
      suggestions: [
        'Run "Auto Configure Mocks" to create a configuration file automatically',
        'Create a .aws-mock.json file in your workspace root',
        'Check that you\'re in the correct workspace folder'
      ],
      actions: [
        { title: 'Auto Configure', isCloseAffordance: false },
        { title: 'Create Template', isCloseAffordance: false }
      ]
    },

    'EACCES': {
      title: 'Permission Denied',
      message: 'AWS Walled Garden cannot access the configuration file due to permission restrictions.',
      suggestions: [
        'Check file permissions for .aws-mock.json',
        'Ensure the file is not read-only',
        'Try running VS Code with administrator privileges'
      ]
    },

    'JSON_SYNTAX': {
      title: 'Invalid Configuration Format',
      message: 'The configuration file contains invalid JSON syntax.',
      suggestions: [
        'Check for missing commas, quotes, or brackets',
        'Use a JSON validator to check the syntax',
        'Run "Auto Configure Mocks" to regenerate the configuration'
      ],
      actions: [
        { title: 'Auto Configure', isCloseAffordance: false },
        { title: 'Open File', isCloseAffordance: false }
      ]
    },

    'PORT_IN_USE': {
      title: 'Proxy Port Already in Use',
      message: 'The proxy server cannot start because port 3000 is already being used by another application.',
      suggestions: [
        'Close any other applications using port 3000',
        'Change the proxy port in your configuration',
        'Check if another instance of AWS Walled Garden is running'
      ],
      actions: [
        { title: 'Change Port', isCloseAffordance: false }
      ]
    },

    'SDK_NOT_FOUND': {
      title: 'AWS SDK Not Detected',
      message: 'No AWS SDK usage was found in your project.',
      suggestions: [
        'Install AWS SDK: npm install aws-sdk or npm install @aws-sdk/client-*',
        'Check that your AWS calls are in supported file types (.js, .ts, .mjs)',
        'Ensure your code is saved and the workspace is properly loaded'
      ],
      actions: [
        { title: 'Install SDK v2', isCloseAffordance: false },
        { title: 'Install SDK v3', isCloseAffordance: false }
      ]
    },

    'CONFIG_VALIDATION': {
      title: 'Configuration Validation Failed',
      message: 'Your mock configuration file has validation errors.',
      suggestions: [
        'Check the configuration file for syntax errors',
        'Ensure all required fields are present',
        'Use the configuration schema for reference'
      ],
      actions: [
        { title: 'Open Config', isCloseAffordance: false },
        { title: 'View Schema', isCloseAffordance: false }
      ]
    }
  };

  public static async showUserFriendlyError(error: any, context?: string): Promise<void> {
    const friendlyError = this.mapErrorToUserFriendly(error, context);

    const result = await vscode.window.showErrorMessage(
      friendlyError.title,
      { modal: false, detail: friendlyError.message },
      ...(friendlyError.actions || [])
    );

    if (result) {
      await this.handleErrorAction(result, friendlyError, error);
    }

    // Show additional suggestions if available
    if (friendlyError.suggestions.length > 0) {
      const showSuggestions = await vscode.window.showInformationMessage(
        'Would you like to see troubleshooting suggestions?',
        'Yes',
        'No'
      );

      if (showSuggestions === 'Yes') {
        this.showSuggestions(friendlyError);
      }
    }
  }

  private static mapErrorToUserFriendly(error: any, context?: string): UserFriendlyError {
    const errorString = error?.toString() || '';
    const errorMessage = error?.message || '';

    // Check for specific error patterns
    if (errorString.includes('ENOENT') || errorMessage.includes('no such file')) {
      return this.ERROR_MAPPINGS.ENOENT;
    }

    if (errorString.includes('EACCES') || errorMessage.includes('permission denied')) {
      return this.ERROR_MAPPINGS.EACCES;
    }

    if (errorString.includes('JSON') || errorMessage.includes('Unexpected token')) {
      return this.ERROR_MAPPINGS.JSON_SYNTAX;
    }

    if (errorString.includes('EADDRINUSE') || errorMessage.includes('port') || context === 'proxy') {
      return this.ERROR_MAPPINGS.PORT_IN_USE;
    }

    if (context === 'auto-config' && (errorMessage.includes('No AWS') || errorMessage.includes('not found'))) {
      return this.ERROR_MAPPINGS.SDK_NOT_FOUND;
    }

    if (context === 'validation') {
      return this.ERROR_MAPPINGS.CONFIG_VALIDATION;
    }

    // Generic fallback
    return {
      title: 'An Error Occurred',
      message: 'Something went wrong while running AWS Walled Garden.',
      suggestions: [
        'Check the output channel for more details',
        'Try restarting VS Code',
        'Check the troubleshooting documentation'
      ],
      actions: [
        { title: 'Show Logs', isCloseAffordance: false },
        { title: 'Open Docs', isCloseAffordance: false }
      ]
    };
  }

  private static async handleErrorAction(action: vscode.MessageItem, friendlyError: UserFriendlyError, originalError: any): Promise<void> {
    switch (action.title) {
      case 'Auto Configure':
        await vscode.commands.executeCommand('awsWalledGarden.autoConfigure');
        break;

      case 'Create Template':
        await vscode.commands.executeCommand('awsWalledGarden.createTemplate');
        break;

      case 'Open File': {
        const configFile = vscode.workspace.getConfiguration('awsWalledGarden').get('configFile', '.aws-mock.json');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const configUri = vscode.Uri.joinPath(workspaceFolder.uri, configFile);
          await vscode.workspace.openTextDocument(configUri);
        }
        break;
      }

      case 'Change Port': {
        const newPort = await vscode.window.showInputBox({
          prompt: 'Enter a new port number for the proxy server',
          value: '3001',
          validateInput: (value) => {
            const port = parseInt(value);
            return (port >= 1024 && port <= 65535) ? null : 'Port must be between 1024 and 65535';
          }
        });
        if (newPort) {
          // This would need to be implemented in the configuration
          vscode.window.showInformationMessage(`Port change functionality coming soon. For now, manually edit your configuration file.`);
        }
        break;
      }

      case 'Install SDK v2':
        await vscode.commands.executeCommand('awsWalledGarden.installSdk', 'v2');
        break;

      case 'Install SDK v3':
        await vscode.commands.executeCommand('awsWalledGarden.installSdk', 'v3');
        break;

      case 'Open Config':
        await vscode.commands.executeCommand('awsWalledGarden.openConfig');
        break;

      case 'View Schema':
        await vscode.commands.executeCommand('awsWalledGarden.showSchema');
        break;

      case 'Show Logs':
        await vscode.commands.executeCommand('awsWalledGarden.showLogs');
        break;

      case 'Open Docs':
        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/username/aws-walled-garden#troubleshooting'));
        break;
    }
  }

  private static showSuggestions(friendlyError: UserFriendlyError): void {
    const suggestionsText = friendlyError.suggestions.map((suggestion, index) =>
      `${index + 1}. ${suggestion}`
    ).join('\n\n');

    vscode.window.showInformationMessage(
      'Troubleshooting Suggestions',
      { modal: true, detail: suggestionsText }
    );
  }

  public static async showSuccessWithActions(message: string, actions: vscode.MessageItem[] = []): Promise<vscode.MessageItem | undefined> {
    return await vscode.window.showInformationMessage(message, ...actions);
  }

  public static showWarning(message: string): void {
    vscode.window.showWarningMessage(message);
  }
}