import * as assert from 'assert';
import { ConfigValidator } from '../../configValidator';

suite('ConfigValidator Test Suite', () => {
  test('should validate valid configuration', () => {
    const validConfig = {
      version: '1.0',
      services: {
        s3: {
          buckets: {
            'test-bucket': {
              objects: {
                'test-file.txt': {
                  content: 'Hello World',
                  metadata: {}
                }
              }
            }
          }
        }
      }
    };

    const result = ConfigValidator.validate(validConfig);
    assert.strictEqual(result.valid, true, 'Valid configuration should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid configuration should have no errors');
  });

  test('should reject configuration without version', () => {
    const invalidConfig = {
      services: {}
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false, 'Configuration without version should fail');
    assert(result.errors.some(error => error.message.includes('version')), 'Should mention version in errors');
  });

  test('should reject configuration without services', () => {
    const invalidConfig = {
      version: '1.0'
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false, 'Configuration without services should fail');
    assert(result.errors.some(error => error.message.includes('services')), 'Should mention services in errors');
  });

  test('should reject invalid version format', () => {
    const invalidConfig = {
      version: '1.0.0',
      services: {}
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false, 'Configuration with invalid version format should fail');
    assert(result.errors.some(error => error.message.includes('Version must be in format')), 'Should mention version format in errors');
  });

  test('should reject non-object configuration', () => {
    const invalidConfig = 'not an object';

    const result = ConfigValidator.validate(invalidConfig as any);
    assert.strictEqual(result.valid, false, 'Non-object configuration should fail');
    assert(result.errors.some(error => error.message.includes('Configuration must be a valid JSON object')), 'Should mention object requirement in errors');
  });

  test('should validate configuration with multiple services', () => {
    const validConfig = {
      version: '1.0',
      services: {
        s3: {
          buckets: {}
        },
        dynamodb: {
          tables: {}
        }
      }
    };

    const result = ConfigValidator.validate(validConfig);
    assert.strictEqual(result.valid, true, 'Configuration with multiple services should pass');
  });

  test('should handle empty services object', () => {
    const validConfig = {
      version: '1.0',
      services: {}
    };

    const result = ConfigValidator.validate(validConfig);
    assert.strictEqual(result.valid, true, 'Configuration with empty services should pass');
  });

  test('should reject unsupported service', () => {
    const invalidConfig = {
      version: '1.0',
      services: {
        unsupportedService: {}
      }
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false, 'Configuration with unsupported service should fail');
    assert(result.errors.some(error => error.message.includes('Unsupported service')), 'Should mention unsupported service');
  });

  test('should validate global configuration', () => {
    const validConfig = {
      version: '1.0',
      services: {},
      global: {
        port: 3000,
        logLevel: 'info',
        recordRequests: false,
        delayResponses: 0
      }
    };

    const result = ConfigValidator.validate(validConfig);
    assert.strictEqual(result.valid, true, 'Configuration with valid global settings should pass');
  });

  test('should reject invalid global port', () => {
    const invalidConfig = {
      version: '1.0',
      services: {},
      global: {
        port: 80 // Below minimum
      }
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false, 'Configuration with invalid global port should fail');
    assert(result.errors.some(error => error.message.includes('port must be a number between')), 'Should mention port validation');
  });

  test('should reject invalid global logLevel', () => {
    const invalidConfig = {
      version: '1.0',
      services: {},
      global: {
        logLevel: 'invalid'
      }
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false, 'Configuration with invalid logLevel should fail');
    assert(result.errors.some(error => error.message.includes('logLevel must be one of')), 'Should mention logLevel validation');
  });

  test('should provide suggestions for common errors', () => {
    const invalidConfig = {
      services: {}
    };

    const result = ConfigValidator.validate(invalidConfig);
    assert.strictEqual(result.valid, false);
    const versionError = result.errors.find(error => error.path === 'version');
    assert(versionError, 'Should have version error');
    assert(versionError!.suggestion, 'Should provide suggestion for version error');
    assert(versionError!.suggestion!.includes('version'), 'Suggestion should mention version');
  });

  test('should return supported services list', () => {
    const services = ConfigValidator.getSupportedServices();
    assert(Array.isArray(services), 'Should return array of services');
    assert(services.includes('s3'), 'Should include s3');
    assert(services.includes('dynamodb'), 'Should include dynamodb');
    assert(services.includes('lambda'), 'Should include lambda');
  });

  test('should create valid template configuration', () => {
    const template = ConfigValidator.createTemplate();
    const result = ConfigValidator.validate(template);
    assert.strictEqual(result.valid, true, 'Template should be valid');
    assert(template.version, 'Template should have version');
    assert(template.services, 'Template should have services');
  });
});