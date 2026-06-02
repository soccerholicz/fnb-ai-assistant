import type { ConversationMessage } from './types';
import type { ToolSchema } from './tools';

/**
 * The LLM provider boundary. The agent loop only ever talks to this interface,
 * so swapping Anthropic for another vendor (or a fake, in tests) is a one-file
 * change. See `anthropic.ts` for the production implementation.
 */

export type StopReason =
  | 'end_turn'
  | 'tool_use'
  | 'max_tokens'
  | 'stop_sequence'
  | 'refusal'
  | 'other';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export interface LLMRequest {
  /** System prompt / persona. */
  system: string;
  /** Tools the model may call this turn. */
  tools: ToolSchema[];
  /** Full conversation history so far. */
  messages: ConversationMessage[];
}

export interface LLMResponse {
  /** The assistant message (text and/or tool_use blocks). */
  message: ConversationMessage;
  stopReason: StopReason;
  usage?: TokenUsage;
}

export interface LLMProvider {
  /** Identifier of the underlying model, for logging and diagnostics. */
  readonly model: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
}
