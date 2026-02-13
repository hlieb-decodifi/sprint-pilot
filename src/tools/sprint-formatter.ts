import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SprintFormatterInputSchema, type AnalyzedTicket } from '../types/index.js';

// Priority order mapping
const PRIORITY_ORDER: Record<string, number> = {
  'urgent': 1,
  'high': 2,
  'normal': 3,
  'low': 4,
};

function getPriorityOrder(priority?: string): number {
  if (!priority) return 5;
  const normalized = priority.toLowerCase();
  return PRIORITY_ORDER[normalized] || 5;
}

function sortTickets(tickets: AnalyzedTicket[]): AnalyzedTicket[] {
  return [...tickets].sort((a, b) => {
    // First sort by priority
    const priorityA = getPriorityOrder(a.ticket.priority?.priority);
    const priorityB = getPriorityOrder(b.ticket.priority?.priority);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Then by quality score (higher first)
    if (a.analysis.qualityScore !== b.analysis.qualityScore) {
      return b.analysis.qualityScore - a.analysis.qualityScore;
    }

    // Then by complexity (fixes before features for quick wins)
    if (a.analysis.complexityTag !== b.analysis.complexityTag) {
      return a.analysis.complexityTag === 'fix' ? -1 : 1;
    }

    return 0;
  });
}

function formatQualityScore(score: number, gaps: string[]): string {
  if (gaps.length === 0) {
    return `${score}/5`;
  }
  return `${score}/5 (missing: ${gaps.join(', ')})`;
}

function formatTicketMarkdown(ticket: AnalyzedTicket, index: number): string {
  const { ticket: t, analysis: a } = ticket;
  
  const lines: string[] = [];
  
  // Header
  const tag = a.complexityTag.toUpperCase();
  lines.push(`### ${index + 1}. [${tag}] ${t.name}`);
  
  // Metadata
  lines.push(`- **ClickUp ID**: ${t.id}`);
  lines.push(`- **Status**: ${t.status.status}`);
  lines.push(`- **Quality**: ${formatQualityScore(a.qualityScore, a.qualityGaps)}`);
  lines.push(`- **Complexity**: ${a.complexityTag}`);
  
  if (t.priority) {
    lines.push(`- **Priority**: ${t.priority.priority}`);
  }
  
  if (t.assignees && t.assignees.length > 0) {
    const assigneeNames = t.assignees.map(a => a.username).join(', ');
    lines.push(`- **Assignees**: ${assigneeNames}`);
  }
  
  if (t.tags && t.tags.length > 0) {
    const tagNames = t.tags.map(tag => tag.name).join(', ');
    lines.push(`- **Tags**: ${tagNames}`);
  }

  if (t.due_date) {
    const dueDate = new Date(t.due_date).toISOString().split('T')[0];
    lines.push(`- **Due Date**: ${dueDate}`);
  }
  
  // Affected files
  if (a.affectedFiles.length > 0) {
    lines.push('- **Affected files**:');
    a.affectedFiles.forEach(file => {
      lines.push(`  - \`${file}\``);
    });
  } else {
    lines.push('- **Affected files**: (none identified)');
  }
  
  // Suggested approach
  lines.push(`- **Suggested approach**: ${a.suggestedApproach}`);
  
  // Agent suggestion
  const agentCommand = a.complexityTag === 'fix' ? '/fix' : '/agent';
  lines.push(`- **Agent**: ${agentCommand}`);
  
  // Description if available
  if (t.description && t.description.trim().length > 0) {
    lines.push('');
    lines.push('**Description:**');
    lines.push(t.description.trim());
  }
  
  // ClickUp URL
  if (t.url) {
    lines.push('');
    lines.push(`[View in ClickUp](${t.url})`);
  }
  
  return lines.join('\n');
}

export const sprintFormatterTool = createTool({
  id: 'sprint-formatter',
  description: 'Generate sprint markdown from analyzed tickets',
  inputSchema: SprintFormatterInputSchema,
  outputSchema: z.object({
    markdown: z.string(),
  }),
  execute: async (inputData) => {
    const { tickets, metadata } = inputData;

    // Sort tickets by priority
    const sortedTickets = sortTickets(tickets);

    // Build markdown
    const lines: string[] = [];
    
    // Header
    const sprintDate = new Date(metadata.syncTimestamp).toISOString().split('T')[0];
    lines.push(`# Sprint: ${sprintDate}`);
    lines.push('');
    
    // Metadata
    const syncTime = new Date(metadata.syncTimestamp).toISOString();
    const listName = metadata.listName || `List ${metadata.listId}`;
    lines.push(`Synced from ClickUp List "${listName}" at ${syncTime}`);
    lines.push(`Total tickets: ${metadata.ticketCount}`);
    lines.push('');
    
    // Summary statistics
    const complexityCounts = {
      fix: tickets.filter(t => t.analysis.complexityTag === 'fix').length,
      feature: tickets.filter(t => t.analysis.complexityTag === 'feature').length,
    };
    const avgQuality = tickets.length > 0
      ? (tickets.reduce((sum, t) => sum + t.analysis.qualityScore, 0) / tickets.length).toFixed(1)
      : '0';
    
    lines.push('**Summary:**');
    lines.push(`- Fixes: ${complexityCounts.fix}`);
    lines.push(`- Features: ${complexityCounts.feature}`);
    lines.push(`- Average Quality Score: ${avgQuality}/5`);
    lines.push('');
    
    // Tickets section
    lines.push('## Tickets (ordered by priority)');
    lines.push('');
    
    if (sortedTickets.length === 0) {
      lines.push('No tickets found.');
    } else {
      sortedTickets.forEach((ticket, index) => {
        lines.push(formatTicketMarkdown(ticket, index));
        lines.push('');
        lines.push('---');
        lines.push('');
      });
    }

    const markdown = lines.join('\n');

    return { markdown };
  },
});
