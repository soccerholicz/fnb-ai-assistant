/**
 * @jav/agent — the agent core for the F&B + Retail AI assistant.
 *
 * Public surface:
 *  - {@link Agent}: the LLM + tool-calling loop with persisted conversation state.
 *  - {@link LLMProvider} / {@link AnthropicProvider}: the swappable model boundary.
 *  - {@link ConversationStore} and implementations: persistence.
 *  - {@link ToolRegistry} / {@link createBusinessInfoTools}: tools.
 */

export { Agent, DEFAULT_SYSTEM_PROMPT } from './agent';
export type { AgentOptions, AgentTurnResult } from './agent';

export { AnthropicProvider, DEFAULT_MODEL } from './anthropic';
export type { AnthropicProviderOptions } from './anthropic';

export type { LLMProvider, LLMRequest, LLMResponse, StopReason, TokenUsage } from './llm';

export { InMemoryConversationStore, FileConversationStore } from './store';
export type { ConversationStore } from './store';

export { ToolRegistry } from './tools';
export type {
  JsonSchema,
  ToolContext,
  ToolDefinition,
  ToolHandler,
  ToolRunResult,
  ToolSchema,
} from './tools';

export { createBusinessInfoTools } from './businessTools';
export type { BusinessProfile, MenuItem } from './businessTools';

export { isTextBlock, isToolUseBlock } from './types';
export type {
  ContentBlock,
  ConversationMessage,
  ConversationState,
  Role,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from './types';

import { Agent, DEFAULT_SYSTEM_PROMPT } from './agent';
import { AnthropicProvider, type AnthropicProviderOptions } from './anthropic';
import { InMemoryConversationStore, type ConversationStore } from './store';
import { ToolRegistry, type ToolDefinition } from './tools';

export interface CreateAnthropicAgentOptions {
  store?: ConversationStore;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  maxSteps?: number;
  anthropic?: AnthropicProviderOptions;
}

/**
 * Convenience wiring: an {@link Agent} backed by Anthropic with the given tools
 * and store. Defaults to an in-memory store — pass a {@link FileConversationStore}
 * (or a future Postgres store) for durability.
 */
export function createAnthropicAgent(options: CreateAnthropicAgentOptions = {}): Agent {
  return new Agent({
    provider: new AnthropicProvider(options.anthropic),
    store: options.store ?? new InMemoryConversationStore(),
    tools: new ToolRegistry(options.tools ?? []),
    systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    maxSteps: options.maxSteps,
  });
}
