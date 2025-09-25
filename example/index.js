const AWS = require('aws-sdk');

// Configure AWS SDK (no credentials needed with AWS Walled Garden!)
AWS.config.update({
  region: 'us-east-1'
});

async function testS3() {
  console.log('Testing S3 with AWS Walled Garden...');

  const s3 = new AWS.S3();

  try {
    // This will return mock data instead of requiring real AWS credentials
    const response = await s3.getObject({
      Bucket: 'my-test-bucket',
      Key: 'config.json'
    }).promise();

    console.log('S3 Response:', JSON.parse(response.Body.toString()));
  } catch (error) {
    console.error('S3 Error:', error.message);
  }
}

async function testDynamoDB() {
  console.log('Testing DynamoDB with AWS Walled Garden...');

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  try {
    // This will return mock data from your configuration
    const response = await dynamodb.get({
      TableName: 'Users',
      Key: { id: 'user1' }
    }).promise();

    console.log('DynamoDB Response:', response.Item);
  } catch (error) {
    console.error('DynamoDB Error:', error.message);
  }
}

async function testLambda() {
  console.log('Testing Lambda with AWS Walled Garden...');

  const lambda = new AWS.Lambda();

  try {
    // This will return your configured mock response
    const response = await lambda.invoke({
      FunctionName: 'myFunction',
      Payload: JSON.stringify({ test: 'data' })
    }).promise();

    console.log('Lambda Response:', JSON.parse(response.Payload.toString()));
  } catch (error) {
    console.error('Lambda Error:', error.message);
  }
}

async function main() {
  console.log('🚀 AWS Walled Garden Example');
  console.log('Make sure the extension is enabled before running this!');
  console.log('');

  await testS3();
  console.log('');

  await testDynamoDB();
  console.log('');

  await testLambda();

  console.log('');
  console.log('✅ Example completed! Check the VS Code output for extension logs.');
}

main().catch(console.error);