import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProxyServer } from './proxyServer';
import { Logger } from './logger';
import { ConfigValidator } from './configValidator';
import { ErrorHandler } from './errorHandler';

export interface MockConfig {
  version: string;
  services: {
    [serviceName: string]: any;
  };
}

export class MockManager {
  private context: vscode.ExtensionContext | null = null;
  private config: MockConfig | null = null;
  private enabled = false;
  private proxyServer: ProxyServer;
  private logger: Logger;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.proxyServer = new ProxyServer();
    this.logger = Logger.getInstance();
  }

  public async enable(): Promise<void> {
    if (this.enabled) return;

    await this.loadConfig();
    await this.startProxy();
    this.enabled = true;
  }

  public async disable(): Promise<void> {
    if (!this.enabled) return;

    await this.stopProxy();
    this.config = null;
    this.enabled = false;
  }

  public async reloadConfig(): Promise<void> {
    await this.loadConfig();
    if (this.config) {
      this.proxyServer.updateConfig(this.config);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private async loadConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('awsWalledGarden');
    const configFile = config.get('configFile', '.aws-mock.json');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    const configPath = path.join(workspaceFolders[0].uri.fsPath, configFile);

    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const parsedConfig = JSON.parse(configContent);

        // Validate configuration
        const validation = ConfigValidator.validate(parsedConfig);
        if (!validation.valid) {
          const errorMessages = validation.errors.map(err => err.message);
          const errorMessage = `Invalid configuration:\n${errorMessages.join('\n')}`;
          this.logger.error(`Configuration validation failed: ${errorMessages[0]}`, validation.errors);
          await ErrorHandler.showUserFriendlyError(errorMessages[0], 'validation');
          return;
        }

        this.config = parsedConfig;
        this.logger.info(`Loaded and validated mock configuration from ${configFile}`);
      } else {
        this.logger.warn(`Configuration file ${configFile} not found. Creating template...`);
        vscode.window.showWarningMessage(`Configuration file ${configFile} not found. Creating template...`);
        await this.createTemplateConfig(configPath);
      }
    } catch (error) {
      this.logger.error('Error loading configuration', error);
      await ErrorHandler.showUserFriendlyError(error);
    }
  }

  private async createTemplateConfig(configPath: string): Promise<void> {
    const templateConfig: MockConfig = {
      version: "1.0",
      services: {
        s3: {
          buckets: {
            "example-bucket": {
              objects: {
                "test-file.txt": {
                  content: "Hello, World!",
                  metadata: {
                    ContentType: "text/plain"
                  }
                }
              }
            }
          }
        },
        dynamodb: {
          tables: {
            "Users": {
              items: [
                {
                  id: "user1",
                  name: "John Doe",
                  email: "john@example.com"
                }
              ]
            }
          }
        }
      }
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(templateConfig, null, 2));
      this.logger.info(`Created template configuration at ${configPath}`);
      vscode.window.showInformationMessage(`Created template configuration at ${configPath}`);
    } catch (error) {
      this.logger.error('Error creating template config', error);
      await ErrorHandler.showUserFriendlyError(error);
    }
  }

  private async startProxy(): Promise<void> {
    if (this.config) {
      this.logger.info('Starting mock proxy server...');
      await this.proxyServer.start(this.config);
      this.logger.info('Mock proxy server started successfully');
    } else {
      this.logger.error('Cannot start proxy server: no configuration loaded');
    }
  }

  private async stopProxy(): Promise<void> {
    this.logger.info('Stopping mock proxy server...');
    await this.proxyServer.stop();
    this.logger.info('Mock proxy server stopped');
  }

  private restartProxy(): void {
    this.stopProxy();
    this.startProxy();
  }
}