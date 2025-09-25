// import * as vscode from 'vscode'; // Import conditionally to avoid module not found errors

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger;
  private outputChannel: any = null; // VS Code OutputChannel or null
  private logLevel: LogLevel = LogLevel.INFO;
  private isVSCodeEnvironment: boolean = false;
  private vscode: any = null; // Lazy-loaded vscode module

  private constructor() {
    try {
      // Lazy load vscode to avoid import errors when not in VS Code environment
      this.vscode = require('vscode');
      this.isVSCodeEnvironment = typeof this.vscode !== 'undefined' && this.vscode.window !== undefined;
      if (this.isVSCodeEnvironment) {
        this.outputChannel = this.vscode.window.createOutputChannel('AWS Walled Garden');
      } else {
        this.outputChannel = null;
      }
    } catch (error) {
      // Not in VS Code environment
      this.isVSCodeEnvironment = false;
      this.outputChannel = null;
      this.vscode = null;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  public error(message: string, error?: any): void {
    const messageWithError = error ? `${message}: ${error.message || error}` : message;
    this.log(LogLevel.ERROR, messageWithError);

    // Also show error in VS Code notification for critical errors
    if (this.isVSCodeEnvironment && this.logLevel <= LogLevel.ERROR && this.vscode) {
      this.vscode.window.showErrorMessage(`AWS Walled Garden: ${message}`);
    }
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.logLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

    if (this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage);

      if (args.length > 0) {
        this.outputChannel.appendLine(`  Details: ${JSON.stringify(args, null, 2)}`);
      }
    }

    // Also log to console for development or when not in VS Code
    console.log(formattedMessage, ...args);
  }

  public showOutputChannel(): void {
    if (this.outputChannel && this.isVSCodeEnvironment) {
      this.outputChannel.show();
    }
  }

  public dispose(): void {
    if (this.outputChannel && this.isVSCodeEnvironment) {
      this.outputChannel.dispose();
    }
  }
}