# @jav/agent

The **agent core** for the F&B + Retail AI assistant: LLM integration, tool /
function calling, and persisted conversation state. This is the minimal agent
loop the rest of the product is built on ([JAV-5](/JAV/issues/JAV-5)).

## What's here

| Piece                     | Responsibility                                                              |
| ------------------------- | --------------------------------------------------------------------------- |
| `Agent`                   | The loop: load state → ask model → run tools → feed results back → persist. |
| `LLMProvider`             | The swappable model boundary. The loop only talks to this interface.        |
| `AnthropicProvider`       | The one module that touches the Anthropic SDK (Claude, tool calling).       |
| `ConversationStore`       | Persistence boundary — `InMemory` and durable `File` implementations.       |
| `ToolRegistry` / tools    | Declare tools to the model and execute the calls it makes.                  |
| `createBusinessInfoTools` | A demoable F&B tool set (hours, location, menu) over a business profile.    |

Conversation state is stored as **plain, provider-agnostic JSON** (see
`types.ts`) so it stays portable and the LLM vendor stays swappable — nothing
outside `anthropic.ts` depends on the SDK.

## How the loop works

`agent.sendMessage(conversationId, userText)`:

1. Loads the conversation (or starts a new one) from the `ConversationStore`.
2. Appends the user's message.
3. Asks the model. If it returns `tool_use` blocks, runs those tools, appends the
   results as a `tool_result` turn, and asks again — repeating until the model
   answers with no tool call (bounded by `maxSteps`).
4. Persists state after **every** step, then returns the final reply + state.

## Usage

```ts
import { createAnthropicAgent, createBusinessInfoTools, FileConversationStore } from '@jav/agent';

const agent = createAnthropicAgent({
  store: new FileConversationStore('.data/conversations'),
  tools: createBusinessInfoTools({
    name: 'Blue Spoon Café',
    hours: { monday: '8:00 AM – 4:00 PM', sunday: 'Closed' },
  }),
  // anthropic: { apiKey, model } — defaults to ANTHROPIC_API_KEY / ANTHROPIC_MODEL
});

const { reply, conversationId } = await agent.sendMessage(
  'conv-123',
  'What time do you open on Monday?',
);
```

Reuse the returned `conversationId` on later turns to continue the same
conversation — history is reloaded from the store.

### Swapping the model or faking it in tests

Implement `LLMProvider` and pass it to `new Agent({ provider, store, tools })`.
The test suite does exactly this with a scripted provider, so the full loop is
exercised with **no network and no API key**.

## Configuration

| Env var             | Purpose                              | Default               |
| ------------------- | ------------------------------------ | --------------------- |
| `ANTHROPIC_API_KEY` | Anthropic API key (read by the SDK). | — (required for live) |
| `ANTHROPIC_MODEL`   | Model id.                            | `claude-sonnet-4-6`   |

Sonnet 4.6 is the default: native tool calling, fast and cost-efficient for
high-volume customer chat. It's overridable per the project's swappable-provider
principle.

## Persistence

Two stores ship today, both satisfying the same `ConversationStore` contract:

- `InMemoryConversationStore` — tests and ephemeral dev.
- `FileConversationStore` — durable JSON, one file per conversation; survives
  restarts. This is what proves state is "persisted and reloadable" without a DB.

The **production target is managed Postgres** (Neon + Drizzle), wired in
alongside the database work in [JAV-6](/JAV/issues/JAV-6). It will be a drop-in
implementation of the same interface.

## Tests

```bash
pnpm --filter @jav/agent test
```

- `test/agent.test.ts` — the loop round-trips a conversation through a working
  tool call, and reloads persisted state so a later turn sees prior history.
- `test/store.test.ts` — `FileConversationStore` persists durably and reloads
  losslessly from a fresh instance.
