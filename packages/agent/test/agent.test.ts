import { describe, it, expect } from 'vitest';
import {
  Agent,
  InMemoryConversationStore,
  ToolRegistry,
  createBusinessInfoTools,
  isToolUseBlock,
  type BusinessProfile,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
} from '../src/index';

const PROFILE: BusinessProfile = {
  name: 'Blue Spoon Café',
  hours: { monday: '8:00 AM – 4:00 PM', tuesday: '8:00 AM – 4:00 PM' },
  address: '12 Market Street',
  menu: [{ name: 'Flat White', price: 4.5, allergens: ['milk'] }],
};

/**
 * A deterministic, scripted LLM provider — no network. It returns a fixed
 * sequence of responses and records the requests it received, so the test can
 * assert what the agent actually sent back to the model (e.g. tool results).
 */
class ScriptedProvider implements LLMProvider {
  readonly model = 'scripted-test-model';
  readonly requests: LLMRequest[] = [];
  private index = 0;

  constructor(private readonly script: LLMResponse[]) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.requests.push(structuredClone(request));
    const response = this.script[this.index];
    this.index += 1;
    if (!response) throw new Error('ScriptedProvider: ran out of scripted responses');
    return response;
  }
}

const fixedClock = () => '2026-06-02T00:00:00.000Z';

describe('Agent loop with tool calling', () => {
  it('round-trips a conversation through a working tool call', async () => {
    const provider = new ScriptedProvider([
      // Turn 1: the model decides to call the hours tool.
      {
        stopReason: 'tool_use',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check.' },
            {
              type: 'tool_use',
              id: 'call-1',
              name: 'get_business_hours',
              input: { day: 'monday' },
            },
          ],
        },
      },
      // Turn 2: with the tool result in context, the model answers.
      {
        stopReason: 'end_turn',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: "We're open 8:00 AM – 4:00 PM on Monday." }],
        },
      },
    ]);

    const store = new InMemoryConversationStore();
    const agent = new Agent({
      provider,
      store,
      tools: new ToolRegistry(createBusinessInfoTools(PROFILE)),
      now: fixedClock,
    });

    const result = await agent.sendMessage('conv-1', 'What time do you open on Monday?');

    // Two model round-trips: tool call, then final answer.
    expect(result.steps).toBe(2);
    expect(result.stoppedOnMaxSteps).toBe(false);
    expect(result.reply).toBe("We're open 8:00 AM – 4:00 PM on Monday.");

    // The tool actually ran and its real output was recorded in conversation state.
    const toolResult = result.state.messages
      .flatMap((m) => m.content)
      .find((b) => b.type === 'tool_result');
    expect(toolResult).toBeDefined();
    expect(toolResult).toMatchObject({ toolUseId: 'call-1', isError: false });
    expect((toolResult as { content: string }).content).toContain('8:00 AM – 4:00 PM');

    // The second model call received the tool result back — proving the round-trip.
    const secondRequest = provider.requests[1]!;
    const sentToolResult = secondRequest.messages
      .flatMap((m) => m.content)
      .find((b) => b.type === 'tool_result');
    expect(sentToolResult).toBeDefined();
    expect((sentToolResult as { content: string }).content).toContain('8:00 AM – 4:00 PM');

    // The assistant's tool_use is preserved in the final, persisted transcript.
    const persisted = await store.load('conv-1');
    expect(persisted).not.toBeNull();
    expect(persisted!.messages.flatMap((m) => m.content).some(isToolUseBlock)).toBe(true);
  });

  it('reloads persisted state so a later turn sees prior history', async () => {
    const store = new InMemoryConversationStore();

    const first = new ScriptedProvider([
      {
        stopReason: 'end_turn',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hello! How can I help?' }] },
      },
    ]);
    await new Agent({ provider: first, store, now: fixedClock }).sendMessage('conv-2', 'Hi');

    // A brand-new Agent instance (fresh provider, same store) continues the chat.
    const second = new ScriptedProvider([
      {
        stopReason: 'end_turn',
        message: { role: 'assistant', content: [{ type: 'text', text: 'You said "Hi".' }] },
      },
    ]);
    const result = await new Agent({ provider: second, store, now: fixedClock }).sendMessage(
      'conv-2',
      'What did I just say?',
    );

    // The reloaded history (user "Hi" + assistant greeting) was sent to the model.
    const history = second.requests[0]!.messages;
    expect(history.length).toBe(3); // prior user, prior assistant, new user
    expect(history[0]).toMatchObject({ role: 'user' });
    expect(history[1]).toMatchObject({ role: 'assistant' });
    expect(result.state.createdAt).toBe(fixedClock());
  });
});
