import { z } from "zod";

export const premarketQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  refresh: z.union([z.string(), z.boolean()]).optional().transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return value === "true" || value === "1";
  })
});
