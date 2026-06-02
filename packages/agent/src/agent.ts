import type { LLMProvider } from './llm';
import type { ConversationStore } from './store';
import { ToolRegistry } from './tools';
import {
  isTextBlock,
  isToolUseBlock,
  type ConversationMessage,
  type ConversationState,
  type ToolResultBlock,
} from './types';

/** Default persona for the F&B / Retail customer-facing assistant. */
export const DEFAULT_SYSTEM_PROMPT = `You are the friendly virtual assistant for a food, beverage, or retail business.
You help customers with questions about hours, location, menu, products, and bookings.
Use the provided tools to look up factual business details rather than guessing — if a tool
can answer the question, call it. If you don't have the information, say so plainly and offer
to take a message. Keep replies short, warm, and to the point.`;

const DEFAULT_MAX_STEPS = 8;

export interface AgentOptions {
  provider: LLMProvider;
  store: ConversationStore;
  /** Tools the agent may call. Defaults to an empty registry. */
  tools?: ToolRegistry;
  /** System prompt / persona. Defaults to {@link DEFAULT_SYSTEM_PROMPT}. */
  systemPrompt?: string;
  /** Safety bound on tool-calling round-trips per turn. */
  maxSteps?: number;
  /** Injectable clock (ISO string) for deterministic tests. */
  now?: () => string;
}

export interface AgentTurnResult {
  conversationId: string;
  /** The assistant's final natural-language reply for this turn. */
  reply: string;
  /** The full, persisted conversation state after the turn. */
  state: ConversationState;
  /** Number of model round-trips taken (≥ 1). */
  steps: number;
  /** True if the loop hit {@link AgentOptions.maxSteps} while still calling tools. */
  stoppedOnMaxSteps: boolean;
}

/**
 * The core agent loop. Each `sendMessage` call:
 *  1. loads (or starts) the conversation,
 *  2. appends the user's message,
 *  3. asks the model, runs any tools it requests, feeds results back, and
 *     repeats until the model answers without calling a tool, and
 *  4. persists state after every step so progress is never lost.
 */
export class Agent {
  private readonly provider: LLMProvider;
  private readonly store: ConversationStore;
  private readonly tools: ToolRegistry;
  private readonly systemPrompt: string;
  private readonly maxSteps: number;
  private readonly now: () => string;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.store = options.store;
    this.tools = options.tools ?? new ToolRegistry();
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async sendMessage(conversationId: string, userText: string): Promise<AgentTurnResult> {
    const state = (await this.store.load(conversationId)) ?? this.newConversation(conversationId);

    state.messages.push({ role: 'user', content: [{ type: 'text', text: userText }] });

    let steps = 0;
    let stoppedOnMaxSteps = false;

    while (true) {
      if (steps >= this.maxSteps) {
        stoppedOnMaxSteps = true;
        break;
      }
      steps += 1;

      const response = await this.provider.generate({
        system: this.systemPrompt,
        tools: this.tools.schemas(),
        messages: state.messages,
      });

      state.messages.push(response.message);
      await this.persist(state);

      const toolUses = response.message.content.filter(isToolUseBlock);
      if (toolUses.length === 0) break;

      const results: ToolResultBlock[] = [];
      for (const call of toolUses) {
        const { content, isError } = await this.tools.run(call.name, call.input, {
          conversationId,
        });
        results.push({ type: 'tool_result', toolUseId: call.id, content, isError });
      }

      state.messages.push({ role: 'user', content: results });
      await this.persist(state);
    }

    return {
      conversationId,
      reply: replyText(state),
      state,
      steps,
      stoppedOnMaxSteps,
    };
  }

  private newConversation(id: string): ConversationState {
    const ts = this.now();
    return { id, messages: [], createdAt: ts, updatedAt: ts };
  }

  private async persist(state: ConversationState): Promise<void> {
    state.updatedAt = this.now();
    await this.store.save(state);
  }
}

/** Concatenate the text blocks of the most recent assistant message. */
function replyText(state: ConversationState): string {
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const message: ConversationMessage | undefined = state.messages[i];
    if (message && message.role === 'assistant') {
      return message.content
        .filter(isTextBlock)
        .map((block) => block.text)
        .join('')
        .trim();
    }
  }
  return '';
}
