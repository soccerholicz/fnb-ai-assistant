import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileConversationStore, type ConversationState } from '../src/index';

const SAMPLE: ConversationState = {
  id: 'conv-file-1',
  createdAt: '2026-06-02T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:01.000Z',
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'Are you open Sunday?' }] },
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'c1', name: 'get_business_hours', input: { day: 'sunday' } },
      ],
    },
    {
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 'c1', content: 'Closed', isError: false }],
    },
    { role: 'assistant', content: [{ type: 'text', text: "We're closed on Sundays." }] },
  ],
};

describe('FileConversationStore', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
    dirs.length = 0;
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'jav-agent-store-'));
    dirs.push(dir);
    return dir;
  }

  it('returns null for an unknown conversation', async () => {
    const store = new FileConversationStore(await tempDir());
    expect(await store.load('does-not-exist')).toBeNull();
  });

  it('persists state durably and reloads it losslessly from a fresh store', async () => {
    const dir = await tempDir();

    await new FileConversationStore(dir).save(SAMPLE);

    // A separate store instance (stand-in for a process restart) reads it back.
    const reloaded = await new FileConversationStore(dir).load(SAMPLE.id);

    expect(reloaded).toEqual(SAMPLE);
  });
});
