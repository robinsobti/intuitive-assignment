import type { z } from "zod";
import type {
  CreateRunRequestSchema,
  CreateRunResponseSchema,
  CreateRunSourceSchema,
  FindingSchema,
  GetRunEventsResponseSchema,
  GetRunResponseSchema,
  GetRunResultResponseSchema,
  ListRunsResponseSchema,
  PolicyResultSchema,
  RecommendationSchema,
  ResourceChangeActionSchema,
  ResourceChangeSchema,
  ResourceChangeSummarySchema,
  RunErrorSchema,
  RunEventSchema,
  RunResultSchema,
  RunSchema,
  RunStatusSchema,
  SeveritySchema,
  WorkflowStepSchema
} from "./schemas.js";

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type CreateRunSource = z.infer<typeof CreateRunSourceSchema>;
export type ResourceChangeAction = z.infer<typeof ResourceChangeActionSchema>;

export type Run = z.infer<typeof RunSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type PolicyResult = z.infer<typeof PolicyResultSchema>;
export type ResourceChangeSummary = z.infer<
  typeof ResourceChangeSummarySchema
>;
export type ResourceChange = z.infer<typeof ResourceChangeSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
export type RunError = z.infer<typeof RunErrorSchema>;

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
export type ListRunsResponse = z.infer<typeof ListRunsResponseSchema>;
export type GetRunResponse = z.infer<typeof GetRunResponseSchema>;
export type GetRunEventsResponse = z.infer<typeof GetRunEventsResponseSchema>;
export type GetRunResultResponse = z.infer<typeof GetRunResultResponseSchema>;
