import { createTool } from '@mastra/core/tools';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { AnalyzeTicketInputSchema, TicketAnalysisSchema } from '../types/index.js';

const SYSTEM_PROMPT = `You are a senior software developer reviewing sprint tickets for quality and implementation planning.

Your tasks:
1. Assess the ticket's quality on a scale of 1-5 based on:
   - Clarity of requirements
   - Presence of acceptance criteria
   - Sufficient technical details
   - Error handling considerations
   - Edge cases mentioned

2. Identify quality gaps with specific, actionable feedback

3. Map the ticket to affected files in the codebase by:
   - Matching ticket description keywords to file paths
   - Considering the feature area (auth, profile, ui, etc.)
   - Identifying related components, pages, and server actions
   - Being specific with file paths (use the exact paths from codebaseMap)

4. Classify as 'fix' or 'feature':
   - 'fix': Bug fixes, styling updates, small corrections
   - 'feature': New functionality, major changes, new pages

5. Provide a 1-2 sentence implementation approach that is specific and actionable

Be thorough but concise. Focus on practical guidance that helps developers implement the ticket efficiently.`;

export const analyzeTicketTool = createTool({
  id: 'analyze-ticket',
  description: 'Analyze a ClickUp ticket for quality and map it to codebase files using GPT-4o',
  inputSchema: AnalyzeTicketInputSchema,
  outputSchema: TicketAnalysisSchema,
  execute: async (inputData) => {
    const { ticket, codebaseMap } = inputData;

    // Build user prompt with ticket and codebase context
    const userPrompt = `Analyze this ticket and map it to the codebase:

TICKET:
Title: ${ticket.name}
Description: ${ticket.description || 'No description provided'}
Status: ${ticket.status.status}
Priority: ${ticket.priority?.priority || 'Not set'}
Tags: ${ticket.tags?.map(t => t.name).join(', ') || 'None'}
URL: ${ticket.url || 'N/A'}

CODEBASE STRUCTURE:
Routes:
${codebaseMap.routes.map(r => `  ${r.path}: [${r.files.join(', ')}]`).join('\n')}

Components:
${codebaseMap.components.slice(0, 50).join('\n  ')}${codebaseMap.components.length > 50 ? '\n  ... and more' : ''}

Server Actions:
${codebaseMap.actions.join('\n  ')}

Provide your analysis as a JSON object with: qualityScore, qualityGaps, affectedFiles, complexityTag, suggestedApproach.`;

    try {
      const { object: analysis } = await generateObject({
        model: openai('gpt-4o'),
        schema: TicketAnalysisSchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      return analysis;
    } catch (error) {
      console.error('Error analyzing ticket:', error);
      
      // Fallback to basic analysis if LLM fails
      return {
        qualityScore: 3,
        qualityGaps: ['Unable to perform detailed analysis due to technical error'],
        affectedFiles: [],
        complexityTag: 'feature' as const,
        suggestedApproach: 'Review ticket requirements and identify relevant files manually',
      };
    }
  },
});
