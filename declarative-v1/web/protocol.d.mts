export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type BridgeErrorCode = 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'PERMISSION_DENIED' | 'STALE_RUNTIME' | 'CONTEXT_EXPIRED' | 'NOT_AVAILABLE' | 'LIMIT_EXCEEDED' | 'TIMEOUT' | 'CANCELLED' | 'USER_CANCELLED' | 'RUNTIME_CLOSED' | 'INTERNAL_ERROR' | 'CONFIGURATION_NOT_DECLARED' | 'CONFIGURATION_KEY_NOT_FOUND' | 'CONFIG_INCOMPATIBLE'
export type BridgeError = { code: BridgeErrorCode; retryable: false }
export type ClientMessage = { type: 'hello'; protocolMajor: number } | { type: 'cancel'; protocolMajor: number; requestId: string } | { type: 'request'; protocolMajor: number; requestId: string; method: string; payload: JsonValue }
export type PluginLifecycleEvent = { phase: 'enter' | 'show' | 'hide'; featureId: string; generation: number; entryCount: number }
export type ScheduledTrigger = { code: string; executionId: string; scheduledAtMs: number }
export type HostMessage = { type: 'event'; protocolMajor: number; event: 'tasks.trigger'; payload: ScheduledTrigger } | { type: 'event'; protocolMajor: number; event: 'lifecycle.changed'; payload: PluginLifecycleEvent } | { type: 'runtime-closed'; protocolMajor: number } | { type: 'ready'; protocolMajor: number; accepted: true } | { type: 'ready'; protocolMajor: number; accepted: false; error: BridgeError } | { type: 'response'; protocolMajor: number; requestId: string; ok: true; result: JsonValue } | { type: 'response'; protocolMajor: number; requestId: string; ok: false; error: BridgeError } | { type: 'event'; protocolMajor: number; event: 'context.changed'; payload: null } | { type: 'event'; protocolMajor: number; event: 'subInput.change'; payload: { value: string; revision: number } } | { type: 'event'; protocolMajor: number; event: 'search.result-selected'; payload: { id: string; query: string; revision: number; item: { id: string; title: string; description: string; icon: string } } } | { type: 'event'; protocolMajor: number; event: 'window.message'; payload: { from: string; data: JsonValue } } | { type: 'event'; protocolMajor: number; event: 'window.closed'; payload: { id: string } }
export const BRIDGE_MAJOR: 1
export const ENVELOPE_BYTES: 16777216
export const ERROR_CODES: readonly BridgeErrorCode[]
export class BridgeWireError extends Error { code: BridgeErrorCode; constructor(code?: BridgeErrorCode) }
export function measureUtf8(text: string, bound?: number): number
export function validRequestId(id: unknown): id is string
export function validateRequestInput(method: unknown, payload: unknown): void
export function decodeRaw(raw: unknown): unknown
export function encodeMessage(message: ClientMessage | HostMessage, direction: 'client' | 'host'): string
export function validateParsed(raw: string, message: unknown, direction: 'client'): ClientMessage
export function validateParsed(raw: string, message: unknown, direction: 'host'): HostMessage
export function parseMessage(raw: unknown, direction: 'client'): ClientMessage
export function parseMessage(raw: unknown, direction: 'host'): HostMessage
