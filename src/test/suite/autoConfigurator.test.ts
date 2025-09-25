import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { AutoConfigurator } from '../../autoConfigurator';

suite('AutoConfigurator Test Suite', () => {
  let tempDir: string;
  let autoConfigurator: AutoConfigurator;

  suiteSetup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-walled-garden-test-'));
    autoConfigurator = new AutoConfigurator();
  });

  suiteTeardown(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should detect AWS SDK v2 imports', async () => {
    // Create a test file with AWS SDK v2 imports
    const testFile = path.join(tempDir, 'test.js');
    const content = `
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB();
`;

    fs.writeFileSync(testFile, content);

    // Mock workspace APIs
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{
        uri: vscode.Uri.file(tempDir),
        name: 'test-workspace',
        index: 0
      }],
      configurable: true
    });

    const originalFindFiles = vscode.workspace.findFiles;
    vscode.workspace.findFiles = async (pattern: vscode.GlobPattern) => {
      return [vscode.Uri.file(testFile)];
    };

    try {
      const calls = await (autoConfigurator as any).scanWorkspaceForAwsCalls();
      assert(calls.length > 0, 'Should detect AWS calls');
      assert(calls.some((call: any) => call.service === 's3'), 'Should detect S3 service');
      assert(calls.some((call: any) => call.service === 'dynamodb'), 'Should detect DynamoDB service');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
      vscode.workspace.findFiles = originalFindFiles;
    }
  });

  test('should detect AWS SDK v3 imports', async () => {
    // Create a test file with AWS SDK v3 imports
    const testFile = path.join(tempDir, 'test.js');
    const content = `
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const s3Client = new S3Client();
const dynamoClient = new DynamoDBClient();
`;

    fs.writeFileSync(testFile, content);

    // Mock workspace APIs
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{
        uri: vscode.Uri.file(tempDir),
        name: 'test-workspace',
        index: 0
      }],
      configurable: true
    });

    const originalFindFiles = vscode.workspace.findFiles;
    vscode.workspace.findFiles = async (pattern: vscode.GlobPattern) => {
      return [vscode.Uri.file(testFile)];
    };

    try {
      const calls = await (autoConfigurator as any).scanWorkspaceForAwsCalls();
      assert(calls.length > 0, 'Should detect AWS calls');
      assert(calls.some((call: any) => call.service === 's3'), 'Should detect S3 service');
      assert(calls.some((call: any) => call.service === 'dynamodb'), 'Should detect DynamoDB service');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
      vscode.workspace.findFiles = originalFindFiles;
    }
  });

  test('should detect SDK version correctly', async () => {
    // Test v2 detection
    const v2File = path.join(tempDir, 'v2-test.js');
    const v2Content = `const AWS = require('aws-sdk');`;
    fs.writeFileSync(v2File, v2Content);

    // Mock findRelevantFiles to return only the v2 file
    const originalFindRelevantFiles = (autoConfigurator as any).findRelevantFiles;
    (autoConfigurator as any).findRelevantFiles = async () => [v2File];

    try {
      const v2Result = await (autoConfigurator as any).detectSdkUsage();
      assert.strictEqual(v2Result.version, 'v2', 'Should detect SDK v2');
    } finally {
      (autoConfigurator as any).findRelevantFiles = originalFindRelevantFiles;
      fs.unlinkSync(v2File);
    }

    // Test v3 detection
    const v3File = path.join(tempDir, 'v3-test.js');
    const v3Content = `import { S3Client } from '@aws-sdk/client-s3';`;
    fs.writeFileSync(v3File, v3Content);

    // Mock findRelevantFiles to return only the v3 file
    (autoConfigurator as any).findRelevantFiles = async () => [v3File];

    try {
      const v3Result = await (autoConfigurator as any).detectSdkUsage();
      assert.strictEqual(v3Result.version, 'v3', 'Should detect SDK v3');
    } finally {
      (autoConfigurator as any).findRelevantFiles = originalFindRelevantFiles;
      fs.unlinkSync(v3File);
    }

    // Test no SDK detection
    const noSdkFile = path.join(tempDir, 'no-sdk-test.js');
    const noSdkContent = `console.log('no aws sdk');`;
    fs.writeFileSync(noSdkFile, noSdkContent);

    // Mock findRelevantFiles to return only the no-sdk file
    (autoConfigurator as any).findRelevantFiles = async () => [noSdkFile];

    try {
      const noSdkResult = await (autoConfigurator as any).detectSdkUsage();
      assert.strictEqual(noSdkResult.version, 'unknown', 'Should not detect SDK when not present');
    } finally {
      (autoConfigurator as any).findRelevantFiles = originalFindRelevantFiles;
      fs.unlinkSync(noSdkFile);
    }
  });

  test('should generate mock configuration from AWS calls', () => {
    const awsCalls = [
      { service: 's3', operation: 'putObject', parameters: { Bucket: 'test-bucket', Key: 'test-key' }, file: 'test.js', line: 1 },
      { service: 'dynamodb', operation: 'putItem', parameters: { TableName: 'test-table' }, file: 'test.js', line: 2 }
    ];

    const config = (autoConfigurator as any).generateMockConfig(awsCalls);

    assert(config.version, 'Should have version');
    assert(config.services, 'Should have services');
    assert(config.services.s3, 'Should have S3 service');
    assert(config.services.dynamodb, 'Should have DynamoDB service');
  });

  test('should handle empty AWS calls', () => {
    const awsCalls: any[] = [];
    const config = (autoConfigurator as any).generateMockConfig(awsCalls);

    assert(config.version, 'Should have version');
    assert(config.services, 'Should have services');
    assert(Object.keys(config.services).length === 0, 'Should have no services');
  });

  test('should handle no workspace folders', async () => {
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: undefined,
      configurable: true
    });

    try {
      const calls = await (autoConfigurator as any).scanWorkspaceForAwsCalls();
      assert.strictEqual(calls.length, 0, 'Should return empty array when no workspace');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
    }
  });

  test('should handle TypeScript files', async () => {
    // Create a test TypeScript file
    const testFile = path.join(tempDir, 'test.ts');
    const content = `
import { S3Client } from '@aws-sdk/client-s3';
const client = new S3Client();
`;

    fs.writeFileSync(testFile, content);

    // Mock workspace APIs
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{
        uri: vscode.Uri.file(tempDir),
        name: 'test-workspace',
        index: 0
      }],
      configurable: true
    });

    const originalFindFiles = vscode.workspace.findFiles;
    vscode.workspace.findFiles = async (pattern: vscode.GlobPattern) => {
      return [vscode.Uri.file(testFile)];
    };

    try {
      const calls = await (autoConfigurator as any).scanWorkspaceForAwsCalls();
      assert(calls.length > 0, 'Should detect AWS calls in TypeScript files');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
      vscode.workspace.findFiles = originalFindFiles;
    }
  });
});