/**
 * Provider-agnostic conversation model.
 *
 * These shapes intentionally mirror the Anthropic Messages content blocks so the
 * Anthropic provider can translate with near-identity, but nothing outside
 * `anthropic.ts` depends on the SDK. This keeps the LLM vendor swappable (see
 * the stack rationale in the repo README) and keeps persisted conversation
 * state as plain, portable JSON.
 */

export type Role = 'user' | 'assistant';

/** Free-form assistant or user prose. */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** A model request to invoke a tool, with the arguments it chose. */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** The result of running a tool, fed back to the model on the next turn. */
export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ConversationMessage {
  role: Role;
  content: ContentBlock[];
}

/** The full, persistable state of a single conversation. */
export interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text';
}
