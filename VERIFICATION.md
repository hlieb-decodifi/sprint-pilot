# Sprint Pilot Verification Checklist

This document provides a comprehensive verification checklist to test the Sprint Pilot system end-to-end.

## Prerequisites

Before starting verification:

- [ ] Bun or Node.js installed (v20+)
- [ ] Vercel CLI installed (`npm i -g vercel`)
- [ ] ngrok installed (or alternative tunnel tool)
- [ ] ClickUp account with API token
- [ ] OpenAI API key with GPT-4o access
- [ ] Next.js App Router test project

## Phase 1: Local Development Testing

### 1.1 Type Check

```bash
cd sprint-pilot
npm install
npm run type-check
```

**Expected:** No TypeScript errors

- [ ] TypeScript compilation successful
- [ ] All imports resolve correctly
- [ ] No type errors in strict mode

### 1.2 Local Vercel Dev Server

```bash
vercel dev
```

**Expected:** Server starts on `http://localhost:3000`

- [ ] Server starts without errors
- [ ] Dashboard loads at `http://localhost:3000/`
- [ ] MCP endpoint responds at `http://localhost:3000/mcp`

### 1.3 Test Client Scripts

**Codebase Scanner:**

```bash
cd /path/to/test-nextjs-project
bun run /path/to/sprint-pilot/client/scan-codebase.ts
```

- [ ] Scanner finds `app/` directory
- [ ] Outputs valid JSON with routes, components, actions
- [ ] No runtime errors

**Webhook Receiver:**

```bash
bun run /path/to/sprint-pilot/client/webhook-receiver.ts --port 3001
```

- [ ] Server starts on port 3001
- [ ] No binding errors
- [ ] Shows "Waiting for webhook requests..."

**Test webhook delivery:**

```bash
curl -X POST http://localhost:3001 \
  -H "Content-Type: application/json" \
  -d '{"sprintMarkdown":"# Test","tickets":[],"metadata":{"syncTimestamp":"2026-02-13T00:00:00Z","ticketCount":0,"listId":"test"}}'
```

- [ ] Webhook receiver logs receipt
- [ ] Creates `.ai/sprint/` directory
- [ ] Writes sprint markdown file
- [ ] Returns 200 OK response

## Phase 2: Vercel Deployment

### 2.1 Deploy to Vercel

```bash
vercel deploy --prod
```

- [ ] Build completes successfully
- [ ] No build errors
- [ ] Deployment URL received (note it for next steps)

### 2.2 Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```
CLICKUP_API_TOKEN=your_token
CLICKUP_TEAM_ID=your_team_id
CLICKUP_LIST_ID=your_list_id
OPENAI_API_KEY=your_openai_key
```

- [ ] All required variables set
- [ ] Variables applied to Production environment
- [ ] Redeploy triggered after adding variables

### 2.3 Verify Deployment

**Dashboard:**

```bash
curl https://your-deployment.vercel.app/
```

- [ ] Returns HTML (dashboard page)
- [ ] No 500 errors
- [ ] Dashboard loads in browser

**MCP Endpoint:**

```bash
curl https://your-deployment.vercel.app/mcp
```

- [ ] Returns MCP protocol response
- [ ] Lists available tools, agents, workflows
- [ ] No authentication errors

## Phase 3: Consumer Project Integration

### 3.1 Set Up Test Project

In your Next.js test project:

```bash
mkdir -p .sprint-pilot
cp /path/to/sprint-pilot/client/scan-codebase.ts .sprint-pilot/
cp /path/to/sprint-pilot/client/webhook-receiver.ts .sprint-pilot/
```

- [ ] Scripts copied successfully
- [ ] Scripts are executable

### 3.2 Configure Cursor MCP

Create `.cursor/mcp.json`:

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

- [ ] File created in project root
- [ ] URL matches your Vercel deployment
- [ ] JSON is valid

### 3.3 Test Cursor Connection

1. Open Cursor in test project
2. Open chat panel
3. Type `@sprint-pilot`

- [ ] Autocomplete shows sprint-pilot MCP server
- [ ] Tools are listed (clickup_sync, analyze_ticket, etc.)
- [ ] No connection errors

## Phase 4: End-to-End Workflow

### 4.1 Start Local Services

**Terminal 1 - Webhook Receiver:**

```bash
cd /path/to/test-project
bun run .sprint-pilot/webhook-receiver.ts --port 3001
```

**Terminal 2 - ngrok:**

```bash
ngrok http 3001
```

- [ ] Webhook receiver running
- [ ] ngrok tunnel established
- [ ] Note ngrok URL (e.g., `https://abc123.ngrok-free.app`)

### 4.2 Scan Codebase

```bash
bun run .sprint-pilot/scan-codebase.ts > codebase-map.json
cat codebase-map.json
```

- [ ] JSON output is valid
- [ ] Contains routes array
- [ ] Contains components array
- [ ] Contains actions array
- [ ] Routes match your project structure

### 4.3 Manual Workflow Test (Optional)

Test the workflow via API:

```bash
curl -X POST https://your-deployment.vercel.app/api/workflow/sprint-sync \
  -H "Content-Type: application/json" \
  -d "{
    \"codebaseMap\": $(cat codebase-map.json),
    \"webhookUrl\": \"https://your-ngrok-url.ngrok-free.app\",
    \"listId\": \"your-clickup-list-id\"
  }"
```

- [ ] Request accepted (200 or 202)
- [ ] No immediate errors
- [ ] Check Vercel logs for processing status

### 4.4 Cursor Agent Test (Recommended)

In Cursor chat:

```
Scan my codebase and sync sprint tickets from ClickUp.
Use webhook URL: https://your-ngrok-url.ngrok-free.app
```

**Expected flow:**
1. Cursor agent runs `scan-codebase.ts`
2. Agent calls remote MCP server
3. Server fetches ClickUp tickets
4. Server analyzes tickets with GPT-4o
5. Server POSTs to webhook receiver
6. Webhook receiver writes sprint file

**Verify:**

- [ ] Cursor agent completes without errors
- [ ] Webhook receiver logs receipt
- [ ] Sprint file created in `.ai/sprint/`
- [ ] Sprint file contains tickets
- [ ] Tickets have quality scores
- [ ] Tickets mapped to affected files
- [ ] Suggested approaches provided

### 4.5 Inspect Sprint File

```bash
cat .ai/sprint/$(ls -t .ai/sprint | head -1)
```

**Verify format:**

- [ ] Header: `# Sprint: YYYY-MM-DD`
- [ ] Metadata: sync timestamp, ticket count
- [ ] Summary statistics
- [ ] Tickets section with:
  - [ ] Priority ordering
  - [ ] Quality scores
  - [ ] Affected files
  - [ ] Suggested approaches
  - [ ] ClickUp links

## Phase 5: Feature Testing

### 5.1 Test Individual Tools

**ClickUp Sync:**

Via Cursor chat:
```
@sprint-pilot fetch my ClickUp tasks from list [your-list-id]
```

- [ ] Returns list of tasks
- [ ] Task data looks correct
- [ ] No API errors

**Ticket Analysis:**

Via Cursor chat:
```
@sprint-pilot analyze this ticket: [paste ticket details]
with this codebase: [paste codebase map]
```

- [ ] Returns quality score
- [ ] Lists quality gaps
- [ ] Maps to affected files
- [ ] Suggests implementation approach

### 5.2 Test Web Dashboard

Visit `https://your-deployment.vercel.app/`:

- [ ] Dashboard loads
- [ ] Status shows "Online"
- [ ] Statistics displayed (even if zero)
- [ ] Webhook test form present

**Test webhook endpoint:**

1. Enter `https://your-ngrok-url.ngrok-free.app` in form
2. Click "Test"

- [ ] Shows "Testing..." message
- [ ] Webhook receiver logs test payload
- [ ] Dashboard shows success or failure
- [ ] No CORS errors

### 5.3 Test Error Handling

**Invalid ClickUp token:**

Temporarily set wrong token in Vercel, trigger sync:

- [ ] Returns clear error message
- [ ] Doesn't crash server
- [ ] Error logged in Vercel

**Invalid webhook URL:**

Trigger sync with bad webhook URL:

- [ ] Workflow completes analysis
- [ ] Logs webhook delivery failure
- [ ] Retries webhook delivery
- [ ] Eventually reports failure

**Malformed codebase map:**

Send invalid JSON as codebaseMap:

- [ ] Returns validation error
- [ ] Doesn't crash server

## Phase 6: Performance Testing

### 6.1 Small Sprint (5-10 tickets)

- [ ] Completes in <30 seconds
- [ ] All tickets analyzed
- [ ] Webhook delivered successfully

### 6.2 Medium Sprint (10-20 tickets)

- [ ] Completes in <60 seconds
- [ ] No timeout errors
- [ ] All tickets processed

### 6.3 Large Sprint (20+ tickets)

- [ ] May approach 60s Vercel limit
- [ ] Consider splitting into batches
- [ ] Monitor Vercel function logs

## Phase 7: Security Testing

### 7.1 HMAC Signature Verification

Start webhook receiver with secret:

```bash
bun run .sprint-pilot/webhook-receiver.ts --port 3001 --secret test-secret
```

Set `WEBHOOK_SECRET=test-secret` in Vercel.

Trigger sync:

- [ ] Webhook includes signature header
- [ ] Receiver verifies signature successfully
- [ ] Invalid signature rejected

### 7.2 Environment Variable Security

- [ ] API keys not exposed in client
- [ ] Environment variables only in Vercel
- [ ] No secrets in Git history
- [ ] `.env` in `.gitignore`

## Phase 8: Documentation Testing

### 8.1 README Accuracy

Follow README quick start guide:

- [ ] All steps work as described
- [ ] Code examples are correct
- [ ] Links work
- [ ] No missing information

### 8.2 CLIENT_SETUP.md Accuracy

Follow client setup guide step-by-step:

- [ ] All commands work
- [ ] Instructions are clear
- [ ] No missing prerequisites
- [ ] Troubleshooting section helpful

## Common Issues & Solutions

### TypeScript Errors

- Check all dependencies installed: `npm install`
- Verify TypeScript version: `npx tsc --version`
- Clear build cache: `rm -rf dist node_modules && npm install`

### Vercel Deployment Fails

- Check build logs for specific error
- Verify all imports use `.js` extensions (ESM)
- Ensure no missing dependencies

### MCP Connection Fails

- Verify deployment URL is correct
- Check Vercel function logs for errors
- Ensure CORS headers are set
- Try clearing Cursor cache

### Webhook Not Delivered

- Verify webhook receiver is running
- Check ngrok tunnel is active
- Test webhook URL with curl
- Check Vercel logs for delivery attempts

### No Tickets Returned

- Verify ClickUp API token is valid
- Check list ID is correct
- Ensure list has tasks
- Check ClickUp API permissions

### LLM Analysis Fails

- Verify OpenAI API key is valid
- Check GPT-4o access is enabled
- Monitor OpenAI API usage/limits
- Review Vercel function logs

## Success Criteria

All checks must pass:

- ✓ TypeScript compiles without errors
- ✓ Deploys to Vercel successfully
- ✓ Dashboard loads and displays correctly
- ✓ MCP endpoint responds to Cursor
- ✓ Client scripts work in consumer project
- ✓ End-to-end workflow completes successfully
- ✓ Sprint file generated with correct format
- ✓ Tickets analyzed with quality scores
- ✓ Files mapped to codebase correctly
- ✓ Webhook delivery works reliably
- ✓ Error handling works gracefully
- ✓ Performance meets expectations (<60s)
- ✓ Documentation is accurate and complete

## Sign-Off

Date: _______________

Verified by: _______________

Notes:
