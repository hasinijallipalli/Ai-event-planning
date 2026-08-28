import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { campusDatasetSchema } from "./campus-data";
import { planSchema } from "./plan-schema";

export const createPlan = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        requirement: z.string().min(5),
        dataset: campusDatasetSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { runPlanner } = await import("./plan.server");
    return await runPlanner(data.requirement, data.dataset);
  });

export const replan = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        plan: planSchema,
        disruption: z.string().min(3),
        dataset: campusDatasetSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { runReplanner } = await import("./plan.server");
    return await runReplanner(data.plan, data.disruption, data.dataset);
  });
