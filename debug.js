const fs = require('fs');
const path = require('path');
const os = require('os');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-walled-garden-test-'));
console.log('Temp dir:', tempDir);

const v2File = path.join(tempDir, 'v2-test.js');
const v2Content = 'const AWS = require("aws-sdk");';
fs.writeFileSync(v2File, v2Content);

console.log('Created v2 file with content:', fs.readFileSync(v2File, 'utf8'));

const files = [];
const scanDirectory = (dir) => {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (stat.isFile() && ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
};

scanDirectory(tempDir);
console.log('Files found:', files);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  console.log('File:', file);
  console.log('Content:', content);
  console.log('Contains @aws-sdk:', content.includes('@aws-sdk/'));
  console.log('Contains require aws-sdk:', content.includes('require("aws-sdk")'));
});

fs.rmSync(tempDir, { recursive: true, force: true });