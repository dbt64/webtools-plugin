export type WebToolsErrorCode = 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'PERMISSION_DENIED' | 'STALE_RUNTIME' | 'CONTEXT_EXPIRED' | 'NOT_AVAILABLE' | 'LIMIT_EXCEEDED' | 'TIMEOUT' | 'CANCELLED' | 'USER_CANCELLED' | 'RUNTIME_CLOSED' | 'INTERNAL_ERROR' | 'CONFIGURATION_NOT_DECLARED' | 'CONFIGURATION_KEY_NOT_FOUND' | 'CONFIG_INCOMPATIBLE'
export interface WebToolsError extends Error { readonly code: WebToolsErrorCode; readonly retryable: false }
export type PluginJson = null | boolean | number | string | PluginJson[] | { [key: string]: PluginJson }
export interface PluginStoredFile { readonly path: string; readonly size: number }
export interface PluginStorageBackup {
  readonly format: 'webtools-plugin-storage'
  readonly version: 1
  readonly pluginId: string
  readonly exportedAt: string
  readonly data: Readonly<Record<string, PluginJson>>
  readonly files: readonly { readonly path: string; readonly data: string }[]
}
export interface TextContext { readonly type: 'text'; readonly source: 'launcher-input' | 'clipboard' | 'selected-text'; readonly text: string }
export type InvocationContext = import('./invocation-context.mjs').InvocationContext
export interface WebToolsCallOptions { readonly signal?: AbortSignal }
export interface PluginSearchResult { readonly id: string; readonly title: string; readonly description?: string; readonly icon?: string }
export interface PluginSearchSelection { readonly id: string; readonly query: string; readonly revision: number; readonly item: Required<PluginSearchResult> }
export interface ScreenDisplayInfo { readonly id: string; readonly label: string; readonly bounds: Readonly<{ x: number; y: number; width: number; height: number }>; readonly workArea: Readonly<{ x: number; y: number; width: number; height: number }>; readonly scaleFactor: number; readonly rotation: 0 | 90 | 180 | 270; readonly primary: boolean }
export type PluginLifecycleEvent = Readonly<import('./protocol.mjs').PluginLifecycleEvent>
export type TaskSchedule = import('./capability-methods.mjs').TaskSchedule
export type TaskRequest = import('./capability-methods.mjs').TaskRequest
export type TaskTrigger = Readonly<import('./protocol.mjs').ScheduledTrigger>
export interface ScheduledTask extends TaskRequest {
  readonly pluginId: string; readonly featureId: string; readonly nextRunMs: number | null; readonly createdAtMs: number
  readonly enabled: boolean; readonly running: boolean; readonly successes: number; readonly failures: number
  readonly lastRunMs: number | null; readonly lastError: string | null
}
export interface WebToolsConnection {
  readonly tasks: {
    request(input: TaskRequest, options?: WebToolsCallOptions): Promise<ScheduledTask>
    list(options?: WebToolsCallOptions): Promise<readonly ScheduledTask[]>
    remove(code: string, options?: WebToolsCallOptions): Promise<boolean>
    onTrigger(listener: (event: TaskTrigger) => void | Promise<void>): () => void
  }
  readonly lifecycle: {
    readonly ready: Promise<void>
    onInitialize(listener: () => void): () => void
    onEnter(listener: (event: PluginLifecycleEvent) => void): () => void
    onShow(listener: (event: PluginLifecycleEvent) => void): () => void
    onHide(listener: (event: PluginLifecycleEvent) => void): () => void
    onClose(listener: () => void): () => void
  }
  readonly ready: Promise<void>
  readonly context: { current(options?: WebToolsCallOptions): Promise<InvocationContext | null>; onChange(listener: () => void): () => void }
  readonly shortcuts: { current(options?: WebToolsCallOptions): Promise<string | null> }
  readonly config: {
    get(options?: WebToolsCallOptions): Promise<Readonly<Record<string, string | boolean | number>>>
    set(key: string, value: string | boolean | number, options?: WebToolsCallOptions): Promise<void>
  }
  readonly storage: {
    list(prefix?: string, options?: WebToolsCallOptions): Promise<readonly string[]>
    get(key: string, options?: WebToolsCallOptions): Promise<PluginJson>
    set(key: string, value: PluginJson, options?: WebToolsCallOptions): Promise<void>
    delete(key: string, options?: WebToolsCallOptions): Promise<void>
    readonly files: {
      list(prefix?: string, options?: WebToolsCallOptions): Promise<readonly PluginStoredFile[]>
      read(path: string, options?: WebToolsCallOptions): Promise<Uint8Array | null>
      write(path: string, data: Uint8Array | ArrayBuffer, options?: WebToolsCallOptions): Promise<void>
      delete(path: string, options?: WebToolsCallOptions): Promise<void>
    }
    readonly backup: {
      export(options?: WebToolsCallOptions): Promise<PluginStorageBackup>
      import(backup: PluginStorageBackup, options?: WebToolsCallOptions): Promise<void>
    }
  }
  readonly ai?: { complete(input: { prompt: string }, options?: WebToolsCallOptions): Promise<{ readonly text: string }> }
  readonly system?: {
    readonly media: { transcode(input: import('./capability-methods.mjs').MediaTranscode, options?: WebToolsCallOptions): Promise<{ path: string } | null> }
    readonly browser: { open(url: string, options?: WebToolsCallOptions): Promise<{ id: string }>; step(input: import('./capability-methods.mjs').BrowserStep, options?: WebToolsCallOptions): Promise<string | null>; close(id: string, options?: WebToolsCallOptions): Promise<void> }
    readonly image: { transform(input: Omit<import('./capability-methods.mjs').ImageTransform, 'quality'> & { quality?: number }, options?: WebToolsCallOptions): Promise<{ dataUrl: string; width: number; height: number; bytes: number }> }; notify(title: string, body?: string, options?: WebToolsCallOptions): Promise<void>; pasteText(text: string, options?: WebToolsCallOptions): Promise<void>; getDisplays(options?: WebToolsCallOptions): Promise<readonly ScreenDisplayInfo[]>; captureScreen(input?: { displayId?: string }, options?: WebToolsCallOptions): Promise<string> }
  readonly clipboard?: { readText(options?: WebToolsCallOptions): Promise<string>; writeText(text: string, options?: WebToolsCallOptions): Promise<void>; readImage(options?: WebToolsCallOptions): Promise<string | null>; writeImage(dataUrl: string, options?: WebToolsCallOptions): Promise<void>; readFiles(options?: WebToolsCallOptions): Promise<string[]>; writeFiles(paths: string[], options?: WebToolsCallOptions): Promise<void> }
  readonly files?: {
    select(input?: { kind?: 'file' | 'directory'; multiple?: boolean }, options?: WebToolsCallOptions): Promise<string[]>
    openPath(path: string, options?: WebToolsCallOptions): Promise<void>
  }
  readonly windows?: {
    readonly currentId: string
    create(input?: { title?: string; width?: number; height?: number; document?: string; chrome?: 'host' | 'frameless' | 'native' }, options?: WebToolsCallOptions): Promise<{ id: string }>
    show(id: string, options?: WebToolsCallOptions): Promise<void>
    hide(id: string, options?: WebToolsCallOptions): Promise<void>
    close(id: string, options?: WebToolsCallOptions): Promise<void>
    setBounds(id: string, bounds: { x: number; y: number; width: number; height: number }, options?: WebToolsCallOptions): Promise<void>
    setAlwaysOnTop(id: string, enabled: boolean, options?: WebToolsCallOptions): Promise<void>
    postMessage(targetId: string, data: PluginJson, options?: WebToolsCallOptions): Promise<void>
    onMessage(listener: (event: { from: string; data: PluginJson }) => void): () => void
    onClosed(listener: (id: string) => void): () => void
  }
  readonly subInput: {
    show(options?: { placeholder?: string }, callOptions?: WebToolsCallOptions): Promise<void>
    hide(options?: WebToolsCallOptions): Promise<void>
    getText(options?: WebToolsCallOptions): Promise<string>
    setText(text: string, options?: WebToolsCallOptions): Promise<void>
    focus(options?: WebToolsCallOptions): Promise<void>
    releaseFocus(options?: WebToolsCallOptions): Promise<void>
    onChange(listener: (value: string, revision: number) => void): () => void
  }
  readonly results: {
    update(input: { query: string; revision: number; items: readonly PluginSearchResult[]; loading?: boolean; error?: string }, options?: WebToolsCallOptions): Promise<void>
    clear(query: string, revision: number, options?: WebToolsCallOptions): Promise<void>
    onSelect(listener: (selection: PluginSearchSelection) => void): () => void
  }
  /** Plugin-local cleanup notification; returns a local unsubscribe function. */
  onClose(listener: () => void): () => void
}
export function connectWebTools(): WebToolsConnection
