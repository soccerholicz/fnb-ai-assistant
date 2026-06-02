import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Agent } from '@jav/agent';
import { buildAgentFromEnv } from '../agent';

export interface ChatRoutesOptions {
  /**
   * Inject an agent (used by tests, or to share one instance). When omitted, an
   * agent is lazily built from environment config on first use — so the server
   * still boots, and `/health` still answers, without an ANTHROPIC_API_KEY.
   */
  agent?: Agent;
}

interface ChatBody {
  conversationId?: string;
  message?: string;
}

/**
 * `POST /chat` — send a customer message to the agent and get its reply.
 *
 * Request:  `{ "message": "What time do you open?", "conversationId"?: "..." }`
 * Response: `{ "conversationId": "...", "reply": "...", "steps": 2 }`
 *
 * Omit `conversationId` to start a new conversation; pass it back on subsequent
 * turns to continue the same one (state is persisted by the agent's store).
 */
export async function chatRoutes(
  app: FastifyInstance,
  options: ChatRoutesOptions = {},
): Promise<void> {
  let agent: Agent | null = options.agent ?? null;

  app.post<{ Body: ChatBody }>('/chat', async (request, reply) => {
    const body = request.body ?? {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length === 0) {
      return reply.code(400).send({ error: 'Request body must include a non-empty "message".' });
    }

    if (!agent) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply
          .code(503)
          .send({ error: 'Chat is not configured. Set ANTHROPIC_API_KEY to enable the agent.' });
      }
      agent = buildAgentFromEnv();
    }

    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId.length > 0
        ? body.conversationId
        : randomUUID();

    try {
      const result = await agent.sendMessage(conversationId, message);
      return reply.send({
        conversationId: result.conversationId,
        reply: result.reply,
        steps: result.steps,
      });
    } catch (err) {
      request.log.error(err, 'agent.sendMessage failed');
      return reply.code(502).send({ error: 'The assistant failed to respond. Please try again.' });
    }
  });
}
