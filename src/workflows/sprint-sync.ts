import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { SprintSyncInputSchema, ClickUpTaskSchema, AnalyzedTicketSchema, type ClickUpTask, type AnalyzedTicket, type SprintMetadata, type TicketAnalysis } from '../types/index.js';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { TicketAnalysisSchema, CodebaseMapSchema } from '../types/index.js';
import { getEnvVar } from '../utils/env.js';
import { createHmac } from 'crypto';

// ---- Inline tool logic to avoid v1 tool execute complexity in workflows ----

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

async function fetchClickUpTasks(listId?: string, includeSubtasks = true): Promise<{ tasks: ClickUpTask[]; listId: string }> {
  const resolvedListId = listId || getEnvVar('CLICKUP_LIST_ID');
  const apiToken = getEnvVar('CLICKUP_API_TOKEN');

  const params = new URLSearchParams({
    include_subtasks: includeSubtasks.toString(),
  });

  const url = `${CLICKUP_API_BASE}/list/${resolvedListId}/task?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': apiToken,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { tasks: unknown[] };

  const tasks: ClickUpTask[] = data.tasks.map((task: unknown) => {
    try {
      return ClickUpTaskSchema.parse(task);
    } catch {
      const t = task as Record<string, unknown>;
      return {
        id: String(t.id),
        name: String(t.name || 'Untitled Task'),
        description: (t.description as string) || null,
        status: { status: (t.status as Record<string, string>)?.status || 'unknown' },
        assignees: (t.assignees as unknown[]) || [],
        priority: (t.priority as Record<string, string>) || null,
        tags: (t.tags as unknown[]) || [],
        due_date: (t.due_date as string) || null,
        custom_fields: (t.custom_fields as unknown[]) || [],
        url: (t.url as string) || '',
      } as ClickUpTask;
    }
  });

  return { tasks, listId: resolvedListId };
}

const ANALYSIS_SYSTEM_PROMPT = `You are a senior software developer reviewing sprint tickets for quality and implementation planning.
Assess quality 1-5, identify gaps, map to affected files, classify as fix/feature, provide implementation approach.`;

async function analyzeTicket(
  ticket: ClickUpTask,
  codebaseMap: { routes: { path: string; files: string[] }[]; components: string[]; actions: string[] },
): Promise<TicketAnalysis> {
  const userPrompt = `Analyze this ticket:
Title: ${ticket.name}
Description: ${ticket.description || 'No description'}
Status: ${ticket.status.status}
Priority: ${ticket.priority?.priority || 'Not set'}

CODEBASE:
Routes: ${codebaseMap.routes.map(r => `${r.path}: [${r.files.join(', ')}]`).join('\n')}
Components: ${codebaseMap.components.slice(0, 50).join(', ')}
Actions: ${codebaseMap.actions.join(', ')}

Return JSON: { qualityScore, qualityGaps, affectedFiles, complexityTag, suggestedApproach }`;

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: TicketAnalysisSchema,
      system: ANALYSIS_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });
    return object;
  } catch {
    return {
      qualityScore: 3,
      qualityGaps: ['Analysis failed - manual review needed'],
      affectedFiles: [],
      complexityTag: 'feature' as const,
      suggestedApproach: 'Review ticket manually',
    };
  }
}

// Webhook delivery with retry logic
async function deliverWebhook(
  webhookUrl: string,
  payload: unknown,
  secret?: string,
  retries = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let signature: string | undefined;
      if (secret) {
        const hmac = createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        signature = `sha256=${hmac.digest('hex')}`;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sprint-Pilot/1.0',
      };

      if (signature) {
        headers['X-Sprint-Pilot-Signature'] = signature;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
      }

      console.log(`Webhook delivered successfully to ${webhookUrl}`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Webhook delivery attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Webhook delivery failed after retries');
}

// ---- Workflow Steps ----

// Step 1: Fetch tasks from ClickUp
const fetchTasksStep = createStep({
  id: 'fetch-tasks',
  inputSchema: SprintSyncInputSchema,
  outputSchema: z.object({
    tasks: z.array(ClickUpTaskSchema),
    listId: z.string(),
    codebaseMap: CodebaseMapSchema,
    webhookUrl: z.string(),
    webhookSecret: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { listId, codebaseMap, webhookUrl, webhookSecret } = inputData;

    console.log('Fetching tasks from ClickUp...');
    const result = await fetchClickUpTasks(listId);

    return {
      tasks: result.tasks,
      listId: result.listId,
      codebaseMap,
      webhookUrl,
      webhookSecret,
    };
  },
});

// Step 2: Analyze all tickets
const analyzeTicketsStep = createStep({
  id: 'analyze-tickets',
  inputSchema: z.object({
    tasks: z.array(ClickUpTaskSchema),
    listId: z.string(),
    codebaseMap: CodebaseMapSchema,
    webhookUrl: z.string(),
    webhookSecret: z.string().optional(),
  }),
  outputSchema: z.object({
    analyzedTickets: z.array(AnalyzedTicketSchema),
    listId: z.string(),
    webhookUrl: z.string(),
    webhookSecret: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { tasks, listId, codebaseMap, webhookUrl, webhookSecret } = inputData;

    if (tasks.length === 0) {
      return {
        analyzedTickets: [],
        listId,
        webhookUrl,
        webhookSecret,
      };
    }

    console.log(`Analyzing ${tasks.length} tickets with GPT-4o...`);

    const batchSize = 5;
    const results: AnalyzedTicket[] = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (ticket) => {
          const analysis = await analyzeTicket(ticket, codebaseMap);
          return { ticket, analysis };
        })
      );

      results.push(...batchResults);
      console.log(`Analyzed ${results.length}/${tasks.length} tickets...`);
    }

    return {
      analyzedTickets: results,
      listId,
      webhookUrl,
      webhookSecret,
    };
  },
});

// Step 3: Format sprint markdown and deliver webhook
const formatAndDeliverStep = createStep({
  id: 'format-and-deliver',
  inputSchema: z.object({
    analyzedTickets: z.array(AnalyzedTicketSchema),
    listId: z.string(),
    webhookUrl: z.string(),
    webhookSecret: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketCount: z.number(),
    webhookDelivered: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { analyzedTickets, listId, webhookUrl, webhookSecret } = inputData;

    if (analyzedTickets.length === 0) {
      return {
        success: true,
        ticketCount: 0,
        webhookDelivered: false,
        message: 'No tickets found in the list',
      };
    }

    // Import and use the formatter tool's logic inline
    const metadata: SprintMetadata = {
      syncTimestamp: new Date().toISOString(),
      ticketCount: analyzedTickets.length,
      listId,
      listName: `Sprint ${new Date().toISOString().split('T')[0]}`,
    };

    // Format markdown inline (same logic as sprint-formatter tool)
    const lines: string[] = [];
    const sprintDate = new Date(metadata.syncTimestamp).toISOString().split('T')[0];
    lines.push(`# Sprint: ${sprintDate}`);
    lines.push('');
    lines.push(`Synced from ClickUp List "${metadata.listName || listId}" at ${new Date(metadata.syncTimestamp).toISOString()}`);
    lines.push(`Total tickets: ${metadata.ticketCount}`);
    lines.push('');

    const fixes = analyzedTickets.filter(t => t.analysis.complexityTag === 'fix').length;
    const features = analyzedTickets.filter(t => t.analysis.complexityTag === 'feature').length;
    const avgQuality = analyzedTickets.length > 0
      ? (analyzedTickets.reduce((sum, t) => sum + t.analysis.qualityScore, 0) / analyzedTickets.length).toFixed(1)
      : '0';

    lines.push('**Summary:**');
    lines.push(`- Fixes: ${fixes}`);
    lines.push(`- Features: ${features}`);
    lines.push(`- Average Quality Score: ${avgQuality}/5`);
    lines.push('');
    lines.push('## Tickets (ordered by priority)');
    lines.push('');

    analyzedTickets.forEach((item, index) => {
      const tag = item.analysis.complexityTag.toUpperCase();
      lines.push(`### ${index + 1}. [${tag}] ${item.ticket.name}`);
      lines.push(`- **ClickUp ID**: ${item.ticket.id}`);
      lines.push(`- **Status**: ${item.ticket.status.status}`);
      lines.push(`- **Quality**: ${item.analysis.qualityScore}/5`);
      if (item.analysis.affectedFiles.length > 0) {
        lines.push(`- **Affected files**: ${item.analysis.affectedFiles.join(', ')}`);
      }
      lines.push(`- **Suggested approach**: ${item.analysis.suggestedApproach}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    const markdown = lines.join('\n');

    // Deliver via webhook
    console.log('Delivering results to webhook...');
    const payload = {
      sprintMarkdown: markdown,
      tickets: analyzedTickets,
      metadata: {
        syncTimestamp: new Date().toISOString(),
        ticketCount: analyzedTickets.length,
        listId,
      },
    };

    let webhookDelivered = false;
    try {
      await deliverWebhook(webhookUrl, payload, webhookSecret);
      webhookDelivered = true;
    } catch (error) {
      console.error('Webhook delivery failed:', error);
    }

    return {
      success: true,
      ticketCount: analyzedTickets.length,
      webhookDelivered,
      message: webhookDelivered
        ? `Successfully analyzed ${analyzedTickets.length} tickets and delivered to webhook`
        : `Analyzed ${analyzedTickets.length} tickets but webhook delivery failed`,
    };
  },
});

// Compose the workflow using v1 step chaining
export const sprintSyncWorkflow = createWorkflow({
  id: 'sprint-sync',
  inputSchema: SprintSyncInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    ticketCount: z.number(),
    webhookDelivered: z.boolean(),
    message: z.string(),
  }),
})
  .then(fetchTasksStep)
  .then(analyzeTicketsStep)
  .then(formatAndDeliverStep)
  .commit();
