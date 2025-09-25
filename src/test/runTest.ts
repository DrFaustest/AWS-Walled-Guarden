import * as path from 'path';
import * as Mocha from 'mocha';
import * as fs from 'fs';

// Load the setup file first to mock vscode
require('./setup');

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
    slow: 5000,
    reporter: 'spec'
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    try {
      // Manually find test files in the suite directory
      const suiteDir = path.join(__dirname, 'suite');
      console.log('Looking for test files in:', suiteDir);

      if (!fs.existsSync(suiteDir)) {
        console.error('Suite directory does not exist:', suiteDir);
        return e(new Error('Suite directory not found'));
      }

      const files = fs.readdirSync(suiteDir)
        .filter(file => file.endsWith('.test.js'))
        .map(file => path.join(suiteDir, file));

      console.log(`Found ${files.length} test files:`, files);

      // Add files to the test suite
      files.forEach(f => {
        console.log(`Adding test file: ${f}`);
        mocha.addFile(f);
      });

      // Run the mocha test
      mocha.run(failures => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      console.error('Error in test runner:', err);
      e(err);
    }
  });
}

// Run the tests if this file is executed directly
if (require.main === module) {
  run().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}