import { MockConfig } from './mockManager';
import * as vscode from 'vscode';

export class ConfigValidator {
  private static readonly SCHEMA = {
    type: 'object',
    required: ['version', 'services'],
    properties: {
      version: {
        type: 'string',
        pattern: '^\\d+\\.\\d+$'
      },
      services: {
        type: 'object',
        patternProperties: {
          '.*': {
            type: 'object'
          }
        }
      },
      global: {
        type: 'object',
        properties: {
          port: { type: 'integer', minimum: 1024, maximum: 65535 },
          host: { type: 'string' },
          logLevel: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
          recordRequests: { type: 'boolean' },
          delayResponses: { type: 'integer', minimum: 0 }
        }
      }
    }
  };

  private static readonly SUPPORTED_SERVICES = [
    's3', 'dynamodb', 'lambda', 'sqs', 'sns', 'ec2', 'rds', 'cloudformation',
    'iam', 'sts', 'ssm', 'secretsmanager', 'kms', 'cloudwatch', 'route53',
    'elb', 'autoscaling', 'elasticache', 'redshift', 'athena', 'glue',
    'stepfunctions', 'eventbridge', 'apigateway'
  ];

  public static validate(config: any): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Check required fields
    if (!config || typeof config !== 'object') {
      errors.push({
        message: 'Configuration must be a valid JSON object',
        path: '',
        severity: 'error',
        suggestion: 'Ensure the file contains valid JSON syntax'
      });
      return { valid: false, errors };
    }

    if (!config.version || typeof config.version !== 'string') {
      errors.push({
        message: 'Configuration must have a "version" field',
        path: 'version',
        severity: 'error',
        suggestion: 'Add "version": "1.0" to the root of your configuration'
      });
    }

    if (!config.services || typeof config.services !== 'object') {
      errors.push({
        message: 'Configuration must have a "services" field',
        path: 'services',
        severity: 'error',
        suggestion: 'Add "services": {} to the root of your configuration'
      });
    }

    // Validate version format
    if (config.version && !/^\d+\.\d+$/.test(config.version)) {
      errors.push({
        message: 'Version must be in format "x.y" (e.g., "1.0")',
        path: 'version',
        severity: 'error',
        suggestion: 'Change version to "1.0" or similar format'
      });
    }

    // Validate services structure
    if (config.services) {
      this.validateServices(config.services, errors);
    }

    // Validate global configuration
    if (config.global) {
      this.validateGlobalConfig(config.global, errors);
    }

    return { valid: errors.length === 0, errors };
  }

  private static validateServices(services: any, errors: ValidationError[]): void {
    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      if (!this.SUPPORTED_SERVICES.includes(serviceName)) {
        errors.push({
          message: `Unsupported service: ${serviceName}`,
          path: `services.${serviceName}`,
          severity: 'error',
          suggestion: `Use one of: ${this.SUPPORTED_SERVICES.join(', ')}`
        });
        continue;
      }

      if (typeof serviceConfig !== 'object' || serviceConfig === null) {
        errors.push({
          message: `Service ${serviceName} must be an object`,
          path: `services.${serviceName}`,
          severity: 'error',
          suggestion: `Change ${serviceName} to an object with service configuration`
        });
        continue;
      }

      // Service-specific validation
      switch (serviceName) {
        case 's3':
          this.validateS3Config(serviceName, serviceConfig, errors);
          break;
        case 'dynamodb':
          this.validateDynamoDBConfig(serviceName, serviceConfig, errors);
          break;
        case 'lambda':
          this.validateLambdaConfig(serviceName, serviceConfig, errors);
          break;
        case 'sqs':
          this.validateSQSConfig(serviceName, serviceConfig, errors);
          break;
        case 'sns':
          this.validateSNSConfig(serviceName, serviceConfig, errors);
          break;
        default:
          // Generic validation for other services
          this.validateGenericServiceConfig(serviceName, serviceConfig, errors);
      }
    }
  }

  private static validateGlobalConfig(global: any, errors: ValidationError[]): void {
    if (global.port !== undefined) {
      if (typeof global.port !== 'number' || global.port < 1024 || global.port > 65535) {
        errors.push({
          message: 'Global port must be a number between 1024 and 65535',
          path: 'global.port',
          severity: 'error',
          suggestion: 'Change port to a value like 3000 or 8080'
        });
      }
    }

    if (global.logLevel !== undefined && !['error', 'warn', 'info', 'debug'].includes(global.logLevel)) {
      errors.push({
        message: 'Global logLevel must be one of: error, warn, info, debug',
        path: 'global.logLevel',
        severity: 'error',
        suggestion: 'Change logLevel to "info" or one of the valid options'
      });
    }

    if (global.delayResponses !== undefined && (typeof global.delayResponses !== 'number' || global.delayResponses < 0)) {
      errors.push({
        message: 'Global delayResponses must be a non-negative number',
        path: 'global.delayResponses',
        severity: 'error',
        suggestion: 'Change delayResponses to 0 or a positive number'
      });
    }
  }

  private static validateS3Config(serviceName: string, config: any, errors: ValidationError[]): void {
    if (config.buckets && typeof config.buckets === 'object') {
      for (const [bucketName, bucketConfig] of Object.entries(config.buckets)) {
        if (typeof bucketConfig !== 'object' || bucketConfig === null) {
          errors.push({
            message: `S3 bucket ${bucketName} must be an object`,
            path: `services.${serviceName}.buckets.${bucketName}`,
            severity: 'error',
            suggestion: `Change bucket "${bucketName}" to an object`
          });
          continue;
        }

        if ((bucketConfig as any).objects && typeof (bucketConfig as any).objects === 'object') {
          for (const [objectKey, objectConfig] of Object.entries((bucketConfig as any).objects)) {
            if (typeof objectConfig !== 'object' || objectConfig === null) {
              errors.push({
                message: `S3 object ${bucketName}/${objectKey} must be an object`,
                path: `services.${serviceName}.buckets.${bucketName}.objects.${objectKey}`,
                severity: 'error',
                suggestion: `Change object "${objectKey}" to an object with content`
              });
              continue;
            }

            const obj = objectConfig as any;
            if (!obj.content) {
              errors.push({
                message: `S3 object ${bucketName}/${objectKey} must have a content property`,
                path: `services.${serviceName}.buckets.${bucketName}.objects.${objectKey}.content`,
                severity: 'error',
                suggestion: `Add "content": "your content here" to the object`
              });
            }
          }
        }
      }
    }
  }

  private static validateDynamoDBConfig(serviceName: string, config: any, errors: ValidationError[]): void {
    if (config.tables && typeof config.tables === 'object') {
      for (const [tableName, tableConfig] of Object.entries(config.tables)) {
        if (typeof tableConfig !== 'object' || tableConfig === null) {
          errors.push({
            message: `DynamoDB table ${tableName} must be an object`,
            path: `services.${serviceName}.tables.${tableName}`,
            severity: 'error',
            suggestion: `Change table "${tableName}" to an object`
          });
          continue;
        }

        const table = tableConfig as any;
        if (table.items && !Array.isArray(table.items)) {
          errors.push({
            message: `DynamoDB table ${tableName}.items must be an array`,
            path: `services.${serviceName}.tables.${tableName}.items`,
            severity: 'error',
            suggestion: `Change items to an array of objects`
          });
        }
      }
    }
  }

  private static validateLambdaConfig(serviceName: string, config: any, errors: ValidationError[]): void {
    if (config.functions && typeof config.functions === 'object') {
      for (const [functionName, functionConfig] of Object.entries(config.functions)) {
        if (typeof functionConfig !== 'object' || functionConfig === null) {
          errors.push({
            message: `Lambda function ${functionName} must be an object`,
            path: `services.${serviceName}.functions.${functionName}`,
            severity: 'error',
            suggestion: `Change function "${functionName}" to an object`
          });
          continue;
        }

        const func = functionConfig as any;
        if (func.response && typeof func.response !== 'object') {
          errors.push({
            message: `Lambda function ${functionName}.response must be an object`,
            path: `services.${serviceName}.functions.${functionName}.response`,
            severity: 'error',
            suggestion: `Change response to an object with return value`
          });
        }
      }
    }
  }

  private static validateSQSConfig(serviceName: string, config: any, errors: ValidationError[]): void {
    if (config.queues && typeof config.queues === 'object') {
      for (const [queueName, queueConfig] of Object.entries(config.queues)) {
        if (typeof queueConfig !== 'object' || queueConfig === null) {
          errors.push({
            message: `SQS queue ${queueName} must be an object`,
            path: `services.${serviceName}.queues.${queueName}`,
            severity: 'error',
            suggestion: `Change queue "${queueName}" to an object`
          });
        }
      }
    }
  }

  private static validateSNSConfig(serviceName: string, config: any, errors: ValidationError[]): void {
    if (config.topics && typeof config.topics === 'object') {
      for (const [topicName, topicConfig] of Object.entries(config.topics)) {
        if (typeof topicConfig !== 'object' || topicConfig === null) {
          errors.push({
            message: `SNS topic ${topicName} must be an object`,
            path: `services.${serviceName}.topics.${topicName}`,
            severity: 'error',
            suggestion: `Change topic "${topicName}" to an object`
          });
        }
      }
    }
  }

  private static validateGenericServiceConfig(serviceName: string, config: any, errors: ValidationError[]): void {
    // Basic validation for services without specific validation rules
    if (config.port !== undefined && (typeof config.port !== 'number' || config.port < 1024 || config.port > 65535)) {
      errors.push({
        message: `Service ${serviceName} port must be a number between 1024 and 65535`,
        path: `services.${serviceName}.port`,
        severity: 'error',
        suggestion: `Change port to a value like 3000`
      });
    }
  }

  public static getSupportedServices(): string[] {
    return [...this.SUPPORTED_SERVICES];
  }

  public static createTemplate(): any {
    return {
      version: "1.0",
      services: {
        s3: {
          buckets: {
            "my-bucket": {
              objects: {
                "example.txt": {
                  content: "Hello World!",
                  contentType: "text/plain"
                }
              }
            }
          }
        },
        dynamodb: {
          tables: {
            "my-table": {
              items: [
                {
                  id: "123",
                  name: "Example Item"
                }
              ]
            }
          }
        }
      },
      global: {
        port: 3000,
        logLevel: "info"
      }
    };
  }
}

export interface ValidationError {
  message: string;
  path: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}