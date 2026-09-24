import { UpiAgent } from "../client.js";
import { createClientBackend } from "./client-backend.js";
import { createMcpServer } from "./server.js";
import { runStdioServer } from "./stdio.js";
import { UPIAGENT_MCP_INSTRUCTIONS, UPIAGENT_TOOLS, type UpiAgentBackend } from "./tools.js";

export const DEFAULT_API_BASE_URL = "https://beta.upiagent.live";

/**
 * Runs the upiagent MCP server over stdio against the hosted API.
 * Configuration comes from the environment so the API key never appears in
 * the process list: UPIAGENT_API_KEY (required), UPIAGENT_BASE_URL (optional).
 */
export async function startStdioMcp(version: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const apiKey = env.UPIAGENT_API_KEY?.trim();
  if (!apiKey) {
    process.stderr.write(
      "upiagent mcp: UPIAGENT_API_KEY is not set.\n" +
        "Create a key at https://upiagent.live/dashboard/api-keys and pass it in your MCP client's env config.\n",
    );
    process.exitCode = 1;
    return;
  }
  const baseUrl = (env.UPIAGENT_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

  const server = createMcpServer<UpiAgentBackend>({
    name: "upiagent",
    title: "upiagent — UPI payments for agents",
    version,
    instructions: UPIAGENT_MCP_INSTRUCTIONS,
    tools: UPIAGENT_TOOLS,
    onError: (err, tool) =>
      process.stderr.write(`[upiagent-mcp] ${tool} failed: ${err instanceof Error ? err.message : String(err)}\n`),
  });

  process.stderr.write(`[upiagent-mcp] v${version} ready (API: ${baseUrl})\n`);
  await runStdioServer({ server, ctx: createClientBackend(new UpiAgent({ apiKey, baseUrl }), baseUrl) });
}
