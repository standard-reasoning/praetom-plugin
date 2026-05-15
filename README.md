# @standard-reasoning/praetom-plugin

MCP plugin for [praetom](https://praetom.com) — production intelligence for AI-generated code. Lets your coding agent (Claude Code, Claude.ai, Claude desktop, ChatGPT, Cursor) consult your praetom workspace without manual tool-calling.

→ [praetom.com](https://praetom.com) for the dashboard, docs, and account.

---

## Install

### In Claude Code

```bash
/plugin install github:standard-reasoning/praetom-plugin
```

The first time the plugin talks to praetom you'll be prompted to authorize (OAuth — opens a browser, sign in to praetom.com, click "Allow"). The bearer token is stored by Claude Code and reused after that.

### As a ChatGPT Connector

In ChatGPT settings → Connectors → Add custom connector, paste:

```
https://praetom.com/.well-known/mcp-manifest.json
```

ChatGPT walks you through the same OAuth flow.

### As a Cursor / Claude desktop MCP server (manual)

If you'd rather configure the MCP server manually (no plugin skill, just the tools), paste this into your client's config:

```json
{
  "mcpServers": {
    "praetom": {
      "url": "https://praetom.com/mcp"
    }
  }
}
```

For Cursor: `~/.cursor/mcp.json`. For Claude desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`. Restart the client. On first tool call you'll get the OAuth prompt in your browser.

---

## What it does

Once installed, your agent answers questions like:

- **What feature contracts exist in this codebase?**
- **Is `tenant-submits-application` healthy? Is it being used?**
- **Which contracts does this PR touch?**
- **Who owns `PaymentService.cs`?**

The agent invokes praetom automatically when your question shapes up that way.

## Available tools (via MCP)

- `list_features` — every active feature contract in your workspace.
- `feature_health(feature)` — full card for one contract: event sentence, instrumentation coverage, recent commits, critic verdict.
- `check_change(files, description?)` — given changed file paths, return which contracts the change touches.
- `who_owns_this(path)` — resolve a file path to the contract(s) it participates in.
- `match_intent(intent)` — fuzzy-match plain English to a contract slug.

## What's inside

- `skills/praetom/SKILL.md` — the invocation convention. Tells the agent when to reach for praetom's MCP tools without you having to ask explicitly.
- `.claude-plugin/plugin.json` — declares the praetom MCP server at `https://praetom.com/mcp` so the plugin is self-contained: install → ready.

## Get a praetom workspace

You'll need one before this plugin does anything useful: [praetom.com](https://praetom.com) → sign in with email → connect your GitHub repo → praetom proposes feature contracts from your code → save the ones that ring true → install this plugin.

## License

MIT. The skill and plugin manifest are free to copy / fork.
