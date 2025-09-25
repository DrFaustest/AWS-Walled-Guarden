const content = `const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB();`;

const lines = content.split('\n');
console.log('Content:');
console.log(content);

const pattern = /new\s+AWS\.(\w+)\(\)/g;
console.log('Matches:');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matches = [...line.matchAll(pattern)];
  if (matches.length > 0) {
    console.log('Line', i, 'matches:', matches.map(m => ({match: m[0], service: m[1]})));
  }
}