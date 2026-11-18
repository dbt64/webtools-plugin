/** Paths owned by the active plugin runtime. The package path contains declared resources; local data survives runtime restarts. */
export interface PluginRuntimePaths {
  readonly packageDirectory: string
  readonly localDataDirectory: string
}

/** Resolve stable package resources and per-plugin writable data from a Node Plugin preload. */
export declare function getPluginPaths(preloadDirectory: string): PluginRuntimePaths

export interface CommandInvocation {
  /** Present for scheduled invocations; a resolved handler records success, a thrown error records failure. */
  readonly task?: Readonly<import('./web/protocol.mjs').ScheduledTrigger>
  readonly resultTarget?: 'super-panel'
  readonly context: import('./web/invocation-context.mjs').InvocationContext | null
  readonly signal: AbortSignal
  readonly webtools: {
    readonly context: { current(): Promise<CommandInvocation['context']> }
    readonly shortcuts: { current(): Promise<string | null> }
    readonly tasks: { request(input: import('./web/index.js').TaskRequest): Promise<import('./web/index.js').ScheduledTask>; list(): Promise<readonly import('./web/index.js').ScheduledTask[]>; remove(code: string): Promise<boolean> }
    readonly config: { get(): Promise<Readonly<Record<string, string | boolean | number>>>; set(key: string, value: string | boolean | number): Promise<void> }
    readonly storage: {
      list(prefix?: string): Promise<string[]>
      get(key: string): Promise<import('./web/protocol.mjs').JsonValue>
      set(key: string, value: import('./web/protocol.mjs').JsonValue): Promise<null>
      delete(key: string): Promise<null>
      readonly files: {
        list(prefix?: string): Promise<Array<{ readonly path: string; readonly size: number }>>
        read(path: string): Promise<Uint8Array | null>
        write(path: string, data: Uint8Array | ArrayBuffer): Promise<null>
        delete(path: string): Promise<null>
      }
      readonly backup: {
        export(): Promise<{ readonly format: 'webtools-plugin-storage'; readonly version: 1; readonly pluginId: string; readonly exportedAt: string; readonly data: Readonly<Record<string, import('./web/protocol.mjs').JsonValue>>; readonly files: readonly { readonly path: string; readonly data: string }[] }>
        import(backup: { readonly format: 'webtools-plugin-storage'; readonly version: 1; readonly pluginId: string; readonly exportedAt: string; readonly data: Readonly<Record<string, import('./web/protocol.mjs').JsonValue>>; readonly files: readonly { readonly path: string; readonly data: string }[] }): Promise<null>
      }
    }
    readonly system?: { readonly image: { transform(input: Omit<import('./web/capability-methods.mjs').ImageTransform, 'quality'> & { quality?: number }): Promise<{ dataUrl: string; width: number; height: number; bytes: number }> } }
    readonly ai?: { complete(input: { prompt: string }): Promise<{ text: string }> }
    readonly clipboard?: { writeText(text: string): Promise<null> }
    /** HTTP(S) only, requires the declared/granted capability and one-use user activation. */
    readonly external?: { open(url: string): Promise<null> }
  }
}
/** For a node-command Feature with mcpTool, export a CommonJS function with this signature. */
export type McpToolHandler<Input extends object = Record<string, unknown>, Output extends object = Record<string, unknown>> =
  (invocation: CommandInvocation & { readonly mcpInput: Readonly<Input> }) => Output | Promise<Output>

/** A single bounded invocation; a resolved handler means completion, not background ownership. */
export interface FeatureTextResult { readonly kind: 'text'; readonly text: string }
export declare function defineCommand(handler: (invocation: CommandInvocation) => void | FeatureTextResult | Promise<void | FeatureTextResult>): (invocation: CommandInvocation) => void | FeatureTextResult | Promise<void | FeatureTextResult>
