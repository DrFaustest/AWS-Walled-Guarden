import * as assert from 'assert';
import * as vscode from 'vscode';
import { ErrorHandler } from '../../errorHandler';

suite('ErrorHandler Test Suite', () => {
  test('should map ENOENT error to user-friendly message', async () => {
    const error = new Error('ENOENT: no such file or directory');
    let errorShown = false;
    let actions: vscode.MessageItem[] | undefined;

    // Mock vscode.window.showErrorMessage
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = async (message: string, options: any, ...items: vscode.MessageItem[]) => {
      errorShown = true;
      actions = items;
      return Promise.resolve(undefined);
    };

    try {
      await ErrorHandler.showUserFriendlyError(error);
      assert.strictEqual(errorShown, true, 'Error message should be shown');
      assert(actions && actions.length > 0, 'Should provide action buttons');
    } finally {
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('should map JSON syntax error to user-friendly message', async () => {
    const error = new SyntaxError('Unexpected token } in JSON');
    let errorShown = false;

    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = async (message: string) => {
      errorShown = true;
      return Promise.resolve(undefined);
    };

    try {
      await ErrorHandler.showUserFriendlyError(error);
      assert.strictEqual(errorShown, true, 'Error message should be shown');
    } finally {
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('should handle port in use error', async () => {
    const error = new Error('EADDRINUSE: address already in use');
    let errorShown = false;

    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = async (message: string) => {
      errorShown = true;
      return Promise.resolve(undefined);
    };

    try {
      await ErrorHandler.showUserFriendlyError(error, 'proxy');
      assert.strictEqual(errorShown, true, 'Error message should be shown');
    } finally {
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('should show success message with actions', async () => {
    const actions: vscode.MessageItem[] = [
      { title: 'Open Config', isCloseAffordance: false },
      { title: 'Show Logs', isCloseAffordance: true }
    ];

    let messageShown = false;
    let returnedAction: vscode.MessageItem | undefined;

    const originalShowInformationMessage = vscode.window.showInformationMessage;
    vscode.window.showInformationMessage = async (message: string, ...items: any[]) => {
      messageShown = true;
      return Promise.resolve(items[0]); // Return first action
    };

    try {
      returnedAction = await ErrorHandler.showSuccessWithActions('Test message', actions);
      assert.strictEqual(messageShown, true, 'Success message should be shown');
      assert.strictEqual(returnedAction?.title, 'Open Config', 'Should return selected action');
    } finally {
      vscode.window.showInformationMessage = originalShowInformationMessage;
    }
  });

  test('should handle auto-config context', async () => {
    const error = new Error('No AWS SDK found');
    let errorShown = false;

    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = async (message: string) => {
      errorShown = true;
      return Promise.resolve(undefined);
    };

    try {
      await ErrorHandler.showUserFriendlyError(error, 'auto-config');
      assert.strictEqual(errorShown, true, 'Error message should be shown');
    } finally {
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });
});