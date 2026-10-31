// CONTACT CHECK QUERIES (flow). Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { getRequestMeta } from "@/server/validation/request";
import { contactCheckSchema } from "./contact-check.schema";
import * as contactCheckService from "./contact-check.service";

// PUBLIC: lets returning clients, vendors and applicants type only their phone
// or email. Returns only { known }; rate-limited; never cached.
export const checkContact = createQuery({
  access: "public",
  schema: contactCheckSchema,
  handler: async ({ input }) => contactCheckService.checkContact(input, await getRequestMeta()),
});
