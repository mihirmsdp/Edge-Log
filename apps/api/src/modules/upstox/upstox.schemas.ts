import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const upstoxTradeImportQuerySchema = z.object({
  mode: z.enum(["day", "range"]).default("day"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional()
}).superRefine((value, ctx) => {
  if (value.mode === "range") {
    if (!value.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "startDate is required for range mode" });
    }

    if (!value.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate is required for range mode" });
    }
  }
});

export const importUpstoxTradesSchema = z.object({
  accountId: z.string().min(1),
  mode: z.enum(["day", "range"]),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  importKeys: z.array(z.string().min(1)).min(1)
}).superRefine((value, ctx) => {
  if (value.mode === "range") {
    if (!value.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "startDate is required for range mode" });
    }

    if (!value.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate is required for range mode" });
    }
  }
});
