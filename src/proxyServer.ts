import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as vscode from 'vscode';
import { MockConfig } from './mockManager';
import { Logger } from './logger';

interface MockResponse {
  statusCode: number;
  headers?: { [key: string]: string };
  body: any;
}

export class ProxyServer {
  private server: http.Server | null = null;
  private port: number = 3128; // Default proxy port
  private config: MockConfig | null = null;
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
    this.setupRequestHandlers();
  }

  public start(config: MockConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.config = config;

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Handle CONNECT requests for HTTPS tunneling
      this.server.on('connect', (req, clientSocket, head) => {
        this.handleConnect(req, clientSocket, head);
      });

      this.server.listen(this.port, () => {
        this.logger.info(`AWS Mock Proxy Server running on port ${this.port}`);
        // Set environment variables to route traffic through our proxy
        process.env.HTTP_PROXY = `http://localhost:${this.port}`;
        process.env.HTTPS_PROXY = `http://localhost:${this.port}`;
        resolve();
      });

      this.server.on('error', (err) => {
        this.logger.error('Failed to start proxy server', err);
        reject(err);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('AWS Mock Proxy Server stopped');
          // Clean up environment variables
          delete process.env.HTTP_PROXY;
          delete process.env.HTTPS_PROXY;
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public updateConfig(config: MockConfig): void {
    this.config = config;
  }

  private setupRequestHandlers(): void {
    // This method sets up any additional request handling logic
  }

  private async handleConnect(req: http.IncomingMessage, clientSocket: import('stream').Duplex, head: Buffer): Promise<void> {
    try {
      const hostname = req.url || '';
      this.logger.debug(`Handling CONNECT request: ${hostname}`);

      // Check if this is an AWS service request
      if (this.isAwsRequest(hostname)) {
        this.logger.debug(`Intercepted AWS CONNECT to ${hostname}`);
        // For AWS requests, we'll handle the tunnel ourselves
        // Instead of establishing a real tunnel, we'll intercept the HTTPS traffic
        this.handleHttpsTunnel(req, clientSocket, head);
      } else {
        // For non-AWS requests, establish a normal tunnel
        this.establishTunnel(req, clientSocket, head);
      }
    } catch (error) {
      this.logger.error('Error handling CONNECT request', error);
      clientSocket.end();
    }
  }

  private async handleHttpsTunnel(req: http.IncomingMessage, clientSocket: import('stream').Duplex, head: Buffer): Promise<void> {
    // For AWS requests, we'll intercept the HTTPS traffic by handling the tunnel
    const hostname = req.url || '';

    this.logger.debug(`Intercepting HTTPS tunnel for ${hostname}`);

    // Establish the tunnel response
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    let buffer = head;
    let expectingRequest = true;

    clientSocket.on('data', (chunk) => {
      if (expectingRequest) {
        buffer = Buffer.concat([buffer, chunk]);

        // Look for the end of HTTP headers (double CRLF)
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          expectingRequest = false;

          // Parse the HTTP request
          const requestStr = buffer.slice(0, headerEnd).toString();
          const lines = requestStr.split('\r\n');
          const requestLine = lines[0];

          this.logger.debug(`Intercepted HTTP request: ${requestLine}`);

          // Generate mock response based on the service
          const mockResponse = this.generateMockHttpResponse(hostname, requestLine);

          // Send the response back through the tunnel
          clientSocket.write(mockResponse);

          // Close the connection after sending response
          setTimeout(() => {
            clientSocket.end();
          }, 100);
        }
      }
    });

    clientSocket.on('error', (err) => {
      this.logger.debug('Client socket error in HTTPS tunnel', err);
    });
  }

  private generateMockHttpResponse(hostname: string, requestLine: string): string {
    // Generate mock HTTP responses based on the hostname and request
    let responseBody = '';

    if (hostname.includes('s3') && requestLine.includes('GET')) {
      responseBody = JSON.stringify({ message: 'Mock S3 GetObject response' });
    } else if (hostname.includes('dynamodb') && requestLine.includes('POST')) {
      responseBody = JSON.stringify({ Item: { id: { S: 'user1' }, name: { S: 'Mock User' } } });
    } else if (hostname.includes('lambda') && requestLine.includes('POST')) {
      responseBody = JSON.stringify({ Payload: Buffer.from(JSON.stringify({ result: 'Mock Lambda response' })).toString('base64') });
    } else {
      responseBody = JSON.stringify({ error: 'Service not mocked' });
    }

    // Return a proper HTTP response
    return `HTTP/1.1 200 OK\r\nContent-Type: application/x-amz-json-1.0\r\nContent-Length: ${responseBody.length}\r\n\r\n${responseBody}`;
  }

  private establishTunnel(req: http.IncomingMessage, clientSocket: import('stream').Duplex, head: Buffer): void {
    const hostname = req.url || '';
    const [host, port] = hostname.split(':');

    const serverSocket = require('net').createConnection({
      host: host,
      port: parseInt(port) || 443
    }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', () => {
      clientSocket.end();
    });

    clientSocket.on('error', () => {
      serverSocket.end();
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const parsedUrl = url.parse(req.url || '');
      const hostname = parsedUrl.hostname || '';

      this.logger.debug(`Handling request: ${req.method} ${req.url} -> ${hostname}`);

      // Check if this is an AWS service request
      if (this.isAwsRequest(hostname)) {
        this.logger.debug(`Intercepted AWS request to ${hostname}`);
        const mockResponse = await this.generateMockResponse(req, hostname);
        if (mockResponse) {
          this.logger.debug(`Returning mock response for ${hostname}`);
          this.sendMockResponse(res, mockResponse);
          return;
        }
      }

      // If not mocked or no mock response, proxy to real AWS
      this.logger.debug(`Proxying request to real AWS: ${hostname}`);
      this.proxyToRealAws(req, res);

    } catch (error) {
      this.logger.error('Error handling request', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal proxy error' }));
    }
  }

  private isAwsRequest(hostname: string): boolean {
    // Remove port number if present
    const cleanHostname = hostname.split(':')[0];

    // Check if the hostname matches AWS service patterns
    const awsPatterns = [
      /\.amazonaws\.com$/,
      /\.aws\.amazon\.com$/,
      /^s3\./,
      /^dynamodb\./,
      /^lambda\./,
      /^sqs\./,
      /^sns\./,
      // Also match bucket names with s3 in them
      /s3\.amazonaws\.com$/,
      /dynamodb\.amazonaws\.com$/,
      /lambda\.amazonaws\.com$/
    ];

    const isAws = awsPatterns.some(pattern => pattern.test(cleanHostname));
    this.logger.debug(`Checking if ${cleanHostname} is AWS request: ${isAws}`);
    return isAws;
  }

  private async generateMockResponse(req: http.IncomingMessage, hostname: string): Promise<MockResponse | null> {
    if (!this.config || !this.config.services) {
      return null;
    }

    const service = this.identifyService(hostname);
    if (!service || !this.config.services[service]) {
      return null;
    }

    const serviceConfig = this.config.services[service];
    const operation = this.extractOperation(req);

    // Generate mock response based on service and operation
    return this.generateServiceResponse(service, operation, serviceConfig, req);
  }

  private identifyService(hostname: string): string | null {
    if (hostname.includes('s3')) return 's3';
    if (hostname.includes('dynamodb')) return 'dynamodb';
    if (hostname.includes('lambda')) return 'lambda';
    if (hostname.includes('sqs')) return 'sqs';
    if (hostname.includes('sns')) return 'sns';
    return null;
  }

  private extractOperation(req: http.IncomingMessage): string {
    // Extract operation from headers, URL, or body
    // This is a simplified version - real AWS APIs have complex operation identification
    const target = req.headers['x-amz-target'] as string;
    if (target) {
      return target.split('.').pop() || 'unknown';
    }

    // For S3, operation might be in the HTTP method + path
    const method = req.method || 'GET';
    const url = req.url || '';
    return `${method}_${url.split('/')[1] || 'unknown'}`;
  }

  private generateServiceResponse(service: string, operation: string, serviceConfig: any, req: http.IncomingMessage): MockResponse {
    switch (service) {
      case 's3':
        return this.generateS3Response(operation, serviceConfig, req);
      case 'dynamodb':
        return this.generateDynamoDBResponse(operation, serviceConfig, req);
      case 'lambda':
        return this.generateLambdaResponse(operation, serviceConfig, req);
      default:
        return {
          statusCode: 501,
          body: { error: `Service ${service} not implemented` }
        };
    }
  }

  private generateS3Response(operation: string, serviceConfig: any, req: http.IncomingMessage): MockResponse {
    const url = req.url || '';
    const pathParts = url.split('/').filter(p => p);
    const bucket = pathParts[0];
    const key = pathParts.slice(1).join('/');

    if (req.method === 'GET' && bucket && key) {
      // GetObject operation
      const bucketConfig = serviceConfig.buckets?.[bucket];
      const objectConfig = bucketConfig?.objects?.[key];

      if (objectConfig) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': objectConfig.metadata?.ContentType || 'application/octet-stream',
            'ETag': `"${Date.now()}"`,
            'Last-Modified': new Date().toUTCString()
          },
          body: objectConfig.content
        };
      }
    }

    if (req.method === 'PUT' && bucket && key) {
      // PutObject operation - just acknowledge
      return {
        statusCode: 200,
        headers: {
          'ETag': `"${Date.now()}"`
        },
        body: ''
      };
    }

    return {
      statusCode: 404,
      body: { error: 'Not Found' }
    };
  }

  private generateDynamoDBResponse(operation: string, serviceConfig: any, req: http.IncomingMessage): MockResponse {
    // Simplified DynamoDB response generation
    if (operation.includes('GetItem')) {
      // Mock GetItem response
      return {
        statusCode: 200,
        body: {
          Item: serviceConfig.tables?.Users?.items?.[0] || {}
        }
      };
    }

    if (operation.includes('PutItem')) {
      // Mock PutItem response
      return {
        statusCode: 200,
        body: {}
      };
    }

    return {
      statusCode: 400,
      body: { error: 'Unsupported operation' }
    };
  }

  private generateLambdaResponse(operation: string, serviceConfig: any, req: http.IncomingMessage): MockResponse {
    if (operation.includes('Invoke')) {
      // Mock Lambda invoke response
      const functionName = this.extractFunctionName(req);
      const functionConfig = serviceConfig.functions?.[functionName];

      if (functionConfig?.response) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: functionConfig.response
        };
      }
    }

    return {
      statusCode: 404,
      body: { error: 'Function not found' }
    };
  }

  private extractFunctionName(req: http.IncomingMessage): string {
    // Extract function name from request body or headers
    // This is simplified - real implementation would parse the JSON body
    return 'myFunction'; // Default for now
  }

  private sendMockResponse(res: http.ServerResponse, mockResponse: MockResponse): void {
    res.writeHead(mockResponse.statusCode, mockResponse.headers || { 'Content-Type': 'application/json' });

    if (typeof mockResponse.body === 'object') {
      res.end(JSON.stringify(mockResponse.body));
    } else {
      res.end(mockResponse.body);
    }
  }

  private proxyToRealAws(req: http.IncomingMessage, res: http.ServerResponse): void {
    // When not mocking, proxy the request to real AWS
    const options = {
      hostname: req.headers.host,
      path: req.url,
      method: req.method,
      headers: req.headers
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(500);
      res.end('Proxy error');
    });

    req.pipe(proxyReq);
  }
}