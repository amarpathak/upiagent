# upiagent MCP server

Let any MCP-capable agent take UPI payments: create a payment request, check a
customer's payment screenshot, and wait for bank confirmation.

**Hosted:** `https://beta.upiagent.live/api/mcp` (Streamable HTTP, stateless JSON)  
**Local:** `npx -y upiagent mcp` (stdio)  
**Auth:** your upiagent API key — `Authorization: Bearer upi_ak_…`

## Connect

### Hosted (HTTP)

Claude Code:

```bash
claude mcp add --transport http upiagent https://beta.upiagent.live/api/mcp \
  --header "Authorization: Bearer $UPIAGENT_API_KEY"
```

Any client that takes a JSON config:

```json
{
  "mcpServers": {
    "upiagent": {
      "type": "http",
      "url": "https://beta.upiagent.live/api/mcp",
      "headers": { "Authorization": "Bearer upi_ak_..." }
    }
  }
}
```

### Local (stdio)

For clients that launch MCP servers as a local process (Claude Desktop,
Cursor, …). The local server forwards every call to the hosted API, so it
behaves identically; only your API key is needed.

```json
{
  "mcpServers": {
    "upiagent": {
      "command": "npx",
      "args": ["-y", "upiagent", "mcp"],
      "env": { "UPIAGENT_API_KEY": "upi_ak_..." }
    }
  }
}
```

Claude Code: `claude mcp add upiagent --env UPIAGENT_API_KEY=upi_ak_... -- npx -y upiagent mcp`

The key is read from the environment (never a CLI flag, so it stays out of
the process list). `UPIAGENT_BASE_URL` overrides the API host.

## Tools

| Tool | What it does | LLM tokens |
|---|---|---|
| `upiagent_create_payment` | Create a payment request; returns the `upi://` intent URL and exact amount | 0 |
| `upiagent_submit_payment_proof` | Check a payment screenshot → `claimed` (or straight to `verified` when the bank alert with its UTR is already in) or rejected with reasons | 1 vision call |
| `upiagent_get_payment_status` | Status + evidence trail (gmail / notification / screenshot) | 0 |
| `upiagent_list_payments` | Paginated list, filter by status / time | 0 |
| `upiagent_cancel_payment` | Cancel a pending payment | 0 |
| `upiagent_get_usage` | Today's token use vs the daily limit | 0 |

There is deliberately no blocking `wait_for_payment`: evidence reaches the
server by push, and `get_payment_status` is a pure database read — check it
when the customer says they've paid, not in a tight loop.

## When can the agent release the goods?

```
pending ──screenshot──> claimed ──bank evidence──> verified
```

- **claimed** — the screenshot passed every check: success status, exact
  amount, paid *to this merchant*, paid after the request was created, UTR
  never used before, image never submitted before. Fine for low-value goods.
- **verified** — corroborated by the merchant's bank. For a screenshot, a
  bank alert in the merchant's inbox (known bank sender, DKIM/DMARC pass,
  received after the request) must contain the screenshot's exact UTR and
  amount; the proof tool checks right away, and the alert's Gmail push
  upgrades it later if it hadn't arrived yet. Fine for anything.
- A proof with `accepted: false` means **do not deliver**.

A well-forged image can pass the screenshot checks, which is why `verified`
exists — a forged screenshot can't produce the bank's email. Choose the
release bar per order value. The original screenshot is kept as evidence;
`upiagent_get_payment_status` returns a short-lived link to it.
