# AWS Walled Garden Example

This example demonstrates how to use the AWS Walled Garden VS Code extension to mock AWS services in your development environment.

## Setup

1. Install the AWS Walled Garden extension
2. Copy the `.aws-mock.json` file to your project root
3. Enable the extension: `Ctrl+Shift+P` → "AWS Walled Garden: Enable"

## Running the Example

```bash
npm install
npm start
```

The example will test S3, DynamoDB, and Lambda operations using mock data instead of real AWS services.

## Expected Output

```
🚀 AWS Walled Garden Example
Make sure the extension is enabled before running this!
Testing S3 with AWS Walled Garden...
S3 Response: {
  apiKey: 'mock-api-key-12345',
  environment: 'development',
  databaseUrl: 'mock://localhost:5432'
}

Testing DynamoDB with AWS Walled Garden...
DynamoDB Response: {
  id: 'user1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: 'developer',
  createdAt: '2024-01-01T00:00:00Z'
}

Testing Lambda with AWS Walled Garden...
Lambda Response: {
  message: 'Hello from AWS Walled Garden!',
  timestamp: '2024-01-15T10:30:00Z',
  requestId: 'mock-request-123'
}

✅ Example completed! Check the VS Code output for extension logs.
```

## Configuration

The `.aws-mock.json` file contains mock responses for:

- **S3**: Bucket objects with custom content and metadata
- **DynamoDB**: Table items with various data types
- **Lambda**: Function responses with custom payloads

Modify the configuration to match your application's needs!