# AWS Walled Garden

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=DrFaustest.aws-walled-garden)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that creates a local development environment for AWS applications by mocking AWS services and intercepting API calls. This allows developers to work on AWS projects locally without needing actual AWS credentials, connections, or incurring cloud costs.

## Features

### 🚀 Local AWS Development
- **Zero AWS Costs**: Develop and test AWS applications locally without cloud resources
- **No Credentials Required**: Work offline without AWS account setup
- **Fast Iteration**: Instant feedback with local mock responses

### 🎯 Smart Auto-Configuration
- **Automatic Detection**: Scans your codebase for AWS SDK usage
- **Intelligent Mock Generation**: Creates appropriate mocks based on your code
- **One-Click Setup**: Generate complete mock configurations instantly

### 💡 Rich IntelliSense
- **Schema Validation**: Real-time JSON validation with helpful error messages
- **Context-Aware Suggestions**: Smart completions for AWS services and configurations
- **Template Insertion**: Quick insertion of complete service configuration examples

### 🎨 GUI Configuration Editor
- **Visual Interface**: User-friendly forms for configuring AWS services
- **Real-time Validation**: Immediate feedback on configuration errors
- **Service Management**: Add, remove, and configure services through dropdown menus

### 🔧 Supported AWS Services
- **S3** - Bucket and object operations
- **DynamoDB** - Table operations and queries
- **Lambda** - Function invocation mocking
- **SQS** - Queue operations
- **SNS** - Topic publishing
- **And more...**

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "AWS Walled Garden"
4. Click Install

### Manual Installation
1. Download the `.vsix` file from [Releases](https://github.com/DrFaustest/AWS-Walled-Guarden/releases)
2. In VS Code: Extensions → Install from VSIX...
3. Select the downloaded `.vsix` file

## Quick Start

### 1. Auto-Configure Your Project
1. Open your AWS project in VS Code
2. Press `Ctrl+Shift+P` and run "AWS Walled Garden: Auto Configure Mocks"
3. The extension will scan your code and generate appropriate mocks

### 2. Manual Configuration
1. Create a `.aws-mock.json` file in your workspace root
2. Use IntelliSense for guided configuration
3. Or open the GUI Editor: "AWS Walled Garden: Open GUI Configuration Editor"

### 3. Start Developing
- Enable the extension: "AWS Walled Garden: Enable"
- Your AWS calls will now use local mocks
- View logs: "AWS Walled Garden: Show Logs"

## Configuration

### Basic Configuration
```json
{
  "version": "1.0",
  "services": {
    "s3": {
      "buckets": {
        "my-bucket": {
          "objects": {
            "test-file.txt": {
              "content": "Hello, World!",
              "metadata": {
                "ContentType": "text/plain"
              }
            }
          }
        }
      }
    }
  }
}
```

### Global Settings
```json
{
  "version": "1.0",
  "global": {
    "port": 3128,
    "logLevel": "info"
  },
  "services": { ... }
}
```

## Usage Examples

### S3 Operations
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// This will use your local mock instead of real AWS
await s3.putObject({
  Bucket: 'my-bucket',
  Key: 'test.txt',
  Body: 'Hello World'
}).promise();
```

### DynamoDB Operations
```javascript
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();

// Local mock database operations
await dynamodb.putItem({
  TableName: 'Users',
  Item: {
    id: { S: 'user1' },
    name: { S: 'John Doe' }
  }
}).promise();
```

## Commands

| Command | Description |
|---------|-------------|
| `AWS Walled Garden: Enable` | Start the mock proxy server |
| `AWS Walled Garden: Disable` | Stop the mock proxy server |
| `AWS Walled Garden: Toggle` | Toggle extension on/off |
| `AWS Walled Garden: Reload Configuration` | Reload mock configuration |
| `AWS Walled Garden: Auto Configure Mocks` | Auto-generate mocks from your code |
| `AWS Walled Garden: Open Configuration File` | Open `.aws-mock.json` |
| `AWS Walled Garden: Open GUI Configuration Editor` | Open visual configuration editor |
| `AWS Walled Garden: Show Logs` | View extension logs |

## Requirements

- **VS Code**: ^1.74.0
- **Node.js**: For running the mock proxy server
- **AWS SDK**: Your project should use AWS SDK v2 or v3

## Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `awsWalledGarden.configFile` | Path to mock configuration file | `.aws-mock.json` |
| `awsWalledGarden.enabled` | Auto-enable extension on startup | `true` |

## Troubleshooting

### Common Issues

**Port 3128 already in use**
- The extension uses port 3128 for the proxy server
- Stop other applications using this port or configure a different port in settings

**Configuration validation errors**
- Ensure your `.aws-mock.json` follows the correct schema
- Use IntelliSense for guided configuration
- Check the [Configuration Guide](docs/CONFIG.md) for examples

**AWS calls not being mocked**
- Ensure the extension is enabled
- Check that your AWS SDK is configured to use the proxy
- Verify your mock configuration matches your code

### Getting Help

- 📖 [Documentation](https://github.com/DrFaustest/AWS-Walled-Guarden)
- 🐛 [Report Issues](https://github.com/DrFaustest/AWS-Walled-Guarden/issues)
- 💬 [Discussions](https://github.com/DrFaustest/AWS-Walled-Guarden/discussions)

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for AWS developers who want to develop locally, test quickly, and ship faster.**
- **Service Templates**: Pre-configured templates for common AWS service setups

### Using the GUI Editor

1. **Open the Editor**: 
   - Open a `.aws-mock.json` file in VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the command palette
   - Type "AWS Walled Garden: Open GUI Editor" and select it

2. **Configure Global Settings**:
   - Set the proxy port (default: 3000)
   - Configure the host address (default: localhost)
   - Set logging level (error, warn, info, debug)
   - Enable/disable request recording

3. **Add AWS Services**:
   - Click "Add Service" to open the service selection menu
   - Choose from supported AWS services (S3, DynamoDB, Lambda, SQS, SNS, etc.)
   - Configure service-specific settings using the generated form fields

4. **Save Configuration**:
   - Click "Save Configuration" to persist your changes
   - The editor validates your configuration before saving
   - Error messages appear if validation fails

### Supported Services

The GUI editor supports all AWS services available in the JSON schema:

- **S3**: Bucket and object configurations
- **DynamoDB**: Table structures and data
- **Lambda**: Function responses and configurations
- **SQS**: Queue configurations and messages
- **SNS**: Topic configurations and subscriptions
- **IAM**: User and role configurations
- **CloudFormation**: Stack templates and resources

### Benefits Over JSON Editing

- **No JSON Syntax Errors**: Form validation prevents common JSON mistakes
- **Discoverability**: See all available options without consulting documentation
- **Faster Configuration**: Visual forms are often quicker than writing JSON
- **Validation Feedback**: Immediate error highlighting and suggestions
- **Beginner Friendly**: No need to learn the JSON schema structure

## Troubleshootingng applications that interact with AWS services, developers typically need:
- AWS credentials and access keys
- Network connectivity to AWS endpoints
- Understanding of AWS service configurations
- Management of costs for development/testing

AWS Walled Garden eliminates these requirements by providing a "walled garden" environment where your application believes it's interacting with real AWS services, but all calls are intercepted and return predetermined mock responses.

## How It Works

### Architecture

1. **Configuration File**: Users create a JSON/YAML configuration file defining mock responses for AWS services
2. **Extension Activation**: The VS Code extension runs in the background and monitors your application
3. **API Interception**: When your code makes AWS API calls, the extension intercepts them
4. **Mock Response**: Instead of contacting AWS, predetermined responses are returned
5. **Local Development**: Your application runs normally with mock data

### Supported Languages/Frameworks

- Node.js (AWS SDK for JavaScript)
- Python (Boto3)
- Java (AWS SDK for Java)
- .NET (AWS SDK for .NET)

### Supported AWS Services

Initially focusing on core services:
- **S3** (Simple Storage Service) - Object storage
- **DynamoDB** - NoSQL database
- **Lambda** - Serverless functions
- **SQS** (Simple Queue Service) - Message queuing
- **SNS** (Simple Notification Service) - Pub/Sub messaging
- **IAM** (Identity and Access Management) - Permissions
- **CloudFormation** - Infrastructure as code

## Installation

### Option 1: Install from VSIX (Recommended for Testing)

1. Download the `aws-walled-garden-0.0.1.vsix` file from the releases
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the command palette
4. Type "Extensions: Install from VSIX" and select it
5. Choose the downloaded `.vsix` file

### Option 2: Install from Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to launch the Extension Development Host
5. In the new window, test the extension

## Usage

### Basic Setup

1. **Install the extension** using one of the methods above
2. **Create a mock configuration file** in your project root (`.aws-mock.json`):

```json
{
  "version": "1.0",
  "services": {
    "s3": {
      "buckets": {
        "my-test-bucket": {
          "objects": {
            "config.json": {
              "content": "{\"apiKey\": \"test-key-123\"}",
              "metadata": {
                "ContentType": "application/json"
              }
            }
          }
        }
      }
    }
  }
}
```

3. **Enable the extension**: `Ctrl+Shift+P` → "AWS Walled Garden: Enable"
4. **Configure your AWS SDK** to use the proxy (see below)

### AWS SDK Configuration

For the extension to intercept AWS calls, you need to configure your AWS SDK to use the proxy. Add this code to your application:

```javascript
const AWS = require('aws-sdk');
const HttpsProxyAgent = require('https-proxy-agent');


## Related documentation

Further developer-focused documentation is available in the repository:

- `src/README.md` — Overview of the TypeScript source, build/debug instructions and key files.
- `src/test/README.md` — How to compile and run the tests and where test code lives.
- `docs/CONFIG.md` — Detailed schema and examples for the `.aws-mock.json` mock configuration.

Refer to those files when developing, testing, or editing mock configurations.

## Try the example (quick)

Follow these quick steps to run the example in the `example/` folder. The example uses the included `example/.aws-mock.json` so you don't need to create a config in your workspace root.

1. Install dependencies at the project root:

```powershell
npm install
```

2. Enable the extension in the Extension Development Host (or ensure the extension is installed).

 - If developing locally: press `F5` in VS Code to open the Extension Development Host and run the `AWS Walled Garden: Enable` command from the Command Palette.

3. Run the example script from the `example/` folder:

```powershell
node example/index.js
```

You should see output demonstrating mocked S3, DynamoDB, and Lambda responses. If the extension isn't enabled or the proxy port (default 3128) is in use, the example may fall back to real AWS calls.
// Configure AWS SDK to use the extension's proxy
AWS.config.update({
  httpOptions: {
    agent: new HttpsProxyAgent('http://localhost:3128')
  }
});
```

Or for AWS SDK v3:

```javascript
const { S3Client } = require('@aws-sdk/client-s3');
const { HttpsProxyAgent } = require('https-proxy-agent');

const client = new S3Client({
  requestHandler: {
    httpsAgent: new HttpsProxyAgent('http://localhost:3128')
  }
});
```

### Example Application

```javascript
const AWS = require('aws-sdk');
const HttpsProxyAgent = require('https-proxy-agent');

// Configure proxy for AWS SDK
AWS.config.update({
  region: 'us-east-1',
  httpOptions: {
    agent: new HttpsProxyAgent('http://localhost:3128')
  }
});

const s3 = new AWS.S3();

// This will now return mock data instead of requiring real AWS credentials
s3.getObject({ Bucket: 'my-bucket', Key: 'config.json' }, (err, data) => {
  if (err) console.error(err);
  else console.log('Mock data:', data.Body.toString());
});
```

## Commands

- **AWS Walled Garden: Enable** - Start intercepting AWS API calls
- **AWS Walled Garden: Disable** - Stop intercepting and restore normal AWS calls
- **AWS Walled Garden: Reload Configuration** - Reload the mock config file
- **AWS Walled Garden: Show Logs** - Open the extension's log output
- **AWS Walled Garden: Auto Configure Mocks** - Automatically scan your codebase and generate mock configurations based on AWS SDK calls

## Auto Configuration

The auto-configuration feature analyzes your codebase to detect AWS SDK usage and automatically generates appropriate mock configurations. This eliminates the need to manually create mock setups for common AWS operations.

### How Auto Configuration Works

1. **Code Analysis**: Scans your project files for AWS SDK calls
2. **Service Detection**: Identifies which AWS services you're using (S3, DynamoDB, Lambda, etc.)
3. **Parameter Extraction**: Extracts bucket names, table names, function names, and other parameters
4. **Mock Generation**: Creates realistic mock responses based on detected operations
5. **Configuration Merge**: Updates your existing `.aws-mock.json` file or creates a new one

### Supported Detection Patterns

The auto-configurator can detect:
- AWS SDK v2 service instantiation (`new AWS.S3()`, `new AWS.DynamoDB.DocumentClient()`, etc.)
- Method calls with parameters (`s3.getObject({ Bucket: '...', Key: '...' })`)
- Common AWS resource identifiers (bucket names, table names, function names, etc.)

### Example Usage

1. Write your AWS code as normal:

```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Your AWS operations
await s3.getObject({ Bucket: 'my-app-bucket', Key: 'config.json' });
await dynamodb.get({ TableName: 'Users', Key: { id: 'user123' } });
```

2. Run the auto-configuration command: `Ctrl+Shift+P` → "AWS Walled Garden: Auto Configure Mocks"

3. The extension will generate a configuration like:

```json
{
  "version": "1.0",
  "services": {
    "s3": {
      "buckets": {
        "my-app-bucket": {
          "objects": {
            "config.json": {
              "content": "{\"message\": \"Auto-generated mock content for config.json\"}",
              "metadata": { "ContentType": "application/json" }
            }
          }
        }
      }
    },
    "dynamodb": {
      "tables": {
        "Users": {
          "items": [
            {
              "id": "user123",
              "name": "Auto-generated User",
              "email": "user@example.com"
            }
          ]
        }
      }
    }
  }
}
```

### Limitations

- Currently supports JavaScript/TypeScript files
- Detects basic parameter patterns but may not handle complex dynamic configurations
- Generated mocks are basic templates - you may need to customize responses for your specific use cases
- Existing configurations are preserved and merged with auto-generated content

## Configuration

### Extension Settings

You can configure the extension through VS Code settings:

- `awsWalledGarden.configFile`: Path to your mock configuration file (default: `.aws-mock.json`)
- `awsWalledGarden.enabled`: Auto-enable the extension on startup (default: `true`)

### Mock Configuration File

The mock configuration file (`.aws-mock.json`) defines what responses to return for different AWS services.

#### Schema

```json
{
  "version": "1.0",
  "services": {
    "s3": {
      "buckets": {
        "bucket-name": {
          "objects": {
            "object-key": {
              "content": "file content here",
              "metadata": {
                "ContentType": "text/plain"
              }
            }
          }
        }
      }
    },
    "dynamodb": {
      "tables": {
        "table-name": {
          "items": [
            { "id": "item1", "data": "value1" }
          ]
        }
      }
    },
    "lambda": {
      "functions": {
        "function-name": {
          "response": {
            "statusCode": 200,
            "body": "{\"result\": \"success\"}"
          }
        }
      }
    }
  }
}
```

## How It Works

1. **Proxy Server**: The extension starts a local HTTP proxy server on port 3128
2. **Environment Variables**: Sets `HTTP_PROXY` and `HTTPS_PROXY` to route AWS SDK calls through the proxy
3. **Request Interception**: Intercepts requests to AWS service endpoints
4. **Mock Response Generation**: Returns predefined responses based on your configuration
5. **Fallback**: If no mock is configured, requests are forwarded to real AWS services

## Troubleshooting

### Extension Not Working

1. Check that the extension is enabled: `Ctrl+Shift+P` → "AWS Walled Garden: Enable"
2. Verify your configuration file exists and is valid JSON
3. Check the logs: `Ctrl+Shift+P` → "AWS Walled Garden: Show Logs"
4. Ensure your application is using AWS SDK libraries that respect proxy environment variables

### Configuration Errors

- Use the "Reload Configuration" command after editing your config file
- Check the VS Code output panel for validation errors
- Ensure your JSON is valid and follows the expected schema

### Port Conflicts

If port 3128 is already in use, the extension will fail to start. Check for other proxy servers or change the port in the source code.

## Development

### Building from Source

```bash
git clone <repository-url>
cd aws-walled-garden
npm install
npm run compile
npm run package  # Creates .vsix file
```

### Running Tests

```bash
npm test
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to start debugging
3. Test the extension in the new Extension Development Host window

## Configuration

Create a `.aws-mock.json` file in your project root:

```json
{
  "version": "1.0",
  "services": {
    "s3": {
      "buckets": {
        "my-bucket": {
          "objects": {
            "test-file.txt": {
              "content": "Hello, World!",
              "metadata": {
                "ContentType": "text/plain"
              }
            }
          }
        }
      }
    },
    "dynamodb": {
      "tables": {
        "Users": {
          "items": [
            {
              "id": "user1",
              "name": "John Doe",
              "email": "john@example.com"
            }
          ]
        }
      }
    },
    "lambda": {
      "functions": {
        "myFunction": {
          "response": {
            "statusCode": 200,
            "body": "{\"message\": \"Hello from mock Lambda!\"}"
          }
        }
      }
    }
  }
}
```

### Configuration Schema

- `version`: Configuration format version
- `services`: Object containing service-specific configurations
- Each service has its own schema based on AWS API responses

## Usage Examples

### Node.js Example

```javascript
const AWS = require('aws-sdk');

// Configure AWS SDK (normally you'd need credentials)
AWS.config.update({
  region: 'us-east-1'
});

const s3 = new AWS.S3();

// This call will be intercepted and return mock data
s3.getObject({ Bucket: 'my-bucket', Key: 'test-file.txt' }, (err, data) => {
  if (err) console.error(err);
  else console.log(data.Body.toString()); // "Hello, World!"
});
```

### Python Example

```python
import boto3

# Create S3 client (normally needs credentials)
s3 = boto3.client('s3', region_name='us-east-1')

# This will return mock data
response = s3.get_object(Bucket='my-bucket', Key='test-file.txt')
print(response['Body'].read().decode())  # "Hello, World!"
```

## AWS Concepts Overview

If you're new to AWS, here are the key concepts this extension helps mock:

### Core AWS Services

- **S3**: File storage in "buckets" (like folders)
- **DynamoDB**: Fast NoSQL database for key-value data
- **Lambda**: Run code without managing servers
- **SQS**: Send messages between application parts
- **SNS**: Send notifications via email, SMS, etc.
- **IAM**: Control who can access what resources

### AWS API Calls

AWS services communicate via HTTP API calls. The SDKs (Software Development Kits) make these calls easy:

- **Operations**: Actions like `GetObject`, `PutItem`, `Invoke`
- **Parameters**: Data sent with the operation
- **Responses**: Data returned from AWS
- **Errors**: What happens when something goes wrong

### Regions and Endpoints

- AWS services run in different geographical regions
- Each region has its own endpoints (URLs)
- The extension mocks these regional endpoints

## Development Roadmap

### Phase 1: Core Services
- Basic mocking for S3, DynamoDB, Lambda
- JSON configuration format
- Node.js and Python support

### Phase 2: Advanced Features
- YAML configuration support
- Java and .NET support
- Error simulation
- Response templating

### Phase 3: Enterprise Features
- Team configuration sharing
- Integration with AWS CloudFormation
- Performance testing modes
- CI/CD integration

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### Development Setup

1. Fork and clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to launch the Extension Development Host for testing
5. Run `npm run package` to create a `.vsix` file for installation

### Repository

Source code available at: https://github.com/username/aws-walled-garden

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for local development only. It does not provide actual AWS functionality and should never be used in production environments.