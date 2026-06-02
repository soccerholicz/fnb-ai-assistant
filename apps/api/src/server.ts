import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { Agent } from '@jav/agent';
import { healthRoutes } from './routes/health';
import { chatRoutes } from './routes/chat';

export interface BuildServerOptions {
  /** Allowed CORS origins. Empty/undefined reflects the request origin (dev-friendly). */
  corsOrigins?: string[];
  /** Enable request logging. Disabled by default in tests for quiet output. */
  logger?: boolean;
  /**
   * Inject an agent for `/chat`. When omitted, one is lazily built from
   * environment config on first request (see `routes/chat.ts`).
   */
  agent?: Agent;
}

/**
 * Build a fully-wired Fastify instance without binding a port. This factory is
 * what tests exercise via `app.inject(...)`, and what `index.ts` boots in prod.
 */
export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.register(cors, {
    origin: options.corsOrigins && options.corsOrigins.length > 0 ? options.corsOrigins : true,
  });

  app.register(healthRoutes);
  app.register(chatRoutes, { agent: options.agent });

  app.get('/', async () => ({
    name: 'fnb-ai-assistant API',
    message: 'Hello from the F&B & Retail AI assistant API 👋',
    health: '/health',
    chat: 'POST /chat',
  }));

  return app;
}
