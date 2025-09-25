# Configuration Reference (`.aws-mock.json`)

This document explains the mock configuration format used by AWS Walled Garden. Place the file at the root of your workspace (default filename `.aws-mock.json`) or set a different path in the VS Code setting `awsWalledGarden.configFile`.

## Top-level schema

- `version` (string) — Configuration version, format `x.y` (e.g. `1.0`).
- `services` (object) — Service-specific mock definitions. Supported service keys: `s3`, `dynamodb`, `lambda`, `sqs`, `sns`.

Example top-level structure:

```json
{
  "version": "1.0",
  "services": { /* service configurations */ }
}
```

## S3

Structure:

- `buckets` — object mapping bucket names to bucket config
- bucket config: `objects` — mapping of object keys to object config
- object config: `content` (string) and optional `metadata` object (e.g. `ContentType`)

Example:

```json
"s3": {
  "buckets": {
    "my-bucket": {
      "objects": {
        "config.json": {
          "content": "{\"apiKey\": \"mock-key\"}",
          "metadata": { "ContentType": "application/json" }
        }
      }
    }
  }
}
```

Behavior:

- A GET request to an S3 object (via the proxy) returns the `content` as the response body and sets Content-Type from `metadata.ContentType` when present.
- A PUT request currently returns a generic 200 acknowledgement. The proxy does not persist uploads in memory by default.

## DynamoDB

Structure:

- `tables` — mapping of table names to table config
- table config: `items` — array of items (plain JSON objects) representing stored rows

Example:

```json
"dynamodb": {
  "tables": {
    "Users": {
      "items": [ { "id": "user1", "name": "John Doe" } ]
    }
  }
}
```

Behavior:

- A GetItem-like operation will return a matching item from the `items` array (basic matching currently implemented for id lookups in example code).
- PutItem operations return a successful acknowledgement.

## Lambda

Structure:

- `functions` — mapping of function names to function configuration
- function config: `response` — object used as the function's return payload

Example:

```json
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
```

Behavior:

- Invoking the named function returns `response` as the mock payload. The proxy may base the returned structure on the real API shape (Lambda uses `Payload`), but the value in `response` is returned as-is by the current implementation.

## Unsupported or missing mocks

- If an incoming request does not match a configured mock, the proxy forwards the request to the real AWS endpoint (fallback behavior).
- When a supported service is not configured in `services`, requests to that service will be forwarded to AWS.

## Validation rules

The project's `ConfigValidator` enforces basic checks:

- `version` must be present and match `^\d+\.\d+$`.
- `services` must be an object.
- Only supported service keys are allowed (s3, dynamodb, lambda, sqs, sns).
- For S3 objects, `content` must be present.

## Example full file

```json
{
  "version": "1.0",
  "services": {
    "s3": {
      "buckets": {
        "example-bucket": {
          "objects": {
            "test-file.txt": {
              "content": "Hello, World!",
              "metadata": { "ContentType": "text/plain" }
            }
          }
        }
      }
    },
    "dynamodb": {
      "tables": {
        "Users": { "items": [ { "id": "user1", "name": "John Doe" } ] }
      }
    },
    "lambda": {
      "functions": {
        "myFunction": { "response": { "statusCode": 200, "body": "{\"message\":\"ok\"}" } }
      }
    }
  }
}
```

## Tips

- Keep mock responses minimal and focused on what your application expects — this speeds up tests and reduces maintenance.
- For advanced behavior (error simulation, templating), enhance `proxyServer.ts` with richer request parsing and template rendering before returning mocks.
