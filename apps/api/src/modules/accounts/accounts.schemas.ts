import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startingBalance: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase())
});

export const updateAccountSchema = createAccountSchema.partial();
