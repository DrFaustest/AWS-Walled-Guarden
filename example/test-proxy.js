const { ProxyServer } = require('../out/proxyServer');
const fs = require('fs');
const path = require('path');

async function testProxyServer() {
  console.log('🧪 Testing AWS Walled Garden Proxy Server...\n');

  // Set logger to debug level
  const { Logger } = require('../out/logger');
  const logger = Logger.getInstance();
  logger.setLogLevel(0); // DEBUG level

  // Load the mock configuration
  const configPath = path.join(__dirname, '.aws-mock.json');
  const configContent = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configContent);

  console.log('📄 Loaded configuration:', config.services ? Object.keys(config.services) : 'none');

  // Create and start proxy server
  const proxyServer = new ProxyServer();

  try {
    console.log('🚀 Starting proxy server...');
    await proxyServer.start(config);
    console.log('✅ Proxy server started successfully on port 3128');

    // Test with AWS SDK configured to use proxy
    console.log('\n📡 Testing AWS SDK calls with proxy...');

    const AWS = require('aws-sdk');
    const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;

    // Configure AWS SDK to use proxy
    const proxyAgent = new HttpsProxyAgent('http://localhost:3128');

    // Configure AWS SDK to use HTTP (not HTTPS) for testing
    AWS.config.update({
      region: 'us-east-1',
      httpOptions: {
        agent: proxyAgent
      },
      // Use HTTP instead of HTTPS for testing
      sslEnabled: false,
      // Disable credential checking for testing
      credentials: {
        accessKeyId: 'mock-key',
        secretAccessKey: 'mock-secret'
      }
    });

    // Test S3
    console.log('\n🪣 Testing S3...');
    const s3 = new AWS.S3();
    try {
      const s3Response = await s3.getObject({
        Bucket: 'my-test-bucket',
        Key: 'config.json'
      }).promise();

      console.log('✅ S3 Response received!');
      console.log('📄 Content:', JSON.parse(s3Response.Body.toString()));
    } catch (error) {
      console.log('❌ S3 Error:', error.message);
    }

    // Test DynamoDB
    console.log('\n🗄️ Testing DynamoDB...');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    try {
      const dbResponse = await dynamodb.get({
        TableName: 'Users',
        Key: { id: 'user1' }
      }).promise();

      console.log('✅ DynamoDB Response received!');
      console.log('👤 User:', dbResponse.Item);
    } catch (error) {
      console.log('❌ DynamoDB Error:', error.message);
    }

    // Test Lambda
    console.log('\n⚡ Testing Lambda...');
    const lambda = new AWS.Lambda();
    try {
      const lambdaResponse = await lambda.invoke({
        FunctionName: 'myFunction',
        Payload: JSON.stringify({ test: 'data' })
      }).promise();

      console.log('✅ Lambda Response received!');
      console.log('📤 Payload:', JSON.parse(lambdaResponse.Payload.toString()));
    } catch (error) {
      console.log('❌ Lambda Error:', error.message);
    }

    console.log('\n🎉 Proxy server test completed!');

  } catch (error) {
    console.error('❌ Proxy server test failed:', error);
  } finally {
    // Stop the proxy server
    console.log('\n🛑 Stopping proxy server...');
    await proxyServer.stop();
    console.log('✅ Proxy server stopped');
  }
}

// Run the test
testProxyServer().catch(console.error);