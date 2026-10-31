// CONTACT CHECK SCHEMA (flow): "Have you used Marino before?". CLIENT-SAFE.

import { z } from "zod";

export const contactCheckSchema = z.object({
  for: z.enum(["client", "vendor", "applicant"]),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(254).optional(),
});

export type ContactCheckData = z.output<typeof contactCheckSchema>;
