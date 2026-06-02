import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConversationState } from './types';

/**
 * Persistence boundary for conversation state. The agent loads a conversation,
 * appends to it, and saves it back. Implementations must round-trip state
 * losslessly so a conversation can be reloaded and resumed later.
 *
 * The production target is managed Postgres (Neon + Drizzle), wired in alongside
 * the database work in JAV-6. The two implementations here cover the Phase 0
 * needs: `InMemoryConversationStore` for tests/dev, `FileConversationStore` for
 * durable local persistence — both satisfy the same contract a Postgres store
 * will.
 */
export interface ConversationStore {
  load(id: string): Promise<ConversationState | null>;
  save(state: ConversationState): Promise<void>;
}

/**
 * In-process store. Serialises on write so callers can't mutate stored state
 * through a retained reference — it behaves like a real store, just without
 * durability.
 */
export class InMemoryConversationStore implements ConversationStore {
  private readonly data = new Map<string, string>();

  async load(id: string): Promise<ConversationState | null> {
    const raw = this.data.get(id);
    return raw ? (JSON.parse(raw) as ConversationState) : null;
  }

  async save(state: ConversationState): Promise<void> {
    this.data.set(state.id, JSON.stringify(state));
  }
}

/**
 * Durable JSON-file store: one file per conversation under `dir`. Survives
 * process restarts, which is what makes conversation state genuinely
 * "persisted and reloadable" without standing up a database in CI.
 */
export class FileConversationStore implements ConversationStore {
  constructor(private readonly dir: string) {}

  private pathFor(id: string): string {
    return join(this.dir, `${encodeURIComponent(id)}.json`);
  }

  async load(id: string): Promise<ConversationState | null> {
    try {
      const raw = await readFile(this.pathFor(id), 'utf8');
      return JSON.parse(raw) as ConversationState;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async save(state: ConversationState): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(state.id), JSON.stringify(state, null, 2), 'utf8');
  }
}
