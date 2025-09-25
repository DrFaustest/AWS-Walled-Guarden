"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
// Configure AWS SDK
AWS.config.update({
    region: 'us-east-1'
});
async function testServices() {
    // S3 operations
    const s3 = new AWS.S3();
    await s3.getObject({
        Bucket: 'my-test-bucket',
        Key: 'config.json'
    }).promise();
    await s3.putObject({
        Bucket: 'my-test-bucket',
        Key: 'data.txt',
        Body: 'Hello World'
    }).promise();
    // DynamoDB operations
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    await dynamodb.get({
        TableName: 'Users',
        Key: { id: 'user123' }
    }).promise();
    await dynamodb.put({
        TableName: 'Users',
        Item: {
            id: 'user456',
            name: 'John Doe',
            email: 'john@example.com'
        }
    }).promise();
    // Lambda operations
    const lambda = new AWS.Lambda();
    await lambda.invoke({
        FunctionName: 'my-function',
        Payload: JSON.stringify({ message: 'Hello' })
    }).promise();
    // SQS operations
    const sqs = new AWS.SQS();
    await sqs.sendMessage({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
        MessageBody: 'Hello from SQS'
    }).promise();
    // SNS operations
    const sns = new AWS.SNS();
    await sns.publish({
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic',
        Message: 'Hello from SNS'
    }).promise();
}
//# sourceMappingURL=test-aws-calls.js.map