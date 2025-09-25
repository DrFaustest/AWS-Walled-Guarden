import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { ErrorHandler } from './errorHandler';
import { MockConfig } from './mockManager';

interface AwsCall {
  service: string;
  operation: string;
  parameters: { [key: string]: any };
  file: string;
  line: number;
}

interface SdkUsage {
  version: 'v2' | 'v3' | 'unknown';
  files: string[];
  hasProxyConfig: boolean;
  languages: string[]; // Track detected languages
  frameworks: string[]; // Track detected frameworks
  entryPoints: string[]; // Track potential entry points
}

interface ProjectStructure {
  type: 'monorepo' | 'microservices' | 'single-app' | 'unknown';
  packages?: string[]; // For monorepos
  services?: string[]; // For microservices
  rootPath: string;
}

export class AutoConfigurator {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  public async scanAndGenerateConfig(): Promise<void> {
    try {
      this.logger.info('Starting auto-configuration scan...');

      const awsCalls = await this.scanWorkspaceForAwsCalls();
      const sdkUsage = await this.detectSdkUsage();

      this.logger.info(`Found ${awsCalls.length} AWS calls in codebase`);
      this.logger.info(`Detected AWS SDK ${sdkUsage.version} usage in ${sdkUsage.files.length} files`);

      if (awsCalls.length === 0) {
        vscode.window.showInformationMessage('No AWS SDK calls found in the workspace');
        return;
      }

      // Offer proxy configuration if not already present
      if (!sdkUsage.hasProxyConfig && sdkUsage.files.length > 0) {
        const configureProxy = await vscode.window.showQuickPick(['Yes', 'No'], {
          placeHolder: 'AWS SDK detected but proxy not configured. Configure proxy for AWS Walled Garden?'
        });

        if (configureProxy === 'Yes') {
          await this.configureProxyForSdk(sdkUsage);
        }
      }

      const mockConfig = this.generateMockConfig(awsCalls);
      await this.saveOrUpdateConfig(mockConfig);

      vscode.window.showInformationMessage(`Auto-configuration complete! Generated mocks for ${Object.keys(mockConfig.services).length} services`);
    } catch (error) {
      this.logger.error('Error during auto-configuration', error);
      await ErrorHandler.showUserFriendlyError(error, 'auto-config');
    }
  }

  private async scanWorkspaceForAwsCalls(): Promise<AwsCall[]> {
    const awsCalls: AwsCall[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      return awsCalls;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Find all relevant files
    const files = await this.findRelevantFiles(workspacePath);

    for (const file of files) {
      const calls = await this.scanFileForAwsCalls(file);
      awsCalls.push(...calls);
    }

    return awsCalls;
  }

  private async findRelevantFiles(workspacePath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

    const scanDirectory = (dir: string) => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    scanDirectory(workspacePath);
    return files;
  }

  private async scanFileForAwsCalls(filePath: string): Promise<AwsCall[]> {
    const awsCalls: AwsCall[] = [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Simple regex patterns to detect AWS SDK usage
    const patterns = [
      // AWS SDK v2 patterns
      {
        regex: /new\s+AWS\.(\w+)\(\)/g,
        serviceExtractor: (match: RegExpMatchArray) => match[1].toLowerCase()
      },
      {
        regex: /new\s+AWS\.(\w+)\.(\w+)\(\)/g,
        serviceExtractor: (match: RegExpMatchArray) => match[1].toLowerCase()
      },
      // Direct service instantiation
      {
        regex: /const\s+\w+\s*=\s*new\s+AWS\.(\w+)/g,
        serviceExtractor: (match: RegExpMatchArray) => match[1].toLowerCase()
      },
      // AWS SDK v3 patterns
      {
        regex: /import\s*\{\s*(\w+Client)/g,
        serviceExtractor: (match: RegExpMatchArray) => {
          const clientName = match[1];
          // Extract service name from client name (e.g., S3Client -> s3)
          return clientName.replace('Client', '').toLowerCase();
        }
      },
      {
        regex: /const\s+(\w+Client)\s*=\s*new\s+(\w+Client)\(\)/g,
        serviceExtractor: (match: RegExpMatchArray) => {
          const clientName = match[1];
          // Extract service name from client name (e.g., s3Client -> s3)
          return clientName.replace('Client', '').toLowerCase();
        }
      },
      // Service method calls with parameters
      {
        regex: /\.(\w+)\(\s*\{([^}]+)\}\s*\)/g,
        serviceExtractor: () => null // Will be determined from context
      }
    ];

    let currentService: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of patterns) {
        const matches = [...line.matchAll(pattern.regex)];

        for (const match of matches) {
          const service = pattern.serviceExtractor(match);

          if (service) {
            currentService = service;
            // Also create a call for service instantiation
            awsCalls.push({
              service: currentService,
              operation: 'constructor',
              parameters: {},
              file: path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, filePath),
              line: i + 1
            });
          } else if (currentService) {
            // Extract parameters from the method call
            const method = match[1];
            const paramsStr = match[2];

            const parameters = this.extractParameters(paramsStr);

            awsCalls.push({
              service: currentService,
              operation: method,
              parameters,
              file: path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, filePath),
              line: i + 1
            });
          }
        }
      }
    }

    return awsCalls;
  }

  private extractParameters(paramsStr: string): { [key: string]: any } {
    const parameters: { [key: string]: any } = {};

    // Simple parameter extraction - look for key: value patterns
    const paramMatches = paramsStr.match(/(\w+):\s*['"`]([^'"`]+)['"`]/g) || [];

    for (const match of paramMatches) {
      const [, key, value] = match.match(/(\w+):\s*['"`]([^'"`]+)['"`]/) || [];
      if (key && value) {
        parameters[key] = value;
      }
    }

    // Also look for non-string values
    const nonStringMatches = paramsStr.match(/(\w+):\s*([^,\s}]+)/g) || [];

    for (const match of nonStringMatches) {
      const [, key, value] = match.match(/(\w+):\s*([^,\s}]+)/) || [];
      if (key && value && !parameters[key]) {
        // Try to parse as number or boolean
        if (value === 'true') parameters[key] = true;
        else if (value === 'false') parameters[key] = false;
        else if (!isNaN(Number(value))) parameters[key] = Number(value);
        else parameters[key] = value;
      }
    }

    return parameters;
  }

  private generateMockConfig(awsCalls: AwsCall[]): MockConfig {
    const config: MockConfig = {
      version: "1.0",
      services: {}
    };

    // Group calls by service
    const serviceCalls: { [service: string]: AwsCall[] } = {};
    for (const call of awsCalls) {
      if (!serviceCalls[call.service]) {
        serviceCalls[call.service] = [];
      }
      serviceCalls[call.service].push(call);
    }

    // Generate mock config for each service
    for (const [service, calls] of Object.entries(serviceCalls)) {
      config.services[service] = this.generateServiceMockConfig(service, calls);
    }

    return config;
  }

  private generateServiceMockConfig(service: string, calls: AwsCall[]): any {
    switch (service) {
      case 's3':
        return this.generateS3MockConfig(calls);
      case 'dynamodb':
        return this.generateDynamoDBMockConfig(calls);
      case 'lambda':
        return this.generateLambdaMockConfig(calls);
      case 'sqs':
        return this.generateSQSMockConfig(calls);
      case 'sns':
        return this.generateSNSMockConfig(calls);
      default:
        return { note: `Auto-generated config for ${service} service` };
    }
  }

  private generateS3MockConfig(calls: AwsCall[]): any {
    const config: any = { buckets: {} };

    // Extract unique buckets and keys
    const buckets: { [bucket: string]: { [key: string]: any } } = {};

    for (const call of calls) {
      if (call.parameters.Bucket && call.parameters.Key) {
        const bucket = call.parameters.Bucket;
        const key = call.parameters.Key;

        if (!buckets[bucket]) {
          buckets[bucket] = {};
        }

        // Generate enhanced mock content based on operation and file type
        if (call.operation === 'getObject' || call.operation === 'promise') {
          buckets[bucket][key] = {
            content: this.generateEnhancedMockContent(key),
            metadata: this.generateS3Metadata(key),
            lastModified: new Date().toISOString(),
            etag: `"${Math.random().toString(36).substring(2, 15)}"`,
            size: this.generateMockSize(key)
          };
        }
      }
    }

    // Add some default buckets with realistic data if none found
    if (Object.keys(buckets).length === 0) {
      buckets['my-app-bucket'] = {
        'config/app-config.json': {
          content: JSON.stringify({
            environment: 'development',
            database: {
              host: 'localhost',
              port: 5432,
              name: 'myapp_dev'
            },
            features: {
              logging: true,
              caching: false,
              notifications: true
            }
          }, null, 2),
          metadata: {
            ContentType: 'application/json',
            CacheControl: 'max-age=300'
          },
          lastModified: new Date().toISOString(),
          etag: '"config-etag-123"',
          size: 387
        },
        'data/users.json': {
          content: JSON.stringify([
            {
              id: 'user-001',
              name: 'John Doe',
              email: 'john@example.com',
              role: 'admin',
              createdAt: new Date().toISOString()
            },
            {
              id: 'user-002',
              name: 'Jane Smith',
              email: 'jane@example.com',
              role: 'user',
              createdAt: new Date().toISOString()
            }
          ], null, 2),
          metadata: {
            ContentType: 'application/json'
          },
          lastModified: new Date().toISOString(),
          etag: '"users-etag-456"',
          size: 482
        }
      };
    }

    config.buckets = buckets;
    return config;
  }

  private generateDynamoDBMockConfig(calls: AwsCall[]): any {
    const config: any = { tables: {} };

    // Extract unique tables
    const tables: { [table: string]: { items: any[]; keySchema: any[]; attributeDefinitions: any[] } } = {};

    for (const call of calls) {
      if (call.parameters.TableName) {
        const tableName = call.parameters.TableName;

        if (!tables[tableName]) {
          tables[tableName] = {
            items: [],
            keySchema: [
              { AttributeName: 'id', KeyType: 'HASH' }
            ],
            attributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' }
            ]
          };
        }

        // For get operations, add realistic mock items
        if (call.operation === 'get' || call.operation === 'getItem') {
          const mockItem = this.generateDynamoDBMockItem(tableName, call.parameters.Key);
          tables[tableName].items.push(mockItem);
        }

        // For scan/query operations, add multiple items
        if (call.operation === 'scan' || call.operation === 'query') {
          for (let i = 0; i < 5; i++) {
            const mockItem = this.generateDynamoDBMockItem(tableName);
            tables[tableName].items.push(mockItem);
          }
        }
      }
    }

    // Add default tables with realistic data if none found
    if (Object.keys(tables).length === 0) {
      tables['Users'] = {
        items: [
          {
            id: { S: 'user-001' },
            name: { S: 'John Doe' },
            email: { S: 'john.doe@example.com' },
            role: { S: 'admin' },
            status: { S: 'active' },
            createdAt: { S: new Date(Date.now() - 86400000 * 30).toISOString() },
            lastLogin: { S: new Date(Date.now() - 86400000 * 2).toISOString() },
            preferences: { M: {
              theme: { S: 'dark' },
              notifications: { BOOL: true },
              language: { S: 'en' }
            }}
          },
          {
            id: { S: 'user-002' },
            name: { S: 'Jane Smith' },
            email: { S: 'jane.smith@example.com' },
            role: { S: 'user' },
            status: { S: 'active' },
            createdAt: { S: new Date(Date.now() - 86400000 * 15).toISOString() },
            lastLogin: { S: new Date(Date.now() - 86400000 * 1).toISOString() },
            preferences: { M: {
              theme: { S: 'light' },
              notifications: { BOOL: false },
              language: { S: 'en' }
            }}
          }
        ],
        keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
      };

      tables['Products'] = {
        items: [
          {
            id: { S: 'prod-001' },
            name: { S: 'Premium Widget' },
            description: { S: 'A high-quality widget for professional use' },
            price: { N: '99.99' },
            currency: { S: 'USD' },
            category: { S: 'Electronics' },
            inStock: { BOOL: true },
            inventory: { N: '150' },
            rating: { N: '4.5' },
            tags: { SS: ['premium', 'professional', 'electronics'] }
          },
          {
            id: { S: 'prod-002' },
            name: { S: 'Basic Gadget' },
            description: { S: 'An affordable gadget for everyday use' },
            price: { N: '29.99' },
            currency: { S: 'USD' },
            category: { S: 'Electronics' },
            inStock: { BOOL: true },
            inventory: { N: '500' },
            rating: { N: '3.8' },
            tags: { SS: ['basic', 'affordable', 'electronics'] }
          }
        ],
        keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
      };
    }

    config.tables = tables;
    return config;
  }

  private generateLambdaMockConfig(calls: AwsCall[]): any {
    const config: any = { functions: {} };

    for (const call of calls) {
      if (call.parameters.FunctionName) {
        const functionName = call.parameters.FunctionName;
        config.functions[functionName] = {
          response: this.generateLambdaMockResponse(functionName, call.parameters),
          logs: [
            `START RequestId: ${Math.random().toString(36).substring(2, 15)} Version: $LATEST`,
            `2024-01-01T00:00:00.000Z\t${Math.random().toString(36).substring(2, 15)}\tINFO\tProcessing ${functionName} request`,
            `END RequestId: ${Math.random().toString(36).substring(2, 15)}`,
            `REPORT RequestId: ${Math.random().toString(36).substring(2, 15)}\tDuration: ${Math.random() * 1000 + 100} ms\tBilled Duration: ${Math.floor((Math.random() * 1000 + 100) / 100) * 100} ms\tMemory Size: 128 MB\tMax Memory Used: ${Math.floor(Math.random() * 64 + 32)} MB`
          ]
        };
      }
    }

    // Add default functions with realistic data if none found
    if (Object.keys(config.functions).length === 0) {
      config.functions['user-processor'] = {
        response: {
          statusCode: 200,
          body: JSON.stringify({
            message: 'User processed successfully',
            userId: 'user-001',
            processedAt: new Date().toISOString(),
            result: 'success'
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'processed'
          }
        },
        logs: [
          'START RequestId: mock-request-001 Version: $LATEST',
          '2024-01-01T00:00:00.000Z\tmock-request-001\tINFO\tProcessing user data',
          '2024-01-01T00:00:01.000Z\tmock-request-001\tINFO\tUser validation successful',
          'END RequestId: mock-request-001',
          'REPORT RequestId: mock-request-001\tDuration: 1250.00 ms\tBilled Duration: 1300 ms\tMemory Size: 128 MB\tMax Memory Used: 89 MB'
        ]
      };

      config.functions['order-fulfillment'] = {
        response: {
          statusCode: 200,
          body: JSON.stringify({
            orderId: 'order-12345',
            status: 'fulfilled',
            trackingNumber: '1Z999AA1234567890',
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [
              { productId: 'prod-001', quantity: 2, status: 'shipped' },
              { productId: 'prod-002', quantity: 1, status: 'shipped' }
            ]
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        },
        logs: [
          'START RequestId: mock-request-002 Version: $LATEST',
          '2024-01-01T00:00:00.000Z\tmock-request-002\tINFO\tProcessing order fulfillment',
          '2024-01-01T00:00:02.000Z\tmock-request-002\tINFO\tInventory check passed',
          '2024-01-01T00:00:03.000Z\tmock-request-002\tINFO\tShipping label generated',
          'END RequestId: mock-request-002',
          'REPORT RequestId: mock-request-002\tDuration: 3100.00 ms\tBilled Duration: 3200 ms\tMemory Size: 256 MB\tMax Memory Used: 156 MB'
        ]
      };
    }

    return config;
  }

  private generateLambdaMockResponse(functionName: string, parameters: any): any {
    const functionLower = functionName.toLowerCase();

    if (functionLower.includes('user') || functionLower.includes('auth')) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'User authentication successful',
          userId: parameters.userId || `user-${Math.random().toString(36).substring(2, 8)}`,
          token: `jwt-${Math.random().toString(36).substring(2, 15)}`,
          expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
          permissions: ['read', 'write', 'admin']
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-token'
        }
      };
    } else if (functionLower.includes('order') || functionLower.includes('purchase')) {
      return {
        statusCode: 201,
        body: JSON.stringify({
          orderId: `order-${Math.random().toString(36).substring(2, 8)}`,
          status: 'confirmed',
          total: (Math.random() * 500 + 20).toFixed(2),
          currency: 'USD',
          items: [
            {
              productId: `prod-${Math.random().toString(36).substring(2, 8)}`,
              name: 'Premium Product',
              quantity: Math.floor(Math.random() * 5) + 1,
              price: (Math.random() * 100 + 10).toFixed(2)
            }
          ],
          createdAt: new Date().toISOString()
        }),
        headers: {
          'Content-Type': 'application/json',
          'Location': `/orders/order-${Math.random().toString(36).substring(2, 8)}`
        }
      };
    } else if (functionLower.includes('notification') || functionLower.includes('email')) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          messageId: `msg-${Math.random().toString(36).substring(2, 8)}`,
          status: 'sent',
          recipient: parameters.email || 'user@example.com',
          subject: parameters.subject || 'Notification from AWS Walled Garden',
          sentAt: new Date().toISOString()
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };
    } else {
      // Generic response
      return {
        statusCode: 200,
        body: JSON.stringify({
          result: `Mock response from ${functionName}`,
          timestamp: new Date().toISOString(),
          requestId: `req-${Math.random().toString(36).substring(2, 8)}`,
          data: {
            processed: true,
            duration: Math.floor(Math.random() * 5000) + 100
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Function-Name': functionName
        }
      };
    }
  }

  private generateSQSMockConfig(calls: AwsCall[]): any {
    const config: any = { queues: {} };

    for (const call of calls) {
      if (call.parameters.QueueUrl) {
        const queueUrl = call.parameters.QueueUrl;
        const queueName = queueUrl.split('/').pop() || 'default-queue';
        config.queues[queueName] = {
          messages: this.generateSQSMockMessages(queueName, call.operation)
        };
      }
    }

    // Add default queues with realistic data if none found
    if (Object.keys(config.queues).length === 0) {
      config.queues['user-events'] = {
        messages: [
          {
            messageId: 'msg-001',
            receiptHandle: 'mock-receipt-handle-001',
            body: JSON.stringify({
              eventType: 'user.created',
              userId: 'user-001',
              email: 'john.doe@example.com',
              name: 'John Doe',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              source: 'user-service'
            }),
            attributes: {
              SentTimestamp: Date.now().toString(),
              ApproximateReceiveCount: '1',
              ApproximateFirstReceiveTimestamp: Date.now().toString()
            }
          },
          {
            messageId: 'msg-002',
            receiptHandle: 'mock-receipt-handle-002',
            body: JSON.stringify({
              eventType: 'user.updated',
              userId: 'user-001',
              changes: { name: 'John Smith' },
              timestamp: new Date(Date.now() - 1800000).toISOString(),
              source: 'user-service'
            }),
            attributes: {
              SentTimestamp: (Date.now() - 1800000).toString(),
              ApproximateReceiveCount: '1',
              ApproximateFirstReceiveTimestamp: (Date.now() - 1800000).toString()
            }
          }
        ]
      };

      config.queues['order-processing'] = {
        messages: [
          {
            messageId: 'msg-003',
            receiptHandle: 'mock-receipt-handle-003',
            body: JSON.stringify({
              eventType: 'order.placed',
              orderId: 'order-12345',
              customerId: 'user-001',
              total: 129.99,
              currency: 'USD',
              items: [
                { productId: 'prod-001', quantity: 2, price: 49.99 },
                { productId: 'prod-002', quantity: 1, price: 30.01 }
              ],
              timestamp: new Date(Date.now() - 900000).toISOString(),
              source: 'order-service'
            }),
            attributes: {
              SentTimestamp: (Date.now() - 900000).toString(),
              ApproximateReceiveCount: '1',
              ApproximateFirstReceiveTimestamp: (Date.now() - 900000).toString()
            }
          }
        ]
      };
    }

    return config;
  }

  private generateSQSMockMessages(queueName: string, operation: string): any[] {
    const messages: any[] = [];
    const queueLower = queueName.toLowerCase();

    // Generate different messages based on queue type and operation
    let messageCount = 1;

    if (operation === 'receiveMessage' || operation === 'receiveMessages') {
      messageCount = Math.floor(Math.random() * 5) + 1; // 1-5 messages
    }

    for (let i = 0; i < messageCount; i++) {
      const messageId = `msg-${Math.random().toString(36).substring(2, 8)}`;
      const receiptHandle = `mock-receipt-${Math.random().toString(36).substring(2, 15)}`;
      const timestamp = new Date(Date.now() - Math.random() * 3600000); // Within last hour

      let body: any = {};

      if (queueLower.includes('user') || queueLower.includes('auth')) {
        body = {
          eventType: ['user.created', 'user.updated', 'user.deleted'][Math.floor(Math.random() * 3)],
          userId: `user-${Math.random().toString(36).substring(2, 8)}`,
          email: `user${i}@example.com`,
          name: this.generateRandomName(),
          timestamp: timestamp.toISOString(),
          source: 'user-service'
        };
      } else if (queueLower.includes('order')) {
        body = {
          eventType: 'order.placed',
          orderId: `order-${Math.random().toString(36).substring(2, 8)}`,
          customerId: `user-${Math.random().toString(36).substring(2, 8)}`,
          total: (Math.random() * 1000 + 10).toFixed(2),
          currency: 'USD',
          items: [
            {
              productId: `prod-${Math.random().toString(36).substring(2, 8)}`,
              quantity: Math.floor(Math.random() * 5) + 1,
              price: (Math.random() * 200 + 5).toFixed(2)
            }
          ],
          timestamp: timestamp.toISOString(),
          source: 'order-service'
        };
      } else if (queueLower.includes('notification') || queueLower.includes('email')) {
        body = {
          eventType: 'notification.send',
          recipient: `user${i}@example.com`,
          subject: 'Important Update',
          message: 'This is a mock notification message from AWS Walled Garden',
          priority: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)],
          timestamp: timestamp.toISOString(),
          source: 'notification-service'
        };
      } else {
        // Generic message
        body = {
          eventType: 'generic.event',
          id: Math.random().toString(36).substring(2, 15),
          data: `Mock data for ${queueName}`,
          timestamp: timestamp.toISOString(),
          source: 'mock-service'
        };
      }

      messages.push({
        messageId,
        receiptHandle,
        body: JSON.stringify(body),
        attributes: {
          SentTimestamp: timestamp.getTime().toString(),
          ApproximateReceiveCount: '1',
          ApproximateFirstReceiveTimestamp: timestamp.getTime().toString()
        }
      });
    }

    return messages;
  }

  private generateDynamoDBMockItem(tableName: string, key?: any): any {
    const item: any = {};

    // Use provided key or generate one
    if (key) {
      for (const [keyName, keyValue] of Object.entries(key)) {
        item[keyName] = keyValue;
      }
    } else {
      item.id = { S: `mock-${tableName.toLowerCase()}-${Math.random().toString(36).substring(2, 8)}` };
    }

    // Add realistic data based on table name
    const tableLower = tableName.toLowerCase();

    if (tableLower.includes('user')) {
      item.name = { S: this.generateRandomName() };
      item.email = { S: `${item.name.S.toLowerCase().replace(' ', '.')}@example.com` };
      item.role = { S: Math.random() > 0.8 ? 'admin' : 'user' };
      item.status = { S: Math.random() > 0.9 ? 'inactive' : 'active' };
      item.createdAt = { S: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString() };
      item.lastLogin = { S: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() };
      item.preferences = { M: {
        theme: { S: Math.random() > 0.5 ? 'dark' : 'light' },
        notifications: { BOOL: Math.random() > 0.3 },
        language: { S: 'en' }
      }};
    } else if (tableLower.includes('product') || tableLower.includes('item')) {
      item.name = { S: `Premium ${this.generateRandomProductType()}` };
      item.description = { S: `A high-quality ${item.name.S.toLowerCase()} for professional use` };
      item.price = { N: (Math.random() * 200 + 10).toFixed(2) };
      item.currency = { S: 'USD' };
      item.category = { S: this.generateRandomCategory() };
      item.inStock = { BOOL: Math.random() > 0.2 };
      item.inventory = { N: Math.floor(Math.random() * 1000 + 10).toString() };
      item.rating = { N: (Math.random() * 2 + 3).toFixed(1) }; // 3.0 to 5.0
      item.tags = { SS: this.generateRandomTags() };
    } else if (tableLower.includes('order')) {
      item.orderId = item.id || { S: `order-${Math.random().toString(36).substring(2, 8)}` };
      item.customerId = { S: `user-${Math.random().toString(36).substring(2, 8)}` };
      item.total = { N: (Math.random() * 500 + 20).toFixed(2) };
      item.currency = { S: 'USD' };
      item.status = { S: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)] };
      item.createdAt = { S: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() };
      item.items = { L: [
        { M: {
          productId: { S: `prod-${Math.random().toString(36).substring(2, 8)}` },
          quantity: { N: Math.floor(Math.random() * 5 + 1).toString() },
          price: { N: (Math.random() * 100 + 10).toFixed(2) }
        }}
      ]};
    } else {
      // Generic item
      item.name = { S: `Mock ${tableName} Item` };
      item.description = { S: `This is a mock item for the ${tableName} table` };
      item.createdAt = { S: new Date().toISOString() };
      item.updatedAt = { S: new Date().toISOString() };
      item.version = { N: '1' };
    }

    return item;
  }

  private generateRandomName(): string {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Robert', 'Maria'];
    const lastNames = ['Doe', 'Smith', 'Johnson', 'Brown', 'Williams', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }

  private generateRandomProductType(): string {
    const types = ['Widget', 'Gadget', 'Tool', 'Device', 'Component', 'Module', 'System', 'Package', 'Kit', 'Suite'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateRandomCategory(): string {
    const categories = ['Electronics', 'Software', 'Hardware', 'Services', 'Tools', 'Accessories', 'Components', 'Systems'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private generateRandomTags(): string[] {
    const allTags = ['premium', 'basic', 'professional', 'enterprise', 'standard', 'advanced', 'new', 'featured', 'popular', 'discounted'];
    const numTags = Math.floor(Math.random() * 4) + 1;
    const tags: string[] = [];
    for (let i = 0; i < numTags; i++) {
      tags.push(allTags[Math.floor(Math.random() * allTags.length)]);
    }
    return [...new Set(tags)]; // Remove duplicates
  }

  private generateSNSMockConfig(calls: AwsCall[]): any {
    const config: any = { topics: {} };

    for (const call of calls) {
      if (call.parameters.TopicArn) {
        const topicArn = call.parameters.TopicArn;
        const topicName = topicArn.split(':').pop() || 'default-topic';
        config.topics[topicName] = {
          subscriptions: []
        };
      }
    }

    // Add default topics with realistic data if none found
    if (Object.keys(config.topics).length === 0) {
      config.topics['user-notifications'] = {
        subscriptions: [
          {
            endpoint: 'user@example.com',
            protocol: 'email',
            subscriptionArn: 'arn:aws:sns:us-east-1:123456789012:user-notifications:subscription-001'
          },
          {
            endpoint: 'https://api.example.com/webhook',
            protocol: 'https',
            subscriptionArn: 'arn:aws:sns:us-east-1:123456789012:user-notifications:subscription-002'
          }
        ]
      };

      config.topics['order-updates'] = {
        subscriptions: [
          {
            endpoint: '+1234567890',
            protocol: 'sms',
            subscriptionArn: 'arn:aws:sns:us-east-1:123456789012:order-updates:subscription-001'
          }
        ]
      };
    }

    return config;
  }

  private generateEnhancedMockContent(key: string): string {
    const fileName = key.toLowerCase();

    if (fileName.includes('config') && fileName.endsWith('.json')) {
      return JSON.stringify({
        environment: 'development',
        version: '1.0.0',
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp_dev',
          ssl: false
        },
        cache: {
          enabled: true,
          ttl: 3600,
          redis: {
            host: 'localhost',
            port: 6379
          }
        },
        features: {
          logging: true,
          metrics: false,
          notifications: true,
          authentication: true
        },
        api: {
          baseUrl: 'https://api.example.com',
          timeout: 30000,
          retries: 3
        }
      }, null, 2);
    }

    if (fileName.includes('user') && fileName.endsWith('.json')) {
      return JSON.stringify([
        {
          id: 'user-001',
          name: 'John Doe',
          email: 'john.doe@example.com',
          role: 'admin',
          status: 'active',
          createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          lastLogin: new Date(Date.now() - 86400000 * 2).toISOString(),
          preferences: {
            theme: 'dark',
            notifications: true,
            language: 'en'
          }
        },
        {
          id: 'user-002',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: 'user',
          status: 'active',
          createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          lastLogin: new Date(Date.now() - 86400000 * 1).toISOString(),
          preferences: {
            theme: 'light',
            notifications: false,
            language: 'en'
          }
        },
        {
          id: 'user-003',
          name: 'Bob Johnson',
          email: 'bob.johnson@example.com',
          role: 'moderator',
          status: 'inactive',
          createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
          lastLogin: new Date(Date.now() - 86400000 * 10).toISOString(),
          preferences: {
            theme: 'auto',
            notifications: true,
            language: 'es'
          }
        }
      ], null, 2);
    }

    if (fileName.includes('product') && fileName.endsWith('.json')) {
      return JSON.stringify([
        {
          id: 'prod-001',
          name: 'Premium Widget',
          description: 'A high-quality widget for professional use',
          price: 99.99,
          currency: 'USD',
          category: 'Electronics',
          inStock: true,
          inventory: 150,
          rating: 4.5,
          reviews: 128,
          tags: ['premium', 'professional', 'electronics']
        },
        {
          id: 'prod-002',
          name: 'Basic Gadget',
          description: 'An affordable gadget for everyday use',
          price: 29.99,
          currency: 'USD',
          category: 'Electronics',
          inStock: true,
          inventory: 500,
          rating: 3.8,
          reviews: 89,
          tags: ['basic', 'affordable', 'electronics']
        }
      ], null, 2);
    }

    if (fileName.endsWith('.json')) {
      return JSON.stringify({
        message: `Enhanced mock content for ${key}`,
        generated: true,
        timestamp: new Date().toISOString(),
        data: {
          id: Math.random().toString(36).substring(2, 15),
          type: 'mock',
          attributes: {
            name: `Sample ${key.replace(/[^a-zA-Z]/g, ' ').trim()}`,
            description: `This is a mock response for ${key}`,
            version: '1.0'
          }
        }
      }, null, 2);
    }

    if (fileName.endsWith('.txt')) {
      return `Enhanced mock text content for ${key}\n\nThis is a more realistic text file with multiple lines.\nIt contains sample data that might be found in a real application.\n\nGenerated at: ${new Date().toISOString()}\nFile: ${key}`;
    }

    if (fileName.endsWith('.html')) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Page - ${key}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .content { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Mock HTML Content</h1>
            <p>This is a realistic HTML page for ${key}</p>
        </div>
        <div class="content">
            <p>Generated at: ${new Date().toISOString()}</p>
            <p>This mock content provides a realistic HTML structure that applications might expect.</p>
        </div>
    </div>
</body>
</html>`;
    }

    // Default content for other file types
    return `Enhanced mock content for ${key}\n\nThis file contains realistic sample data for testing purposes.\nGenerated timestamp: ${new Date().toISOString()}\n\nMock data can help with development and testing workflows.`;
  }

  private guessContentType(key: string): string {
    const fileName = key.toLowerCase();

    if (fileName.endsWith('.json')) return 'application/json';
    if (fileName.endsWith('.txt')) return 'text/plain';
    if (fileName.endsWith('.html')) return 'text/html';
    if (fileName.endsWith('.css')) return 'text/css';
    if (fileName.endsWith('.js')) return 'application/javascript';
    if (fileName.endsWith('.xml')) return 'application/xml';
    if (fileName.endsWith('.pdf')) return 'application/pdf';
    if (fileName.endsWith('.zip')) return 'application/zip';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
    if (fileName.endsWith('.png')) return 'image/png';
    if (fileName.endsWith('.gif')) return 'image/gif';
    if (fileName.endsWith('.svg')) return 'image/svg+xml';

    return 'application/octet-stream';
  }

  private generateS3Metadata(key: string): any {
    const metadata: any = {
      ContentType: this.guessContentType(key)
    };

    const fileName = key.toLowerCase();

    // Add realistic metadata based on file type
    if (fileName.endsWith('.json')) {
      metadata.CacheControl = 'max-age=300';
      metadata.ContentEncoding = 'gzip';
    } else if (fileName.endsWith('.html')) {
      metadata.CacheControl = 'max-age=3600';
      metadata.ContentLanguage = 'en-US';
    } else if (fileName.endsWith('.css') || fileName.endsWith('.js')) {
      metadata.CacheControl = 'max-age=31536000'; // 1 year
      metadata.ContentEncoding = 'gzip';
    } else if (fileName.includes('image')) {
      metadata.CacheControl = 'max-age=86400'; // 1 day
    }

    // Add some common AWS metadata
    metadata.Server = 'AmazonS3';
    metadata.x_amz_id_2 = 'mock-amz-id-' + Math.random().toString(36).substring(2, 15);
    metadata.x_amz_request_id = 'mock-request-' + Math.random().toString(36).substring(2, 15);

    return metadata;
  }

  private generateMockSize(key: string): number {
    const fileName = key.toLowerCase();

    // Realistic file sizes based on content type
    if (fileName.endsWith('.json')) {
      return Math.floor(Math.random() * 5000) + 100; // 100-5100 bytes
    } else if (fileName.endsWith('.html')) {
      return Math.floor(Math.random() * 10000) + 500; // 500-10500 bytes
    } else if (fileName.endsWith('.txt')) {
      return Math.floor(Math.random() * 2000) + 50; // 50-2050 bytes
    } else if (fileName.includes('image') || fileName.endsWith('.jpg') || fileName.endsWith('.png')) {
      return Math.floor(Math.random() * 500000) + 10000; // 10KB-510KB
    } else {
      return Math.floor(Math.random() * 10000) + 100; // 100-10100 bytes
    }
  }

  private async saveOrUpdateConfig(mockConfig: MockConfig): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const config = vscode.workspace.getConfiguration('awsWalledGarden');
    const configFile = config.get('configFile', '.aws-mock.json');
    const configPath = path.join(workspaceFolders[0].uri.fsPath, configFile);

    let existingConfig: MockConfig | null = null;

    // Try to load existing config
    if (fs.existsSync(configPath)) {
      try {
        const existingContent = fs.readFileSync(configPath, 'utf8');
        existingConfig = JSON.parse(existingContent);
      } catch (error) {
        this.logger.warn('Could not parse existing config, will overwrite');
      }
    }

    // Merge configs if existing
    const finalConfig = existingConfig ? this.mergeConfigs(existingConfig, mockConfig) : mockConfig;

    // Save the config
    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
    this.logger.info(`Saved auto-generated mock configuration to ${configFile}`);
  }

  private mergeConfigs(existing: MockConfig, generated: MockConfig): MockConfig {
    const merged: MockConfig = {
      version: existing.version || generated.version,
      services: { ...existing.services }
    };

    // Merge services
    for (const [service, serviceConfig] of Object.entries(generated.services)) {
      if (!merged.services[service]) {
        merged.services[service] = serviceConfig;
      } else {
        // For now, just add new properties without overwriting existing ones
        merged.services[service] = {
          ...serviceConfig,
          ...merged.services[service]
        };
      }
    }

    return merged;
  }

  private async analyzeProjectStructure(workspacePath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      type: 'unknown',
      rootPath: workspacePath
    };

    // Check for monorepo indicators
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const lernaPath = path.join(workspacePath, 'lerna.json');
    const yarnWorkspacesPath = path.join(workspacePath, 'package.json');
    const pnpmWorkspacesPath = path.join(workspacePath, 'pnpm-workspace.yaml');

    if (fs.existsSync(lernaPath)) {
      structure.type = 'monorepo';
      // Could parse lerna.json for packages
    } else if (fs.existsSync(yarnWorkspacesPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.workspaces) {
          structure.type = 'monorepo';
          structure.packages = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : packageJson.workspaces.packages;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    } else if (fs.existsSync(pnpmWorkspacesPath)) {
      structure.type = 'monorepo';
      // Could parse pnpm-workspace.yaml
    }

    // Check for microservices (multiple service directories)
    const srcPath = path.join(workspacePath, 'src');
    const servicesPath = path.join(workspacePath, 'services');
    const appsPath = path.join(workspacePath, 'apps');

    if (fs.existsSync(servicesPath) || fs.existsSync(appsPath)) {
      structure.type = 'microservices';
      // Could scan for service directories
    }

    // Default to single app if no specific structure detected
    if (structure.type === 'unknown') {
      structure.type = 'single-app';
    }

    return structure;
  }

  private async detectSdkUsage(): Promise<SdkUsage> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return { version: 'unknown', files: [], hasProxyConfig: false, languages: [], frameworks: [], entryPoints: [] };
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const files = await this.findRelevantFiles(workspacePath);
    const projectStructure = await this.analyzeProjectStructure(workspacePath);

    let sdkVersion: 'v2' | 'v3' | 'unknown' = 'unknown';
    const sdkFiles: string[] = [];
    let hasProxyConfig = false;
    const languages: string[] = [];
    const frameworks: string[] = [];
    const entryPoints: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');

      // Detect language
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        if (!languages.includes('typescript')) languages.push('typescript');
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        if (!languages.includes('javascript')) languages.push('javascript');
      }

      // Detect frameworks
      if (content.includes('express') || content.includes('require(\'express\')')) {
        if (!frameworks.includes('express')) frameworks.push('express');
      }
      if (content.includes('fastify')) {
        if (!frameworks.includes('fastify')) frameworks.push('fastify');
      }
      if (content.includes('next') || content.includes('@next')) {
        if (!frameworks.includes('nextjs')) frameworks.push('nextjs');
      }

      // Check for AWS SDK v3 imports (more specific patterns)
      if (content.includes('@aws-sdk/') ||
          content.includes('from "@aws-sdk/') ||
          content.includes('import.*@aws-sdk')) {
        sdkVersion = 'v3';
        sdkFiles.push(file);
      }
      // Check for AWS SDK v2 imports (more specific patterns)
      else if (content.includes('aws-sdk') ||
               content.includes('require(\'aws-sdk\')') ||
               content.includes('from \'aws-sdk\'') ||
               content.includes('import.*aws-sdk')) {
        if (sdkVersion !== 'v3') { // v3 takes precedence
          sdkVersion = 'v2';
        }
        sdkFiles.push(file);
      }

      // Check for proxy configuration (expanded patterns)
      if (content.includes('https-proxy-agent') ||
          content.includes('HttpsProxyAgent') ||
          content.includes('HTTP_PROXY') ||
          content.includes('HTTPS_PROXY') ||
          content.includes('localhost:3128') ||
          content.includes('127.0.0.1:3128') ||
          content.includes('httpAgent') ||
          content.includes('httpsAgent') ||
          content.includes('proxy') && content.includes('agent')) {
        hasProxyConfig = true;
      }

      // Identify potential entry points
      const fileName = path.basename(file);
      if (['index.js', 'index.ts', 'app.js', 'app.ts', 'server.js', 'server.ts', 'main.js', 'main.ts'].includes(fileName)) {
        entryPoints.push(file);
      }
    }

    return {
      version: sdkVersion,
      files: [...new Set(sdkFiles)], // Remove duplicates
      hasProxyConfig,
      languages,
      frameworks,
      entryPoints
    };
  }

  private determineInjectionStrategies(sdkUsage: SdkUsage): string[] {
    const strategies: string[] = [];

    // Always offer direct code injection
    strategies.push('inject-code');

    // Offer environment variable configuration for containerized apps
    if (sdkUsage.frameworks.includes('express') || sdkUsage.frameworks.includes('fastify')) {
      strategies.push('env-vars');
    }

    // Offer webpack configuration for bundler-based projects
    if (this.hasWebpackConfig()) {
      strategies.push('webpack-config');
    }

    // Offer separate config file for complex projects
    if (sdkUsage.files.length > 3) {
      strategies.push('config-file');
    }

    return strategies;
  }

  private hasWebpackConfig(): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const webpackConfigs = ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'];

    return webpackConfigs.some(config => fs.existsSync(path.join(workspacePath, config)));
  }

  private async findBestEntryPoints(sdkUsage: SdkUsage): Promise<string[]> {
    const entryPoints: string[] = [];

    // Use identified entry points from SDK usage
    entryPoints.push(...sdkUsage.entryPoints);

    // Add additional common entry points
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return entryPoints;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const commonPatterns = [
      'index.js', 'index.ts', 'app.js', 'app.ts', 'server.js', 'server.ts',
      'main.js', 'main.ts', 'bootstrap.js', 'bootstrap.ts'
    ];

    // Check root and src directories
    const searchDirs = [workspacePath, path.join(workspacePath, 'src'), path.join(workspacePath, 'lib')];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        for (const pattern of commonPatterns) {
          const filePath = path.join(dir, pattern);
          if (fs.existsSync(filePath) && !entryPoints.includes(filePath)) {
            entryPoints.push(filePath);
          }
        }
      }
    }

    return entryPoints;
  }

  private buildInjectionOptions(strategies: string[], entryPoints: string[]): vscode.QuickPickItem[] {
    const options: vscode.QuickPickItem[] = [];

    // Code injection options
    if (strategies.includes('inject-code') && entryPoints.length > 0) {
      entryPoints.slice(0, 3).forEach(entryPoint => { // Limit to first 3 entry points
        options.push({
          label: `Inject into ${path.basename(entryPoint)}`,
          description: `Add proxy config directly to ${path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, entryPoint)}`,
          detail: 'Recommended for simple applications'
        });
      });
    }

    // Environment variables option
    if (strategies.includes('env-vars')) {
      options.push({
        label: 'Set Environment Variables',
        description: 'Configure via HTTP_PROXY and HTTPS_PROXY environment variables',
        detail: 'Good for containerized applications'
      });
    }

    // Webpack configuration option
    if (strategies.includes('webpack-config')) {
      options.push({
        label: 'Update Webpack Configuration',
        description: 'Add proxy configuration to webpack config',
        detail: 'For webpack-based applications'
      });
    }

    // Separate config file option
    if (strategies.includes('config-file')) {
      options.push({
        label: 'Create AWS Config File',
        description: 'Create a separate aws-config.js file with proxy settings',
        detail: 'For complex applications with multiple entry points'
      });
    }

    // Always offer to just show the configuration
    options.push({
      label: 'Show Configuration Only',
      description: 'Display the proxy configuration code for manual setup',
      detail: 'Copy and paste into your application'
    });

    return options;
  }

  private async executeInjectionStrategy(selectedOption: vscode.QuickPickItem, sdkUsage: SdkUsage): Promise<void> {
    const proxyConfig = this.generateProxyConfigCode(sdkUsage.version);

    if (selectedOption.label.startsWith('Inject into ')) {
      // Extract filename from label
      const fileName = selectedOption.label.replace('Inject into ', '');
      const entryPoint = sdkUsage.entryPoints.find(ep => path.basename(ep) === fileName) ||
                        (await this.findBestEntryPoints(sdkUsage)).find(ep => path.basename(ep) === fileName);

      if (entryPoint) {
        await this.injectProxyConfig(entryPoint, proxyConfig, sdkUsage.version);
        vscode.window.showInformationMessage(`Proxy configuration added to ${fileName}`);
      }
    } else if (selectedOption.label === 'Set Environment Variables') {
      await this.createEnvFile();
      vscode.window.showInformationMessage('Environment variables configured for proxy setup');
    } else if (selectedOption.label === 'Update Webpack Configuration') {
      await this.updateWebpackConfig();
      vscode.window.showInformationMessage('Webpack configuration updated with proxy settings');
    } else if (selectedOption.label === 'Create AWS Config File') {
      await this.createAwsConfigFile(proxyConfig);
      vscode.window.showInformationMessage('AWS config file created with proxy settings');
    } else {
      // Show configuration only
      const doc = await vscode.workspace.openTextDocument({
        content: proxyConfig,
        language: 'javascript'
      });
      await vscode.window.showTextDocument(doc);
    }
  }

  private async createEnvFile(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const envFile = path.join(workspacePath, '.env');

    const envContent = `# AWS Walled Garden Proxy Configuration
HTTP_PROXY=http://localhost:3128
HTTPS_PROXY=http://localhost:3128
NO_PROXY=localhost,127.0.0.1
`;

    fs.writeFileSync(envFile, envContent);
  }

  private async updateWebpackConfig(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const webpackConfigPath = path.join(workspacePath, 'webpack.config.js');

    if (!fs.existsSync(webpackConfigPath)) return;

    const content = fs.readFileSync(webpackConfigPath, 'utf8');

    // Add proxy configuration to webpack dev server
    const proxyConfig = `
  devServer: {
    proxy: {
      '/aws-api': {
        target: 'http://localhost:3128',
        changeOrigin: true,
        pathRewrite: { '^/aws-api': '' }
      }
    }
  },`;

    // Insert before the closing brace
    const updatedContent = content.replace(/}(\s*);?\s*$/, `${proxyConfig}\n}$1`);

    fs.writeFileSync(webpackConfigPath, updatedContent);
  }

  private async createAwsConfigFile(proxyConfig: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const configFile = path.join(workspacePath, 'aws-config.js');

    const configContent = `// AWS Configuration for AWS Walled Garden
// This file contains proxy configuration for AWS SDK

${proxyConfig}

// Export for use in other files
module.exports = { httpsAgent };
`;

    fs.writeFileSync(configFile, configContent);
  }

  private async configureProxyForSdk(sdkUsage: SdkUsage): Promise<void> {
    if (sdkUsage.files.length === 0) {
      return;
    }

    // Determine the best injection strategy based on project structure and SDK usage
    const injectionStrategies = this.determineInjectionStrategies(sdkUsage);

    // Find the best entry point(s) for injection
    const entryPoints = await this.findBestEntryPoints(sdkUsage);

    if (entryPoints.length === 0) {
      // If no clear entry points, show the configuration code to user
      const proxyConfig = this.generateProxyConfigCode(sdkUsage.version);
      const doc = await vscode.workspace.openTextDocument({
        content: proxyConfig,
        language: 'javascript'
      });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Copy this proxy configuration into your AWS SDK setup file');
      return;
    }

    // Offer different injection options based on available strategies
    const injectionOptions = this.buildInjectionOptions(injectionStrategies, entryPoints);
    const selectedOption = await vscode.window.showQuickPick(injectionOptions, {
      placeHolder: 'Choose how to configure AWS SDK proxy for AWS Walled Garden'
    });

    if (!selectedOption) {
      return; // User cancelled
    }

    // Execute the selected injection strategy
    await this.executeInjectionStrategy(selectedOption, sdkUsage);
  }

  private generateProxyConfigCode(version: 'v2' | 'v3' | 'unknown'): string {
    if (version === 'unknown') {
      return `// AWS SDK Proxy Configuration for AWS Walled Garden
// Unable to detect SDK version automatically
// Please configure based on your AWS SDK version:

// For AWS SDK v3 (@aws-sdk packages):
import { HttpsProxyAgent } from 'https-proxy-agent';
const httpsAgent = new HttpsProxyAgent('http://localhost:3128');

// For AWS SDK v2 (aws-sdk package):
const AWS = require('aws-sdk');
const HttpsProxyAgent = require('https-proxy-agent');
const httpsAgent = new HttpsProxyAgent('http://localhost:3128');

AWS.config.update({
  httpOptions: { agent: httpsAgent }
});

// This enables AWS Walled Garden to intercept and mock AWS calls`;
    }

    if (version === 'v3') {
      return `// AWS SDK v3 Proxy Configuration for AWS Walled Garden
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configure AWS SDK to use the extension's proxy
const httpsAgent = new HttpsProxyAgent('http://localhost:3128');

// Example usage with S3Client:
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'us-east-1',
  requestHandler: {
    httpsAgent: httpsAgent
  }
});

// For other services, add the same requestHandler configuration
// This enables AWS Walled Garden to intercept and mock AWS calls`;
    } else {
      return `// AWS SDK v2 Proxy Configuration for AWS Walled Garden
const AWS = require('aws-sdk');
const HttpsProxyAgent = require('https-proxy-agent');

// Configure AWS SDK to use the extension's proxy
const httpsAgent = new HttpsProxyAgent('http://localhost:3128');

AWS.config.update({
  region: 'us-east-1',
  httpOptions: {
    agent: httpsAgent
  }
});

// Alternative: Configure individual services
// const s3 = new AWS.S3({
//   httpOptions: { agent: httpsAgent }
// });

// This enables AWS Walled Garden to intercept and mock AWS calls`;
    }
  }

  private async findBestEntryPoint(files: string[]): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Priority order for entry points
    const entryPointPatterns = [
      'index.js',
      'app.js',
      'server.js',
      'main.js',
      'index.ts',
      'app.ts',
      'server.ts',
      'main.ts'
    ];

    // Check root level first
    for (const pattern of entryPointPatterns) {
      const rootFile = path.join(workspacePath, pattern);
      if (files.includes(rootFile)) {
        return rootFile;
      }
    }

    // Check src directory
    for (const pattern of entryPointPatterns) {
      const srcFile = path.join(workspacePath, 'src', pattern);
      if (files.includes(srcFile)) {
        return srcFile;
      }
    }

    // Return the first file with AWS SDK usage
    return files.length > 0 ? files[0] : null;
  }

  private async injectProxyConfig(filePath: string, proxyConfig: string, version: 'v2' | 'v3' | 'unknown'): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Find the best place to inject the configuration
    let injectIndex = 0;

    // Look for existing AWS SDK imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ((version === 'v3' || version === 'unknown') && (line.includes('@aws-sdk/') || line.includes('from "@aws-sdk/'))) {
        injectIndex = i + 1;
        break;
      } else if ((version === 'v2' || version === 'unknown') && (line.includes('aws-sdk') || line.includes('require(\'aws-sdk\')'))) {
        injectIndex = i + 1;
        break;
      }
    }

    // If no AWS imports found, inject at the top after any existing imports
    if (injectIndex === 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('import') && !line.startsWith('const') && !line.startsWith('require') && line.trim() !== '') {
          injectIndex = i;
          break;
        }
      }
    }

    // Add the proxy configuration
    const configLines = proxyConfig.split('\n');
    lines.splice(injectIndex, 0, '', ...configLines, '');

    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'));
  }
}