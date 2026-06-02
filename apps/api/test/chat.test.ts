import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  Agent,
  InMemoryConversationStore,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
} from '@jav/agent';
import { buildServer } from '../src/server';

/** Deterministic provider so the route test needs no network or API key. */
class StubProvider implements LLMProvider {
  readonly model = 'stub';
  async generate(_request: LLMRequest): Promise<LLMResponse> {
    void _request;
    return {
      stopReason: 'end_turn',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
    };
  }
}

describe('POST /chat', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const agent = new Agent({
      provider: new StubProvider(),
      store: new InMemoryConversationStore(),
    });
    app = buildServer({ agent });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('replies to a message and returns a conversation id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: { message: 'hello' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ reply: 'Hi there!', steps: 1 });
    expect(typeof body.conversationId).toBe('string');
    expect(body.conversationId.length).toBeGreaterThan(0);
  });

  it('rejects an empty message with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/chat', payload: { message: '  ' } });
    expect(res.statusCode).toBe(400);
  });
});
