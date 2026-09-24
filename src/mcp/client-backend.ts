import { UpiAgent, UpiAgentApiError } from "../client.js";
import { ToolError } from "./server.js";
import type { UpiAgentBackend } from "./tools.js";

/**
 * Backend for the local (stdio) MCP server: every tool call goes to the
 * hosted REST API through the SDK client, so a local server behaves exactly
 * like the hosted one and never holds merchant credentials beyond the API key.
 */
export function createClientBackend(client: UpiAgent, baseUrl: string): UpiAgentBackend {
  async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      // API error messages are written for callers; pass them through.
      if (err instanceof UpiAgentApiError) {
        throw new ToolError(err.status >= 500 ? `upiagent API error (${err.status}): ${err.message}` : err.message);
      }
      if (err instanceof TypeError) {
        throw new ToolError(`Could not reach the upiagent API at ${baseUrl}. Check the network and UPIAGENT_BASE_URL.`);
      }
      throw err;
    }
  }

  return {
    createPayment: (req) => call(() => client.createPayment(req)),
    submitProof: (id, proof) => call(() => client.submitProof(id, proof)),
    getPayment: (id) => call(() => client.getStatus(id)),
    getEvidence: (id) => call(() => client.getEvidence(id)),
    listPayments: (opts) => call(() => client.listPayments(opts)),
    cancelPayment: (id) => call(() => client.cancel(id)),
    getUsage: () => call(() => client.getUsage()),
  };
}
