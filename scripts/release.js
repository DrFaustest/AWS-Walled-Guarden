#!/usr/bin/env node

/**
 * Release script for AWS Walled Garden extension
 * Usage: npm run release [patch|minor|major]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const releaseType = process.argv[2] || 'patch';

console.log(`🚀 Preparing ${releaseType} release...`);

// Read current package.json
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Get current version
const currentVersion = packageJson.version;
console.log(`📦 Current version: ${currentVersion}`);

// Calculate new version
const versionParts = currentVersion.split('.').map(Number);
switch (releaseType) {
  case 'major':
    versionParts[0]++;
    versionParts[1] = 0;
    versionParts[2] = 0;
    break;
  case 'minor':
    versionParts[1]++;
    versionParts[2] = 0;
    break;
  case 'patch':
  default:
    versionParts[2]++;
    break;
}

const newVersion = versionParts.join('.');
console.log(`✨ New version: ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('📝 Updated package.json');

// Update CHANGELOG.md
const changelogPath = path.join(__dirname, 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf8');

// Add new version entry
const today = new Date().toISOString().split('T')[0];
const newEntry = `## [${newVersion}] - ${today}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n`;
changelog = changelog.replace('# Changelog', '# Changelog\n\n' + newEntry);
fs.writeFileSync(changelogPath, changelog);
console.log('📝 Updated CHANGELOG.md');

console.log('\n🎯 Next steps:');
console.log('1. Edit CHANGELOG.md to describe the changes');
console.log('2. Commit your changes:');
console.log(`   git add . && git commit -m "Release v${newVersion}"`);
console.log('3. Create and push the tag:');
console.log(`   git tag v${newVersion} && git push origin main v${newVersion}`);
console.log('\n🚀 GitHub Actions will automatically:');
console.log('   - Run tests');
console.log('   - Publish to VS Code Marketplace');
console.log('   - Create a GitHub release with the .vsix file');