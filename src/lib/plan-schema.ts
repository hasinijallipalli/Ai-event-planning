import { z } from "zod";

export const planSchema = z.object({
  eventTitle: z.string(),
  eventType: z.string(),
  summary: z.string(),
  date: z.string().describe("YYYY-MM-DD"),
  startTime: z.string().describe("HH:MM 24h"),
  endTime: z.string().describe("HH:MM 24h"),
  expectedAttendees: z.number(),
  indoorPreferred: z.boolean(),
  recommendedVenueId: z.string().describe("id from the campus venue list"),
  venueRationale: z.string(),
  equipment: z.array(z.object({ item: z.string(), quantity: z.number(), owner: z.string() })),
  teams: z.array(z.object({ team: z.string(), headcount: z.number(), responsibility: z.string() })),
  schedule: z.array(z.object({ time: z.string(), activity: z.string(), owner: z.string() })),
  tasks: z.array(
    z.object({
      title: z.string(),
      owner: z.string(),
      due: z.string().describe("YYYY-MM-DD"),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  permissions: z.array(
    z.object({ approval: z.string(), authority: z.string(), leadTime: z.string() }),
  ),
  checklist: z.array(z.object({ category: z.string(), item: z.string() })),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
  stakeholderBrief: z.string(),
});

export type EventPlan = z.infer<typeof planSchema>;

export type PlanTaskState = { done: boolean };
