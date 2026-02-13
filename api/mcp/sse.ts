import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MCPServer } from '@mastra/mcp';
import { clickupSyncTool } from '../../src/tools/clickup-sync.js';
import { analyzeTicketTool } from '../../src/tools/analyze-ticket.js';
import { sprintFormatterTool } from '../../src/tools/sprint-formatter.js';
import { ticketAnalyzerAgent } from '../../src/agents/ticket-analyzer.js';
import { sprintSyncWorkflow } from '../../src/workflows/sprint-sync.js';

// Create MCP server
const mcpServer = new MCPServer({
  id: 'sprint-pilot-sse',
  name: 'sprint-pilot',
  version: '1.0.0',
  description: 'AI-powered sprint planning tool with ClickUp integration',
  tools: {
    clickup_sync: clickupSyncTool,
    analyze_ticket: analyzeTicketTool,
    sprint_formatter: sprintFormatterTool,
  },
  agents: {
    ticketAnalyzer: ticketAnalyzerAgent,
  },
  workflows: {
    sprintSync: sprintSyncWorkflow,
  },
});

// SSE endpoint handler
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Use SSE transport
    await mcpServer.startSSE({
      url,
      ssePath: '/api/mcp/sse',
      messagePath: '/api/mcp/sse',
      req,
      res,
    });
  } catch (error) {
    console.error('SSE handler error:', error);

    // Send error event
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({
      error: 'SSE streaming error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })}\n\n`);
    res.end();
  }
}
