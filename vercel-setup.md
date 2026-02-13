# Vercel Deployment Setup

## Environment Variables

Configure these environment variables in your Vercel project settings:

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `CLICKUP_API_TOKEN` | Your ClickUp personal API token | `pk_123456_ABCDEFG...` |
| `CLICKUP_LIST_ID` | Default ClickUp list ID to sync from | `901234567` |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-proj-...` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `WEBHOOK_SECRET` | Secret for HMAC webhook signing | (none) |
| `LOG_LEVEL` | Logging level | `info` |

## Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your `sprint-pilot` Git repository
4. Vercel will auto-detect the configuration from `vercel.json`

### 2. Configure Environment Variables

In the Vercel project settings:

1. Go to "Settings" → "Environment Variables"
2. Add all required environment variables listed above
3. Select environments: Production, Preview, Development

### 3. Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Note your deployment URL (e.g., `https://sprint-pilot.vercel.app`)

### 4. Verify Deployment

1. Visit `https://your-deployment.vercel.app/` (should show dashboard)
2. Test MCP endpoint: `curl https://your-deployment.vercel.app/mcp`
3. Check logs in Vercel dashboard for any errors

## ClickUp API Token

To get your ClickUp API token:

1. Log in to ClickUp
2. Go to Settings → Apps
3. Click "Generate" under "API Token"
4. Copy the token and add to Vercel environment variables

**Important:** Keep your API token secure. Never commit it to Git.

## OpenAI API Key

To get your OpenAI API key:

1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys section
3. Create a new API key
4. Copy and add to Vercel environment variables

**Note:** Ensure you have GPT-4o access and sufficient credits.

## Troubleshooting

### Build Fails

- Check that all dependencies are listed in `package.json`
- Verify TypeScript compiles locally: `npm run type-check`
- Check Vercel build logs for specific errors

### Runtime Errors

- Verify all environment variables are set correctly
- Check Vercel function logs for error details
- Test API tokens manually (ClickUp, OpenAI)

### Timeouts

- Vercel serverless functions have a 60s timeout limit (configured in `vercel.json`)
- If analyzing many tickets, consider reducing batch size in workflow

### CORS Issues

- CORS headers are configured in `api/mcp.ts`
- If issues persist, check Vercel function logs

## Production Checklist

- [ ] All environment variables configured
- [ ] ClickUp API token is valid and has necessary permissions
- [ ] OpenAI API key has GPT-4o access
- [ ] Deployment successful
- [ ] Dashboard loads at root URL
- [ ] MCP endpoint responds at `/mcp`
- [ ] Test webhook delivery works
- [ ] Consumer project can connect via MCP

## Support

For issues:
1. Check Vercel function logs
2. Review [Vercel documentation](https://vercel.com/docs)
3. Open an issue on the GitHub repository
