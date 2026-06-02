import type { FastifyInstance } from 'fastify';

/**
 * Liveness/readiness endpoint. Kept dependency-free so it can answer even when
 * downstream services (DB, LLM) are degraded. Phase 0.2 (CI/CD) and future
 * deploy targets use this for health checks.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    uptimeSeconds: Math.round(process.uptime()),
  }));
}
