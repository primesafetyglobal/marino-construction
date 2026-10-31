// CLIENT SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { listQuery } from "@/server/validation/pagination";
import {
  checkCompany,
  checkPhoneOrEmail,
  hasChanges,
  id,
  optionalEmail,
  optionalPhone,
  optionalText,
  PARTY_TYPES,
  requiredText,
  tin,
} from "../parties.fields";

const fields = {
  name: requiredText(2, 120),
  phone: optionalPhone,
  email: optionalEmail,
  entityType: z.enum(PARTY_TYPES).default("INDIVIDUAL"),
  companyName: optionalText(160),
  tin,
  district: optionalText(80),
  notes: optionalText(4000),
};

export const createClientSchema = z.strictObject(fields).superRefine((d, ctx) => {
  checkPhoneOrEmail(d, ctx);
  checkCompany(d, ctx);
});

export const updateClientSchema = z
  .strictObject({
    id,
    name: fields.name.optional(),
    phone: fields.phone.optional(),
    email: fields.email.optional(),
    entityType: z.enum(PARTY_TYPES).optional(),
    companyName: fields.companyName,
    tin: fields.tin.optional(),
    district: fields.district,
    notes: fields.notes,
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const clientIdSchema = z.strictObject({ id });

export const listClientsSchema = listQuery;
export const getClientSchema = z.object({ id });

export type CreateClientInput = z.input<typeof createClientSchema>;
export type CreateClientData = z.output<typeof createClientSchema>;
export type UpdateClientInput = z.input<typeof updateClientSchema>;
export type UpdateClientData = z.output<typeof updateClientSchema>;
export type ClientIdData = z.output<typeof clientIdSchema>;
export type ListClientsData = z.output<typeof listClientsSchema>;
