# Sprint Pilot 🚀

AI-powered sprint planning tool that syncs ClickUp tickets, analyzes them with GPT-4o, and maps them to your Next.js codebase. Deployed as a remote MCP server on Vercel for seamless Cursor IDE integration.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│  Consumer Project   │         │   Sprint Pilot       │
│     (Local)         │         │    (Vercel)          │
├─────────────────────┤         ├──────────────────────┤
│ • Codebase Scanner  │────────▶│ • MCP Server (HTTP)  │
│ • Webhook Receiver  │◀────────│ • ClickUp Integration│
│ • Cursor IDE        │         │ • GPT-4o Analysis    │
│ • .ai/sprint/*.md   │         │ • Web Dashboard      │
└─────────────────────┘         └──────────────────────┘
```

**Data Flow:**
1. **Scan** → Consumer project scans codebase locally
2. **Trigger** → Cursor IDE calls remote MCP server with codebase map
3. **Analyze** → Server fetches ClickUp tickets, analyzes with GPT-4o
4. **Deliver** → Server POSTs results to local webhook receiver
5. **Write** → Webhook receiver writes `.ai/sprint/YYYY-MM-DD-sprint.md`

## Features

- 🎯 **ClickUp Integration** - Fetches tasks from any ClickUp list
- 🤖 **AI Analysis** - GPT-4o evaluates ticket quality (1-5 score)
- 🗺️ **Codebase Mapping** - Maps tickets to affected Next.js files
- 📊 **Priority Sorting** - Orders by urgency, quality, and complexity
- 🔌 **Remote MCP Server** - Connect from any project via Cursor IDE
- 🪝 **Webhook Delivery** - Async processing with local file writing
- 📈 **Web Dashboard** - Monitor sync jobs and statistics

## Quick Start

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/sprint-pilot)

Or manually:

```bash
# Clone and deploy
git clone https://github.com/yourusername/sprint-pilot.git
cd sprint-pilot
vercel deploy
```

**Configure environment variables in Vercel:**
- `CLICKUP_API_TOKEN` - Your ClickUp API token (required)
- `CLICKUP_LIST_ID` - Default list ID to sync (required)
- `OPENAI_API_KEY` - Your OpenAI API key with GPT-4o access (required)

See [vercel-setup.md](vercel-setup.md) for detailed deployment instructions.

### 2. Set Up Consumer Project

In your Next.js project:

```bash
# Create .sprint-pilot directory
mkdir -p .sprint-pilot

# Copy client scripts from this repo
cp sprint-pilot/client/scan-codebase.ts .sprint-pilot/
cp sprint-pilot/client/webhook-receiver.ts .sprint-pilot/
```

**Configure Cursor MCP** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "sprint-pilot": {
      "url": "https://your-deployment.vercel.app/mcp",
      "transport": "http"
    }
  }
}
```

### 3. Start Webhook Receiver

```bash
# In your project root
bun run .sprint-pilot/webhook-receiver.ts --port 3001
```

**Expose locally with ngrok:**

```bash
ngrok http 3001
# Note the public URL (e.g., https://abc123.ngrok.io)
```

### 4. Run Sprint Sync

**Option A: Via Cursor IDE** (Recommended)

1. Open Cursor in your project
2. Open chat and ask: *"Scan my codebase and sync sprint tickets. Use webhook URL: https://abc123.ngrok.io"*
3. Cursor agent will:
   - Run `scan-codebase.ts` to get your codebase structure
   - Call remote MCP server's `sprintSync` workflow
   - Wait for webhook delivery
4. Check `.ai/sprint/YYYY-MM-DD-sprint.md` for results

**Option B: Manual** (For testing)

```bash
# 1. Scan codebase
bun run .sprint-pilot/scan-codebase.ts > codebase-map.json

# 2. Call MCP server API (example using curl)
curl -X POST https://your-deployment.vercel.app/mcp/workflow/sprint-sync \
  -H "Content-Type: application/json" \
  -d '{
    "codebaseMap": '$(cat codebase-map.json)',
    "webhookUrl": "https://abc123.ngrok.io",
    "listId": "your-list-id"
  }'

# 3. Wait for webhook delivery (check webhook receiver logs)
```

## Sprint File Format

Generated sprint files include:

```markdown
# Sprint: 2026-02-13
Synced from ClickUp List "Sprint 2026-02-13" at 2026-02-13T14:30:00Z

## Tickets (ordered by priority)

### 1. [FEATURE] Add user profile editing
- **ClickUp ID**: abc123
- **Status**: In Progress
- **Quality**: 4/5 (missing: error scenarios)
- **Complexity**: feature
- **Priority**: High
- **Affected files**:
  - `app/(authenticated)/profile/page.tsx`
  - `app/(authenticated)/profile/actions.ts`
- **Suggested approach**: Implement form with React Hook Form, add server actions for profile updates
- **Agent**: /agent

[View in ClickUp](https://app.clickup.com/t/abc123)
```

## Client Scripts

### `scan-codebase.ts`

Scans Next.js App Router project structure:

```bash
# Output to console
bun run scan-codebase.ts

# Save to file
bun run scan-codebase.ts --output codebase-map.json

# Output format
{
  "routes": [
    { "path": "/profile", "files": ["page.tsx", "actions.ts"] }
  ],
  "components": ["components/ui/button.tsx"],
  "actions": ["app/(authenticated)/profile/actions.ts"],
  "scannedAt": "2026-02-13T14:30:00Z"
}
```

### `webhook-receiver.ts`

Local HTTP server for receiving sprint data:

```bash
# Start on default port 3001
bun run webhook-receiver.ts

# Custom port
bun run webhook-receiver.ts --port 8080

# With HMAC verification
bun run webhook-receiver.ts --secret your-webhook-secret
```

## MCP Server API

### Tools

| Tool | Description | Input |
|---|---|---|
| `clickup_sync` | Fetch ClickUp tasks | `{ listId?, includeSubtasks?, statuses? }` |
| `analyze_ticket` | Analyze ticket quality | `{ ticket, codebaseMap }` |
| `sprint_formatter` | Generate sprint markdown | `{ tickets, metadata }` |

### Agents

| Agent | Description |
|---|---|
| `ticketAnalyzer` | Orchestrates full ticket analysis workflow |

### Workflows

| Workflow | Description | Input |
|---|---|---|
| `sprintSync` | Full sync pipeline with webhook delivery | `{ listId?, codebaseMap, webhookUrl, webhookSecret? }` |

## Web Dashboard

Visit `https://your-deployment.vercel.app/` to:

- View recent sync jobs
- Monitor success rates and statistics
- Test webhook endpoints
- Check service health

## Configuration

### Environment Variables

**Server (Vercel):**
- `CLICKUP_API_TOKEN` (required)
- `CLICKUP_LIST_ID` (required)
- `OPENAI_API_KEY` (required)
- `WEBHOOK_SECRET` (optional - for HMAC webhook signing)

**Client (Local):**
- None required (all config via command-line args)

### Advanced Options

**Custom List ID per sync:**

```typescript
// In Cursor chat
"Sync sprint tickets from list 901234567"
```

**HMAC Webhook Security:**

```bash
# Start receiver with secret
bun run webhook-receiver.ts --secret my-secret-key

# Server will sign webhook payloads
# Receiver will verify signatures
```

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Type-check
npm run type-check

# Local Vercel dev server
npm run dev
# Visit http://localhost:3000
```

### Project Structure

```
sprint-pilot/
├── api/                  # Vercel serverless functions
│   ├── mcp.ts           # MCP server HTTP endpoint
│   ├── mcp/sse.ts       # MCP SSE streaming
│   └── index.ts         # Dashboard API
├── src/
│   ├── mastra/          # Mastra framework config
│   ├── tools/           # MCP tools (clickup, analyze, format)
│   ├── agents/          # AI agents
│   ├── workflows/       # Workflows
│   └── types/           # TypeScript types
├── client/              # Consumer project scripts
│   ├── scan-codebase.ts
│   └── webhook-receiver.ts
├── public/              # Static assets
│   └── index.html       # Dashboard UI
├── vercel.json          # Vercel config
└── package.json
```

## Troubleshooting

### ClickUp API Errors

- **401 Unauthorized**: Check `CLICKUP_API_TOKEN` is valid
- **429 Rate Limit**: Wait and retry, or reduce sync frequency
- **404 Not Found**: Verify `CLICKUP_LIST_ID` is correct

### OpenAI API Errors

- **401 Unauthorized**: Check `OPENAI_API_KEY`
- **Model not found**: Ensure GPT-4o access is enabled
- **Rate limit**: Upgrade OpenAI plan or reduce batch size

### Webhook Delivery Fails

- **Connection refused**: Is webhook receiver running?
- **Network error**: Is ngrok tunnel active?
- **Signature mismatch**: Ensure `WEBHOOK_SECRET` matches on both sides
- **Timeout**: Check webhook receiver logs for errors

### Codebase Scanner Issues

- **"app/ directory not found"**: Run from Next.js App Router project root
- **Empty results**: Ensure project uses App Router (not Pages Router)

### MCP Connection Issues

- **Cursor can't connect**: Verify MCP URL in `.cursor/mcp.json`
- **Tools not showing**: Check Vercel deployment logs for errors
- **Slow responses**: Analyzing many tickets takes time (expect 30-60s)

## Performance

- **Typical sync time**: 30-60s for 10-20 tickets
- **Vercel timeout**: 60s max (configured in `vercel.json`)
- **Batch size**: 5 concurrent ticket analyses
- **Rate limits**: ClickUp API ~100 req/min, OpenAI varies by tier

## Security

- **API Keys**: Stored securely in Vercel environment variables
- **Webhook HMAC**: Optional signature verification with shared secret
- **CORS**: Enabled for webhook callbacks, restricted for MCP
- **No codebase upload**: Codebase structure (file paths only) sent to server, not full code

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/sprint-pilot/issues)
- **Documentation**: [Full docs](https://github.com/yourusername/sprint-pilot/wiki)
- **ClickUp API**: [ClickUp API Docs](https://clickup.com/api)
- **Mastra Framework**: [Mastra Docs](https://mastra.ai/docs)

---

**Built with:**
- [Mastra](https://mastra.ai/) - AI agent framework
- [OpenAI GPT-4o](https://openai.com/) - Ticket analysis
- [ClickUp API](https://clickup.com/api) - Task management
- [Vercel](https://vercel.com/) - Serverless deployment
- [Cursor IDE](https://cursor.com/) - AI-powered development

**Made with ❤️ for productive sprint planning**
