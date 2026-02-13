# Client Setup Guide

Step-by-step guide to integrate Sprint Pilot with your Next.js project.

## Prerequisites

- Next.js project using App Router (not Pages Router)
- Bun or Node.js installed
- Cursor IDE
- Sprint Pilot deployed to Vercel (get deployment URL)

## Step 1: Copy Client Scripts

From the Sprint Pilot repository, copy the client utilities to your project:

```bash
# Create .sprint-pilot directory in your project
mkdir -p .sprint-pilot

# Copy scripts (adjust path to where you cloned sprint-pilot)
cp path/to/sprint-pilot/client/scan-codebase.ts .sprint-pilot/
cp path/to/sprint-pilot/client/webhook-receiver.ts .sprint-pilot/
```

**Alternative**: Download directly from GitHub:

```bash
mkdir -p .sprint-pilot
curl -o .sprint-pilot/scan-codebase.ts https://raw.githubusercontent.com/yourusername/sprint-pilot/main/client/scan-codebase.ts
curl -o .sprint-pilot/webhook-receiver.ts https://raw.githubusercontent.com/yourusername/sprint-pilot/main/client/webhook-receiver.ts
```

## Step 2: Configure Cursor MCP

Create or edit `.cursor/mcp.json` in your project root:

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

Replace `your-deployment.vercel.app` with your actual Vercel deployment URL.

**Verify connection:**

1. Open Cursor in your project
2. Open chat panel
3. Type `@sprint-pilot` - you should see MCP tools appear in autocomplete

## Step 3: Set Up Webhook Receiver

The webhook receiver is a local HTTP server that receives sprint data from the remote Sprint Pilot service.

### Basic Usage

```bash
# Start receiver (default port 3001)
bun run .sprint-pilot/webhook-receiver.ts
```

You should see:

```
🚀 Sprint Pilot Webhook Receiver
   Listening on: http://localhost:3001
   Project root: /your/project/path
   Sprint files: .ai/sprint/

   Waiting for webhook requests...
```

### Expose with ngrok

For the remote Sprint Pilot service to reach your local webhook receiver, you need to expose it publicly:

```bash
# Install ngrok if not already installed
# Download from: https://ngrok.com/download

# Expose local port 3001
ngrok http 3001
```

Note the forwarding URL (e.g., `https://abc123.ngrok-free.app`). You'll use this as the webhook URL.

### Advanced Options

**Custom port:**

```bash
bun run .sprint-pilot/webhook-receiver.ts --port 8080
```

**With HMAC verification:**

```bash
bun run .sprint-pilot/webhook-receiver.ts --secret your-webhook-secret
```

(Ensure the same secret is set as `WEBHOOK_SECRET` in Vercel environment variables)

## Step 4: Test Codebase Scanner

Before running a full sync, test that the codebase scanner works:

```bash
# Scan and output to console
bun run .sprint-pilot/scan-codebase.ts

# Save to file for inspection
bun run .sprint-pilot/scan-codebase.ts --output codebase-map.json
```

**Expected output:**

```
Scanning codebase...
Found 12 routes
Found 45 components
Found 8 server actions
```

The generated `codebase-map.json` should contain your project structure:

```json
{
  "routes": [
    { "path": "/", "files": ["page.tsx", "layout.tsx"] },
    { "path": "/profile", "files": ["page.tsx", "actions.ts"] }
  ],
  "components": ["components/ui/button.tsx", ...],
  "actions": ["app/(authenticated)/profile/actions.ts", ...],
  "scannedAt": "2026-02-13T14:30:00Z"
}
```

**Troubleshooting:**

- **"app/ directory not found"**: Ensure you're running from project root and using Next.js App Router
- **Empty routes**: Check that your `app/` directory contains `page.tsx` files
- **Permission errors**: Ensure you have read permissions for `app/` directory

## Step 5: Run Sprint Sync

Now you're ready to sync ClickUp tickets!

### Method A: Via Cursor IDE (Recommended)

1. **Ensure webhook receiver is running:**
   ```bash
   bun run .sprint-pilot/webhook-receiver.ts --port 3001
   ```

2. **Expose with ngrok:**
   ```bash
   ngrok http 3001
   # Note the URL: https://abc123.ngrok-free.app
   ```

3. **Open Cursor in your project**

4. **In Cursor chat, ask:**
   ```
   Scan my codebase and sync sprint tickets from ClickUp.
   Use webhook URL: https://abc123.ngrok-free.app
   ```

5. **Cursor agent will:**
   - Run the codebase scanner
   - Call the remote MCP server with the codebase map
   - Sprint Pilot fetches ClickUp tickets
   - Analyzes each ticket with GPT-4o
   - Maps tickets to your files
   - POSTs results to your webhook receiver

6. **Check the result:**
   ```bash
   cat .ai/sprint/$(ls -t .ai/sprint | head -1)
   ```

### Method B: Manual Workflow

For more control or debugging:

```bash
# 1. Start webhook receiver in terminal 1
bun run .sprint-pilot/webhook-receiver.ts --port 3001

# 2. Expose with ngrok in terminal 2
ngrok http 3001
# Note ngrok URL

# 3. Scan codebase in terminal 3
bun run .sprint-pilot/scan-codebase.ts > codebase-map.json

# 4. Trigger sync via API call (example with curl)
curl -X POST https://your-deployment.vercel.app/api/mcp/workflow/sprint-sync \
  -H "Content-Type: application/json" \
  -d "{
    \"codebaseMap\": $(cat codebase-map.json),
    \"webhookUrl\": \"https://abc123.ngrok-free.app\",
    \"listId\": \"your-list-id\"
  }"

# 5. Watch webhook receiver logs for delivery
# 6. Check .ai/sprint/ for generated file
```

## Step 6: Review Sprint File

Once sync completes, open the generated sprint file:

```bash
# List sprint files (newest first)
ls -lt .ai/sprint/

# Open in Cursor
cursor .ai/sprint/2026-02-13-sprint.md
```

The sprint file contains:
- Prioritized ticket list
- Quality scores and gaps
- Affected files in your codebase
- Suggested implementation approaches
- ClickUp links

Use this to guide your development in Cursor!

## Integration Tips

### Add to package.json Scripts

For convenience, add scripts to your project's `package.json`:

```json
{
  "scripts": {
    "sprint:webhook": "bun run .sprint-pilot/webhook-receiver.ts",
    "sprint:scan": "bun run .sprint-pilot/scan-codebase.ts",
    "sprint:sync": "echo 'Use Cursor IDE to sync sprint tickets'"
  }
}
```

Now you can run:

```bash
npm run sprint:webhook
npm run sprint:scan
```

### Automate with Cron (Optional)

Set up automated sprint syncs (requires persistent webhook receiver):

```bash
# Example: Daily sprint sync at 9 AM
# Add to crontab:
0 9 * * * cd /path/to/project && curl -X POST https://your-deployment.vercel.app/api/sync
```

### Gitignore Sprint Files

Add to `.gitignore` if you don't want to commit sprint files:

```
.ai/sprint/
codebase-map.json
```

### Share Sprint Files (Optional)

Or commit them for team visibility:

```bash
git add .ai/sprint/
git commit -m "Add sprint planning for 2026-02-13"
git push
```

## Common Workflows

### Daily Sprint Planning

```bash
# Morning routine
npm run sprint:webhook &  # Start receiver in background
ngrok http 3001 &         # Expose webhook

# In Cursor: "Sync today's sprint tickets"
```

### Per-Feature Planning

```bash
# Before starting a feature
# In Cursor: "Sync tickets tagged 'authentication' from ClickUp"
```

### Quick Ticket Check

```bash
# Scan codebase to see structure
npm run sprint:scan

# Review last sprint file
cursor .ai/sprint/$(ls -t .ai/sprint | head -1)
```

## Troubleshooting

### MCP Not Connected

```bash
# Check .cursor/mcp.json exists and has correct URL
cat .cursor/mcp.json

# Restart Cursor
# Try typing @sprint-pilot in chat
```

### Webhook Not Receiving

```bash
# Check receiver is running
lsof -i :3001

# Check ngrok tunnel is active
curl https://your-ngrok-url.ngrok-free.app

# Test webhook manually
curl -X POST http://localhost:3001 \
  -H "Content-Type: application/json" \
  -d '{"sprintMarkdown":"# Test","tickets":[],"metadata":{"syncTimestamp":"2026-02-13T00:00:00Z","ticketCount":0,"listId":"test"}}'
```

### Codebase Scanner Fails

```bash
# Ensure you're in project root
pwd

# Check app/ directory exists
ls -la app/

# Try with explicit path
bun run .sprint-pilot/scan-codebase.ts
```

### Sprint File Not Created

```bash
# Check webhook receiver logs for errors
# Verify .ai/sprint/ directory permissions
ls -la .ai/

# Create manually if needed
mkdir -p .ai/sprint
```

## Next Steps

- Explore the [Sprint Pilot Dashboard](https://your-deployment.vercel.app) to monitor sync jobs
- Customize ticket analysis by providing more detailed descriptions in ClickUp
- Use sprint files as context for Cursor agent: "@sprint what should I work on next?"
- Share sprint files with your team for collaborative planning

## Support

- Sprint Pilot README: [README.md](README.md)
- Deployment Guide: [vercel-setup.md](vercel-setup.md)
- Issues: [GitHub Issues](https://github.com/yourusername/sprint-pilot/issues)
