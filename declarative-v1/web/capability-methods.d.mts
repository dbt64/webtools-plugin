export type MediaTranscode = { inputPath: string; format: 'wav' | 'mp3' | 'mp4' | 'webm' }
export type BrowserStep = { id: string; action: 'navigate'; value: string } | { id: string; action: 'input'; value: string; selector: string } | { id: string; action: 'click' | 'text'; selector: string } | { id: string; action: 'screenshot' }
export type ImageTransform = { dataUrl: string; width: number; height?: number; format: 'png' | 'jpeg'; quality: number }
import type { JsonValue } from './protocol.mjs'
export type TaskSchedule = { kind: 'once'; atMs: number } | { kind: 'cron'; expression: string; startMs?: number; endMs?: number }
export type TaskRequest = { code: string; description: string; schedule: TaskSchedule }
export type CapabilityRequest =
  | { method: 'system.mediaTranscode'; payload: MediaTranscode }
  | { method: 'system.browserOpen'; payload: { url: string } }
  | { method: 'system.browserStep'; payload: BrowserStep }
  | { method: 'system.browserClose'; payload: { id: string } }
  | { method: 'system.imageTransform'; payload: ImageTransform }
  | { method: 'tasks.request'; payload: TaskRequest }
  | { method: 'tasks.list' | 'tasks.subscribe'; payload: null }
  | { method: 'tasks.remove'; payload: { code: string } }
  | { method: 'tasks.complete'; payload: { executionId: string; error: string | null } }
  | { method: 'system.pasteText'; payload: { text: string } }
  | { method: 'system.notify'; payload: { title: string; body: string } }
  | { method: 'system.getDisplays'; payload: null }
  | { method: 'system.captureScreen'; payload: { displayId?: string } }
  | { method: 'lifecycle.subscribe'; payload: null }
  | { method: 'context.current'; payload: null }
  | { method: 'shortcuts.current'; payload: null }
  | { method: 'config.get'; payload: null }
  | { method: 'config.set'; payload: { key: string; value: string | boolean | number } }
  | { method: 'storage.get' | 'storage.delete'; payload: { key: string } }
  | { method: 'storage.list'; payload: { prefix: string } }
  | { method: 'storage.set'; payload: { key: string; value: JsonValue } }
  | { method: 'storage.files.list'; payload: { prefix: string } }
  | { method: 'storage.files.read' | 'storage.files.delete'; payload: { path: string } }
  | { method: 'storage.files.write'; payload: { path: string; data: string } }
  | { method: 'storage.backup.export'; payload: null }
  | { method: 'storage.backup.import'; payload: { backup: JsonValue } }
  | { method: 'ai.complete'; payload: { prompt: string } }
  | { method: 'clipboard.write'; payload: { text: string } }
  | { method: 'clipboard.readText'; payload: null }
  | { method: 'clipboard.readImage' | 'clipboard.readFiles'; payload: null }
  | { method: 'clipboard.writeImage'; payload: { dataUrl: string } }
  | { method: 'clipboard.writeFiles'; payload: { paths: string[] } }
  | { method: 'files.select'; payload: { kind: 'file' | 'directory'; multiple: boolean } }
  | { method: 'files.openPath'; payload: { path: string } }
  | { method: 'external.open'; payload: { url: string } }
  | { method: 'subInput.show'; payload: { placeholder: string } }
  | { method: 'subInput.hide' | 'subInput.getText' | 'subInput.focus' | 'subInput.releaseFocus'; payload: null }
  | { method: 'subInput.setText'; payload: { text: string } }
  | { method: 'search.results.update'; payload: { query: string; revision: number; items: Array<{ id: string; title: string; description?: string; icon?: string }>; loading: boolean; error?: string } }
  | { method: 'search.results.clear'; payload: { query: string; revision: number } }
  | { method: 'window.create'; payload: { title?: string; width?: number; height?: number; document?: string; chrome?: 'host' | 'frameless' | 'native' } }
  | { method: 'window.show' | 'window.hide' | 'window.close'; payload: { id: string } }
  | { method: 'window.setBounds'; payload: { id: string; x: number; y: number; width: number; height: number } }
  | { method: 'window.setAlwaysOnTop'; payload: { id: string; enabled: boolean } }
  | { method: 'window.postMessage'; payload: { targetId: string; data: JsonValue } }
export declare const CAPABILITY_METHODS: readonly CapabilityRequest['method'][]
export declare function validateCapabilityRequest(method: string, payload: unknown): CapabilityRequest
export declare function validateCapabilityResult(method: string, result: unknown): void
