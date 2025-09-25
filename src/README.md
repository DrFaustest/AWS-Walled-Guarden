# src (Source)

This folder contains the TypeScript source for the AWS Walled Garden VS Code extension. It implements a local proxy that intercepts AWS SDK calls and returns mock responses defined by a configuration file (`.aws-mock.json`).

## High-level architecture

- extension.ts — VS Code extension entry point. Registers commands and initializes the MockManager.
- mockManager.ts — Manages the extension lifecycle: loading config, enabling/disabling the proxy, creating a template config.
- proxyServer.ts — Implements an HTTP proxy and CONNECT handling for HTTPS. Intercepts AWS hostnames and returns mock responses or forwards to real AWS.
- configValidator.ts — Simple validator for the mock configuration file format.
- logger.ts — Lightweight logging abstraction that works inside and outside VS Code.

## Build / Run (development)

1. Install dependencies at the workspace root:

```powershell
npm install
```

2. Compile TypeScript (single run):

```powershell
npm run compile
```

3. Run extension in VS Code Extension Development Host:

- Press F5 from the root project in VS Code; a new window opens where the extension is loaded.

4. During development you can watch for changes:

```powershell
npm run watch
```

## Configuration and runtime behavior

- On enable, `MockManager` loads the configuration file (path set from VS Code setting `awsWalledGarden.configFile`, default `.aws-mock.json`). If missing, a template is created in the workspace root.
- `MockManager` creates and starts `ProxyServer`, which sets `HTTP_PROXY` and `HTTPS_PROXY` environment variables so Node SDKs that honor these variables will route through the proxy.
- The proxy inspects requests for AWS hostnames and generates mock responses based on the loaded configuration. If nothing matches, requests are proxied to the real AWS endpoints.

## Key extension commands

These are registered in `extension.ts` and available via the command palette:

- `awsWalledGarden.enable` — Start proxy and enable mocking
- `awsWalledGarden.disable` — Stop proxy and disable mocking
- `awsWalledGarden.reloadConfig` — Reload the `.aws-mock.json` file
- `awsWalledGarden.showLogs` — Open extension logs (Output panel)

## Notes and next improvements

- `proxyServer.ts` contains simplified request parsing and a basic set of mocked behaviors. For production-quality behavior, consider using proper HTTP parsing, richer operation detection, and more complete AWS response shapes.
- Consider adding unit tests for request parsing and mock generation logic.
- Watch out for port conflicts (default proxy port 3128). The code currently hardcodes the port — make this configurable.
