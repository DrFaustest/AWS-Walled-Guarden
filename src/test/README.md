# src/test (Tests)

This folder contains the tests and test runner for the AWS Walled Garden extension.

## Structure

- `runTest.ts` — Test runner bootstrap that uses Mocha to execute compiled tests in `out/test`.
- `suite/` — Example test suite (`index.ts`) and additional tests should go here. Tests are written as TypeScript and compiled to `out/test` for execution.

## Run tests (development)

1. Install dependencies at the project root:

```powershell
npm install
```

2. Compile the project (tests are in `src/test` and will be compiled to `out/test`):

```powershell
npm run compile
```

3. Run tests:

```powershell
npm test
```

Notes:

- The `test` npm script calls `node ./out/test/runTest.js`. Ensure the compiled files exist.
- When running extension integration tests (using `@vscode/test-electron`), additional configuration may be necessary (see `package.json` devDependencies).

## Writing tests

- Add new tests under `src/test/suite` as `.ts` files. Use Mocha's `suite`/`test` functions or standard `describe`/`it` if preferred.
- Use `assert` (Node's assert module) for assertions or add an assertion library.
- Keep tests fast and isolated. For integration tests that require the extension, run them inside VS Code's Extension Test Host (see `@vscode/test-electron` docs).

## Troubleshooting

- If tests do not run, make sure TypeScript compilation succeeded and `out/test` contains the compiled JS files.
- Use `npm run pretest` to run compile + lint checks before executing tests.
