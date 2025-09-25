// Mock VS Code API for testing
export namespace vscode {
  export type Thenable<T> = Promise<T>;
  export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9
  }

  export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
  }

  export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3
  }

  export enum StatusBarAlignment {
    Left = 1,
    Right = 2
  }

  export class Position {
    constructor(public line: number, public character: number) {}
  }

  export class Range {
    constructor(public start: Position, public end: Position) {}
  }

  export class Uri {
    static file(path: string): Uri {
      return new Uri('file', '', path);
    }
    static parse(value: string): Uri {
      return new Uri('file', '', value);
    }
    static joinPath(uri: Uri, ...pathSegments: string[]): Uri {
      const path = [uri.path, ...pathSegments].join('/');
      return new Uri(uri.scheme, uri.authority, path);
    }
    constructor(public scheme: string, public authority: string, public path: string) {}
    get fsPath(): string {
      return this.path;
    }
    toString(): string {
      return `${this.scheme}://${this.authority}${this.path}`;
    }
  }

  export class WorkspaceFolder {
    constructor(public uri: Uri, public name: string, public index: number) {}
  }

  export class TextDocument {
    constructor(public uri: Uri, public languageId: string, public version: number, public content: string) {}
    getText(range?: Range): string {
      return this.content;
    }
    lineAt(line: number): TextLine {
      const lines = this.content.split('\n');
      return {
        lineNumber: line,
        text: lines[line] || '',
        range: new Range(new Position(line, 0), new Position(line, (lines[line] || '').length)),
        rangeIncludingLineBreak: new Range(new Position(line, 0), new Position(line, (lines[line] || '').length + 1)),
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: (lines[line] || '').trim().length === 0
      };
    }
    lineCount: number = this.content.split('\n').length;
  }

  export interface TextLine {
    lineNumber: number;
    text: string;
    range: Range;
    rangeIncludingLineBreak: Range;
    firstNonWhitespaceCharacterIndex: number;
    isEmptyOrWhitespace: boolean;
  }

  export class TextEditor {
    constructor(public document: TextDocument, public selection: Selection, public visibleRanges: Range[]) {}
  }

  export class Selection {
    constructor(public anchor: Position, public active: Position) {}
  }

  export interface ExtensionContext {
    subscriptions: any[];
    workspaceState: Memento;
    globalState: Memento;
    extensionUri: Uri;
    extensionPath: string;
    storageUri: Uri | undefined;
    storagePath: string | undefined;
    logUri: Uri;
    logPath: string;
  }

  export interface Memento {
    get<T>(key: string, defaultValue?: T): T;
    update(key: string, value: any): Thenable<void>;
  }

  export class EventEmitter<T> {
    event = (listener: (e: T) => any) => {
      return { dispose: () => {} };
    };
    fire(data?: T): void {}
  }

  export interface Disposable {
    dispose(): any;
  }

  export interface Command {
    command: string;
    title: string;
    category?: string;
  }

  export interface CompletionItem {
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    range?: Range;
    commitCharacters?: string[];
    keepWhitespace?: boolean;
    preselect?: boolean;
    tags?: CompletionItemTag[];
  }

  export class CompletionItem {
    constructor(
      public label: string,
      public kind?: CompletionItemKind
    ) {
      this.detail = undefined;
      this.documentation = undefined;
      this.sortText = undefined;
      this.filterText = undefined;
      this.insertText = undefined;
      this.range = undefined;
      this.commitCharacters = undefined;
      this.keepWhitespace = undefined;
      this.preselect = undefined;
      this.tags = undefined;
    }
    detail?: string;
    documentation?: string;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    range?: Range;
    commitCharacters?: string[];
    keepWhitespace?: boolean;
    preselect?: boolean;
    tags?: CompletionItemTag[];
  }

  export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15,
    File = 16,
    Reference = 17,
    Folder = 18,
    EnumMember = 19,
    Constant = 20,
    Struct = 21,
    Event = 22,
    Operator = 23,
    TypeParameter = 24
  }

  export enum CompletionItemTag {
    Deprecated = 1
  }

  export interface CompletionContext {
    triggerKind: CompletionTriggerKind;
    triggerCharacter?: string;
  }

  export enum CompletionTriggerKind {
    Invoke = 0,
    TriggerCharacter = 1,
    TriggerForIncompleteCompletions = 2
  }

  export class MarkdownString {
    constructor(value?: string) {
      this.value = value || '';
    }
    value: string;
    isTrusted?: boolean;
    supportThemeIcons?: boolean;
  }

  export enum TestRunProfileKind {
    Run = 1,
    Debug = 2,
    Coverage = 3
  }

  export interface TestRun {
    // Mock implementation
  }

  export interface TestController {
    // Mock implementation
  }

  export interface TestItem {
    // Mock implementation
  }

  export interface OutputChannel {
    name: string;
    append(value: string): void;
    appendLine(value: string): void;
    clear(): void;
    show(preserveFocus?: boolean): void;
    hide(): void;
    dispose(): void;
  }

  export interface StatusBarItem {
    text: string;
    tooltip?: string;
    color?: string;
    command?: string;
    show(): void;
    hide(): void;
    dispose(): void;
  }

  export interface WorkspaceConfiguration {
    get<T>(section: string, defaultValue?: T): T;
    has(section: string): boolean;
    inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T } | undefined;
    update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean): Thenable<void>;
  }

  // Mock implementations
  const registeredCommands = new Map<string, (...args: any[]) => any>();
  
  export const commands = {
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
      registeredCommands.set(command, callback);
      return { dispose: () => registeredCommands.delete(command) };
    },
    executeCommand: async (command: string, ...args: any[]) => {
      const handler = registeredCommands.get(command);
      if (handler) {
        return await handler(...args);
      }
      return Promise.resolve();
    },
    getCommands: (filterInternal?: boolean) => Promise.resolve([
      'awsWalledGarden.enable',
      'awsWalledGarden.disable',
      'awsWalledGarden.reloadConfig',
      'awsWalledGarden.showLogs',
      'awsWalledGarden.autoConfigure',
      'awsWalledGarden.toggle',
      'awsWalledGarden.openConfig',
      'awsWalledGarden.showSchema',
      'awsWalledGarden.installSdk',
      'awsWalledGarden.createTemplate',
      'awsWalledGarden.openGuiEditor'
    ])
  };

  export const languages = {
    createDiagnosticCollection: (name?: string) => ({
      name,
      set: () => {},
      delete: () => {},
      clear: () => {},
      dispose: () => {},
      has: () => false
    }),
    registerCompletionItemProvider: (selector: any, provider: any) => ({ dispose: () => {} })
  };

  export const window = {
    createOutputChannel: (name: string): OutputChannel => ({
      name,
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }),
    createStatusBarItem: (): StatusBarItem => ({
      text: '',
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }),
    showInformationMessage: (message: string) => Promise.resolve(),
    showErrorMessage: (message: string) => Promise.resolve(),
    showWarningMessage: (message: string) => Promise.resolve(),
    activeTextEditor: undefined as TextEditor | undefined
  };

  export const workspace = {
    getConfiguration: (section?: string): WorkspaceConfiguration => ({
      get: <T>(key: string, defaultValue?: T): T => defaultValue as T,
      has: () => false,
      inspect: () => undefined,
      update: () => Promise.resolve()
    }),
    workspaceFolders: [new WorkspaceFolder(Uri.file(process.cwd()), 'test-workspace', 0)],
    onDidChangeConfiguration: new EventEmitter().event,
    onDidChangeWorkspaceFolders: new EventEmitter().event,
    findFiles: (pattern: string) => Promise.resolve([] as Uri[]),
    openTextDocument: (uri: Uri | string | any) => {
      if (typeof uri === 'object' && uri.content) {
        // Handle content options
        return Promise.resolve(new TextDocument(Uri.file('untitled'), uri.language || 'plaintext', 1, uri.content));
      }
      const uriObj = typeof uri === 'string' ? Uri.parse(uri) : uri;
      return Promise.resolve(new TextDocument(uriObj, 'plaintext', 1, ''));
    },
    createFileSystemWatcher: (pattern: any) => ({
      onDidChange: new EventEmitter().event,
      onDidCreate: new EventEmitter().event,
      onDidDelete: new EventEmitter().event,
      dispose: () => {}
    })
  };
}