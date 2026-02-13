import { Mastra } from '@mastra/core';
import { ticketAnalyzerAgent } from '../agents/ticket-analyzer.js';

// Create Mastra instance
export const mastra = new Mastra({
  agents: {
    'ticket-analyzer': ticketAnalyzerAgent,
  },
});

// Re-export getEnvVar for backward compatibility
export { getEnvVar } from '../utils/env.js';

export default mastra;
