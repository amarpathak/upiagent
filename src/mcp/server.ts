/**
 * Minimal, transport-agnostic MCP server core.
 *
 * Implements the stateless subset of the Model Context Protocol a tools-only
 * server needs — `initialize`, `ping`, `tools/list`, `tools/call`, and
 * notifications — over JSON-RPC 2.0. Transports (the hosted Streamable HTTP
 * route, a future stdio binary) only move messages in and out of `handle`.
 *
 * Tools are declared with Zod: the input schema is published to clients as
 * JSON Schema and enforced on every call; the output schema types the
 * handler's return value and is published as `outputSchema`, with the result
 * returned as `structuredContent` (plus a JSON text block for older clients).
 */
import { z } from "zod/v4";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface McpTool<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType, Ctx = unknown> {
  name: string;
  title: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  annotations: ToolAnnotations;
  handler: (input: z.output<I>, ctx: Ctx) => Promise<z.input<O>>;
}

/** Declares a tool with input/output types inferred from its schemas. */
export function defineTool<I extends z.ZodType, O extends z.ZodType, Ctx>(tool: McpTool<I, O, Ctx>): McpTool<I, O, Ctx> {
  return tool;
}

/**
 * Throw from a tool handler to return an agent-readable error result
 * (`isError: true`) instead of a protocol error.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

type JsonRpcId = string | number;
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const jsonRpcMessageSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const JSON_RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export interface McpServerOptions<Ctx> {
  name: string;
  version: string;
  title?: string;
  /** Shown to the model by clients that surface server instructions. */
  instructions?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: McpTool<any, any, Ctx>[];
  /** Called for unexpected handler exceptions (not ToolError). */
  onError?: (error: unknown, toolName: string) => void;
}

function toJsonSchema(schema: z.ZodType, io: "input" | "output"): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io, unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export function createMcpServer<Ctx>(options: McpServerOptions<Ctx>) {
  const byName = new Map(options.tools.map((t) => [t.name, t]));
  const toolList = options.tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: toJsonSchema(t.inputSchema, "input"),
    outputSchema: toJsonSchema(t.outputSchema, "output"),
    annotations: { title: t.title, ...t.annotations },
  }));

  const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
  const fail = (id: JsonRpcId | null, code: number, message: string): JsonRpcResponse => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });

  async function callTool(id: JsonRpcId, params: Record<string, unknown>, ctx: Ctx): Promise<JsonRpcResponse> {
    const name = typeof params.name === "string" ? params.name : "";
    const tool = byName.get(name);
    if (!tool) return fail(id, JSON_RPC.INVALID_PARAMS, `Unknown tool: ${name || "(missing name)"}`);

    const errorResult = (text: string) => ok(id, { content: [{ type: "text", text }], isError: true });

    const input = tool.inputSchema.safeParse(params.arguments ?? {});
    if (!input.success) {
      const issue = input.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      return errorResult(`Invalid arguments — ${where}${issue?.message ?? "invalid input"}`);
    }

    try {
      const output = tool.outputSchema.parse(await tool.handler(input.data, ctx));
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      });
    } catch (err) {
      if (err instanceof ToolError) return errorResult(err.message);
      options.onError?.(err, tool.name);
      return errorResult("Internal error while running the tool. Retry shortly.");
    }
  }

  /**
   * Handles one JSON-RPC message. Returns the response, or null for
   * notifications and client responses (which get no reply).
   */
  async function handle(message: unknown, ctx: Ctx): Promise<JsonRpcResponse | null> {
    const parsed = jsonRpcMessageSchema.safeParse(message);
    if (!parsed.success) return fail(null, JSON_RPC.INVALID_REQUEST, "Invalid JSON-RPC 2.0 message");
    const { id, method, params = {} } = parsed.data;

    if (method === undefined) return null; // a response to a server request; we send none
    if (id === undefined) return null; // notification (e.g. notifications/initialized)

    switch (method) {
      case "initialize": {
        const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
        const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
        return ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: options.name, version: options.version, ...(options.title && { title: options.title }) },
          ...(options.instructions && { instructions: options.instructions }),
        });
      }
      case "ping":
        return ok(id, {});
      case "tools/list":
        return ok(id, { tools: toolList });
      case "tools/call":
        return callTool(id, params, ctx);
      default:
        return fail(id, JSON_RPC.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  return { handle, tools: toolList };
}
