import { z } from 'zod';

// ClickUp Task Schema
export const ClickUpTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  status: z.object({
    status: z.string(),
    color: z.string().optional(),
  }),
  assignees: z.array(z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().optional(),
  })).optional(),
  priority: z.object({
    id: z.string(),
    priority: z.string(),
    color: z.string(),
  }).nullable().optional(),
  tags: z.array(z.object({
    name: z.string(),
    tag_fg: z.string().optional(),
    tag_bg: z.string().optional(),
  })).optional(),
  due_date: z.string().nullable().optional(),
  custom_fields: z.array(z.any()).optional(),
  url: z.string().optional(),
});

export type ClickUpTask = z.infer<typeof ClickUpTaskSchema>;

// Codebase Map Schema
export const RouteInfoSchema = z.object({
  path: z.string(),
  files: z.array(z.string()),
  exports: z.array(z.string()).optional(),
});

export const CodebaseMapSchema = z.object({
  routes: z.array(RouteInfoSchema),
  components: z.array(z.string()),
  actions: z.array(z.string()),
  scannedAt: z.string().optional(),
});

export type RouteInfo = z.infer<typeof RouteInfoSchema>;
export type CodebaseMap = z.infer<typeof CodebaseMapSchema>;

// Ticket Analysis Schema
export const TicketAnalysisSchema = z.object({
  qualityScore: z.number().min(1).max(5),
  qualityGaps: z.array(z.string()),
  affectedFiles: z.array(z.string()),
  complexityTag: z.enum(['fix', 'feature']),
  suggestedApproach: z.string(),
});

export type TicketAnalysis = z.infer<typeof TicketAnalysisSchema>;

// Analyzed Ticket (combines ClickUp task with analysis)
export const AnalyzedTicketSchema = z.object({
  ticket: ClickUpTaskSchema,
  analysis: TicketAnalysisSchema,
});

export type AnalyzedTicket = z.infer<typeof AnalyzedTicketSchema>;

// Sprint Data Schema
export const SprintMetadataSchema = z.object({
  syncTimestamp: z.string(),
  ticketCount: z.number(),
  listId: z.string(),
  listName: z.string().optional(),
});

export const SprintDataSchema = z.object({
  tickets: z.array(AnalyzedTicketSchema),
  metadata: SprintMetadataSchema,
});

export type SprintMetadata = z.infer<typeof SprintMetadataSchema>;
export type SprintData = z.infer<typeof SprintDataSchema>;

// Webhook Payload Schema
export const WebhookPayloadSchema = z.object({
  sprintMarkdown: z.string(),
  tickets: z.array(AnalyzedTicketSchema),
  metadata: SprintMetadataSchema,
  signature: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Tool Input Schemas
export const ClickUpSyncInputSchema = z.object({
  listId: z.string().optional(),
  includeSubtasks: z.boolean().default(true),
  statuses: z.array(z.string()).optional(),
});

export type ClickUpSyncInput = z.infer<typeof ClickUpSyncInputSchema>;

export const AnalyzeTicketInputSchema = z.object({
  ticket: ClickUpTaskSchema,
  codebaseMap: CodebaseMapSchema,
});

export type AnalyzeTicketInput = z.infer<typeof AnalyzeTicketInputSchema>;

export const SprintFormatterInputSchema = z.object({
  tickets: z.array(AnalyzedTicketSchema),
  metadata: SprintMetadataSchema,
});

export type SprintFormatterInput = z.infer<typeof SprintFormatterInputSchema>;

// Workflow Input Schema
export const SprintSyncInputSchema = z.object({
  listId: z.string().optional(),
  codebaseMap: CodebaseMapSchema,
  webhookUrl: z.string().url(),
  webhookSecret: z.string().optional(),
});

export type SprintSyncInput = z.infer<typeof SprintSyncInputSchema>;
