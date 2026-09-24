/**
 * stdio transport for the MCP server: newline-delimited JSON-RPC on
 * stdin/stdout, as MCP clients (Claude Desktop, Claude Code, Cursor…) expect
 * when they launch a local server as a subprocess.
 *
 * stdout carries protocol messages only. Anything that would print to it —
 * including stray console.log calls in dependencies — is sent to stderr.
 */
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { JSON_RPC, type JsonRpcResponse } from "./server.js";

export interface StdioServerOptions<Ctx> {
  server: { handle(message: unknown, ctx: Ctx): Promise<JsonRpcResponse | null> };
  ctx: Ctx;
  input?: Readable;
  output?: Writable;
  /** Redirect console.log/info/debug to stderr. Default true. */
  protectStdout?: boolean;
}

/** Resolves when the input stream closes (the client disconnected). */
export async function runStdioServer<Ctx>(options: StdioServerOptions<Ctx>): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  if (options.protectStdout ?? true) {
    const toStderr = (...args: unknown[]) => process.stderr.write(`${args.map(String).join(" ")}\n`);
    console.log = toStderr;
    console.info = toStderr;
    console.debug = toStderr;
  }

  const send = (message: JsonRpcResponse) => {
    // JSON.stringify never emits raw newlines, so one message = one line.
    output.write(`${JSON.stringify(message)}\n`);
  };

  const pending = new Set<Promise<void>>();
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    const text = line.trim();
    if (!text) continue;

    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: JSON_RPC.PARSE_ERROR, message: "Parse error" } });
      continue;
    }

    // Requests run concurrently; JSON-RPC ids let the client pair responses.
    const task = options.server
      .handle(message, options.ctx)
      .then((response) => {
        if (response) send(response);
      })
      .catch((err) => {
        process.stderr.write(`[upiagent-mcp] unhandled error: ${err instanceof Error ? err.message : String(err)}\n`);
      })
      .finally(() => pending.delete(task));
    pending.add(task);
  }

  await Promise.all(pending);
}
