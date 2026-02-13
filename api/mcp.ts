import { MCPServer } from '@mastra/mcp';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clickupSyncTool } from '../src/tools/clickup-sync.js';
import { analyzeTicketTool } from '../src/tools/analyze-ticket.js';
import { sprintFormatterTool } from '../src/tools/sprint-formatter.js';
import { ticketAnalyzerAgent } from '../src/agents/ticket-analyzer.js';
import { sprintSyncWorkflow } from '../src/workflows/sprint-sync.js';

// Create MCP server instance
const mcpServer = new MCPServer({
  id: 'sprint-pilot',
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

// Vercel serverless function handler
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Use streamable HTTP transport in serverless mode
    await mcpServer.startHTTP({
      url,
      httpPath: '/api/mcp',
      req,
      res,
      options: {
        serverless: true,
      },
    });
  } catch (error) {
    console.error('MCP server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
