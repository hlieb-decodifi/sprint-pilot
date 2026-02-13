import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ClickUpTaskSchema, ClickUpSyncInputSchema, type ClickUpTask } from '../types/index.js';
import { getEnvVar } from '../utils/env.js';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

interface ClickUpApiResponse {
  tasks: any[];
}

export const clickupSyncTool = createTool({
  id: 'clickup-sync',
  description: 'Fetch tasks from a ClickUp list with optional filtering',
  inputSchema: ClickUpSyncInputSchema,
  outputSchema: z.object({
    tasks: z.array(ClickUpTaskSchema),
    listId: z.string(),
  }),
  execute: async (inputData) => {
    const { listId: inputListId, includeSubtasks = true, statuses } = inputData;
    
    // Get list ID from input or environment
    const listId = inputListId || getEnvVar('CLICKUP_LIST_ID');
    const apiToken = getEnvVar('CLICKUP_API_TOKEN');
    
    // Note: CLICKUP_TEAM_ID and CLICKUP_SPACE_ID are not required for fetching tasks

    // Build query parameters
    const params = new URLSearchParams({
      include_subtasks: includeSubtasks.toString(),
    });

    if (statuses && statuses.length > 0) {
      statuses.forEach(status => params.append('statuses[]', status));
    }

    const url = `${CLICKUP_API_BASE}/list/${listId}/task?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
        if (response.status === 429) {
          throw new Error('ClickUp API rate limit exceeded. Please try again later.');
        }
        if (response.status === 401) {
          throw new Error('Invalid ClickUp API token. Please check your CLICKUP_API_TOKEN environment variable.');
        }
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ClickUpApiResponse;

      // Validate and parse tasks
      const tasks: ClickUpTask[] = data.tasks.map(task => {
        try {
          return ClickUpTaskSchema.parse(task);
        } catch (error) {
          console.warn(`Failed to parse task ${task.id}:`, error);
          // Return a minimal valid task object
          return {
            id: task.id,
            name: task.name || 'Untitled Task',
            description: task.description || null,
            status: { status: task.status?.status || 'unknown' },
            assignees: task.assignees || [],
            priority: task.priority || null,
            tags: task.tags || [],
            due_date: task.due_date || null,
            custom_fields: task.custom_fields || [],
            url: task.url || '',
          };
        }
      });

      return {
        tasks,
        listId,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('ClickUp API request timed out after 30 seconds');
        }
        throw error;
      }
      throw new Error('Unknown error occurred while fetching ClickUp tasks');
    }
  },
});
