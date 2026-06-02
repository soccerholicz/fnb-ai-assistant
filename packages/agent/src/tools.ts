/**
 * Tool definitions and a registry the agent loop uses to expose tools to the
 * model and execute the calls it makes.
 */

/** JSON Schema describing a tool's input (an object schema). */
export type JsonSchema = Record<string, unknown>;

/** The tool shape sent to the LLM — name, description, and input schema. */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

/**
 * Context passed to every tool handler. Deliberately small for Phase 0; this is
 * the seam where future work (JAV-6 knowledge base, JAV-8 reservations) injects
 * the business id, DB handles, and request metadata.
 */
export interface ToolContext {
  conversationId: string;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<string> | string;

export interface ToolDefinition extends ToolSchema {
  handler: ToolHandler;
}

export interface ToolRunResult {
  content: string;
  isError: boolean;
}

/** Holds the tools available to an agent and runs them by name. */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(tools: ToolDefinition[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: ToolDefinition): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** The schemas to advertise to the model. */
  schemas(): ToolSchema[] {
    return [...this.tools.values()].map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  /**
   * Execute a tool by name. Unknown tools and handler exceptions are returned as
   * error results (never thrown) so the agent loop can hand them back to the
   * model, which can then recover or apologise gracefully.
   */
  async run(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolRunResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: `Unknown tool: "${name}".`, isError: true };
    }
    try {
      const content = await tool.handler(input, ctx);
      return { content, isError: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: `Tool "${name}" failed: ${message}`, isError: true };
    }
  }
}
