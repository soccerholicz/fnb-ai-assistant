import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequest, LLMResponse, StopReason } from './llm';
import type { ContentBlock, ConversationMessage } from './types';

/**
 * The one module that touches the Anthropic SDK. Everything else in the package
 * speaks the provider-agnostic types from `types.ts`; this file translates
 * between those and the Messages API wire format.
 */

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;

export interface AnthropicProviderOptions {
  /** Falls back to the ANTHROPIC_API_KEY env var (read by the SDK). */
  apiKey?: string;
  /** Falls back to ANTHROPIC_MODEL, then {@link DEFAULT_MODEL}. */
  model?: string;
  maxTokens?: number;
  /** Inject a pre-built client (e.g. a mock) for testing. */
  client?: Anthropic;
}

export class AnthropicProvider implements LLMProvider {
  readonly model: string;
  private readonly client: Anthropic;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      // A frozen system prompt + tool list forms a stable cache prefix — see
      // shared/prompt-caching.md. Cheap to keep warm across a conversation.
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
      })),
      messages: request.messages.map(toAnthropicMessage),
    });

    const content = response.content
      .map(fromAnthropicBlock)
      .filter((block): block is ContentBlock => block !== null);

    return {
      message: { role: 'assistant', content },
      stopReason: mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? undefined,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? undefined,
      },
    };
  }
}

function toAnthropicMessage(message: ConversationMessage): Anthropic.MessageParam {
  return {
    role: message.role,
    content: message.content.map(toAnthropicBlock),
  };
}

function toAnthropicBlock(block: ContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        is_error: block.isError,
      };
  }
}

/** Map a response block to our model; non-text/tool_use blocks (e.g. thinking) are dropped. */
function fromAnthropicBlock(block: Anthropic.ContentBlock): ContentBlock | null {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: (block.input ?? {}) as Record<string, unknown>,
      };
    default:
      return null;
  }
}

function mapStopReason(reason: Anthropic.Message['stop_reason']): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'max_tokens':
    case 'stop_sequence':
    case 'refusal':
      return reason;
    default:
      return 'other';
  }
}
