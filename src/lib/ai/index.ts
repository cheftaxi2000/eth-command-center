/**
 * AI layer – prepared, not yet connected to a model.
 *
 *   context.ts   buildAIContext()  – the app's state as structured data, rebuilt on every call
 *   actions.ts   ACTIONS           – the only sanctioned way to change anything, with validation
 *   provider.ts  AIProvider        – model-agnostic interface; the key lives on a server, never here
 *   mock.ts      mockProvider()    – rule-based stand-in so the chain is testable today
 *   service.ts   AIService         – ties the three together; see mockAI() for a one-line demo
 *
 * Nothing in here has its own storage. Reads go through lib/store.ts, writes go through the same
 * store actions the UI calls, so the assistant and the screens can never drift apart.
 */
export { buildAIContext, buildAIDynamicContext, buildAIPermanentContext, formatAIContext } from './context';
export type { AIContext, AIContextOptions, AIDynamicContext, AIPermanentContext, AINote, AIScheduleDay, AISubject, AITask } from './context';
export { ACTIONS, executeAction, runConfirmed, resolveSubject, toolSpecs, validateAction } from './actions';
export type { ActionCall, ActionDef, ActionResult, ParamDef, ParamType } from './actions';
export { configuredProxy, httpProvider } from './provider';
export type { AIMessage, AIProvider, AIReply, AIRequest, ProxyConfig } from './provider';
export { mockProvider, parseIntent } from './mock';
export { AIService, createAIService, mockAI } from './service';
export type { AITurn } from './service';
