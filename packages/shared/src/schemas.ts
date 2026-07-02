import { z } from "zod";

const metadataSchema = z.record(z.string(), z.unknown());
const isoTimestampSchema = z.string().datetime();

export const RunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED"
]);

export const WorkflowStepSchema = z.enum([
  "RECEIVED_INPUT",
  "VALIDATING_PLAN",
  "PARSING_CHANGES",
  "RUNNING_POLICY_CHECKS",
  "CALCULATING_RISK",
  "WRITING_REPORT",
  "COMPLETED",
  "FAILED"
]);

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const RecommendationSchema = z.enum(["APPROVE", "REVIEW", "BLOCK"]);

export const CreateRunSourceSchema = z.enum(["paste", "upload", "sample"]);

export const ResourceChangeActionSchema = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "REPLACE",
  "READ",
  "NO_OP"
]);

export const RunSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  source: CreateRunSourceSchema,
  status: RunStatusSchema,
  currentStep: WorkflowStepSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  startedAt: isoTimestampSchema.optional(),
  completedAt: isoTimestampSchema.optional()
});

export const RunEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  step: WorkflowStepSchema,
  status: RunStatusSchema,
  message: z.string(),
  createdAt: isoTimestampSchema,
  metadata: metadataSchema.optional()
});

export const FindingSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  recommendation: RecommendationSchema,
  resourceAddress: z.string().optional(),
  metadata: metadataSchema.optional()
});

export const PolicyResultSchema = z.object({
  policyId: z.string(),
  name: z.string(),
  passed: z.boolean(),
  severity: SeveritySchema,
  recommendation: RecommendationSchema,
  findingIds: z.array(z.string()),
  message: z.string().optional(),
  durationMs: z.number().nonnegative().optional()
});

export const ResourceChangeSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  create: z.number().int().nonnegative(),
  update: z.number().int().nonnegative(),
  delete: z.number().int().nonnegative(),
  replace: z.number().int().nonnegative(),
  read: z.number().int().nonnegative(),
  noOp: z.number().int().nonnegative()
});

export const ResourceChangeSchema = z.object({
  address: z.string(),
  action: ResourceChangeActionSchema,
  type: z.string(),
  name: z.string(),
  moduleAddress: z.string().optional(),
  providerName: z.string().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: metadataSchema.optional()
});

export const RunResultSchema = z.object({
  runId: z.string(),
  recommendation: RecommendationSchema,
  summary: ResourceChangeSummarySchema,
  changes: z.array(ResourceChangeSchema),
  findings: z.array(FindingSchema),
  policyResults: z.array(PolicyResultSchema),
  generatedAt: isoTimestampSchema
});

export const RunErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  step: WorkflowStepSchema.optional(),
  details: metadataSchema.optional()
});

export const CreateRunRequestSchema = z.object({
  name: z.string().optional(),
  source: CreateRunSourceSchema,
  planJson: z.unknown()
});

export const CreateRunResponseSchema = z.object({
  run: RunSchema
});

export const ListRunsResponseSchema = z.object({
  runs: z.array(RunSchema)
});

export const GetRunResponseSchema = z.object({
  run: RunSchema
});

export const GetRunEventsResponseSchema = z.object({
  events: z.array(RunEventSchema)
});

export const GetRunResultResponseSchema = z.object({
  result: RunResultSchema.nullable(),
  error: RunErrorSchema.optional()
});
