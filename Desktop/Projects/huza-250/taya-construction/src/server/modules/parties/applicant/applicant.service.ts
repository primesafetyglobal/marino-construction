// APPLICANT SERVICE: a job seeker's reusable profile with CV.
//
// Rules:
// - PTY-R1 phone / email normalised; at least one; unique
// - PTY-R3 findOrCreateApplicant: by phone, then email; the public form never
//          shows or changes a saved profile; only staff update it
// - PTY-R8 18 or older on the day of applying; consent required to create a
//          profile (consentAt); date of birth and gender admin only; an
//          applicant with applications cannot be deleted
// CVs are private files (Filing folder "cvs"): stored as the Filing URL, read through presigned links.

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { checkRateLimit } from "@/server/validation/rate-limit";
import type { RequestMeta } from "@/server/validation/request";
import { PARTIES_CONFIG } from "../parties.config";
import { ageOn, birthDateForAge, toDate, toDateOnly, today, toPartiesOut } from "../parties.dates";
import { normalizeEmail, normalizePhone } from "../parties.fields";
import { createUploadTicket, fileLink, resolveUpload } from "../parties.files";
import type { UploadTicket } from "../parties.select";
import {
  applicantDetailsSchema,
  type ApplicantDetails,
  type ApplicantIdData,
  type ListApplicantsData,
  type UpdateApplicantData,
} from "./applicant.schema";
import {
  applicantDetailSelect,
  applicantListSelect,
  applicantRefSelect,
  type ApplicantDetail,
  type ApplicantListPage,
  type ApplicantRef,
} from "./applicant.select";

type Actor = { actor: SessionUser };
type Gender = "MALE" | "FEMALE";

const readDetails = (value: unknown): ApplicantDetails | null => {
  const parsed = applicantDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

// ======================= Reads =======================

export async function listApplicants(query: ListApplicantsData): Promise<ApplicantListPage> {
  const and: Prisma.ApplicantWhereInput[] = [];
  const day = today();
  if (query.q) {
    and.push({
      OR: [
        { fullName: { contains: query.q, mode: "insensitive" } },
        { trade: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q.toLowerCase() } },
        { phone: { contains: normalizePhone(query.q) ?? query.q.replace(/\s/g, "") } },
      ],
    });
  }
  if (query.trade) and.push({ trade: { contains: query.trade, mode: "insensitive" } });
  if (query.district) and.push({ district: { contains: query.district, mode: "insensitive" } });
  if (query.gender) and.push({ gender: query.gender });
  // Age range as a date-of-birth range, so the filter runs in the database.
  if (query.minAge !== undefined) and.push({ dateOfBirth: { lte: toDate(birthDateForAge(query.minAge, day)) } });
  if (query.maxAge !== undefined) and.push({ dateOfBirth: { gt: toDate(birthDateForAge(query.maxAge + 1, day)) } });
  const rows = await db.applicant.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: applicantListSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return {
    items: page.items.map(({ cvUrl, ...rest }) => ({
      ...toPartiesOut(rest),
      hasCv: !!cvUrl,
      age: ageOn(toDateOnly(rest.dateOfBirth), day),
    })),
    nextCursor: page.nextCursor,
  };
}

export async function getApplicantDetail(id: string, ctx: Actor): Promise<ApplicantDetail | null> {
  const row = await db.applicant.findUnique({ where: { id }, select: applicantDetailSelect });
  if (!row) return null;
  const { cvUrl, details, ...rest } = row;
  return {
    ...toPartiesOut(rest),
    details: readDetails(details),
    hasCv: !!cvUrl,
    cvLink: await fileLink(cvUrl, `CV-${row.fullName}.pdf`),
    age: ageOn(toDateOnly(row.dateOfBirth), today()),
    can: { delete: hasPermission(ctx.actor, "applicant:delete") && row.applications.length === 0 },
  };
}

// ======================= Writes =======================

// PTY-R1, R8 (staff edits keep the 18+ rule for a new date of birth).
export async function updateApplicant(data: UpdateApplicantData): Promise<ApplicantRef> {
  const cvUrl = data.cvUrl ? await resolveUpload(data.cvUrl, "cv", true) : data.cvUrl;
  return db.$transaction(async (tx) => {
    const current = await tx.applicant.findUnique({ where: { id: data.id }, select: { phone: true, email: true } });
    if (!current) throw Errors.notFound("Applicant");
    const phone = data.phone !== undefined ? data.phone : current.phone;
    const email = data.email !== undefined ? data.email : current.email;
    if (!phone && !email) throw Errors.invalid("Enter a phone number or an email.", { phone: ["Enter a phone number or an email."] });
    if (data.dateOfBirth && ageOn(data.dateOfBirth, today()) < PARTIES_CONFIG.minApplicantAge) {
      throw Errors.invalid("Applicants must be 18 or older.", { dateOfBirth: ["Must be 18 or older."] });
    }
    for (const [field, value] of [["phone", data.phone], ["email", data.email]] as const) {
      if (!value) continue;
      const other = await tx.applicant.findUnique({ where: field === "phone" ? { phone: value } : { email: value }, select: { id: true } });
      if (other && other.id !== data.id) throw Errors.conflict("Another applicant already uses this value.", { [field]: ["Already in use."] });
    }
    return tx.applicant.update({
      where: { id: data.id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        dateOfBirth: data.dateOfBirth ? toDate(data.dateOfBirth) : undefined,
        gender: data.gender,
        trade: data.trade,
        experience: data.experience,
        district: data.district,
        cvUrl,
        details: data.details === undefined ? undefined : (data.details ?? undefined),
        notes: data.notes,
      },
      select: applicantRefSelect,
    });
  });
}

// PTY-R8.
export async function deleteApplicant({ id }: ApplicantIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const row = await tx.applicant.findUnique({ where: { id }, select: { _count: { select: { applications: true } } } });
    if (!row) throw Errors.notFound("Applicant");
    if (row._count.applications > 0) throw Errors.conflict("This applicant has applications and cannot be deleted.");
    await tx.applicant.delete({ where: { id } });
    return { id };
  });
}

// PUBLIC: CV upload ticket for the apply form. 10 per minute per hashed IP.
export function createCvUploadTicket(data: { mimeType: string; sizeBytes: number }, meta: RequestMeta): Promise<UploadTicket> {
  checkRateLimit({ scope: "upload-cv", ip: meta.ip, limit: 10, windowMs: 60_000 });
  return createUploadTicket({ kind: "cv", ...data });
}

// ======================= Shared with other modules (D-2) =======================

export type ApplicantInput = {
  returning: boolean;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  dateOfBirth: string | null; // "YYYY-MM-DD"
  gender: Gender | null;
  trade: string | null;
  experience: string | null;
  district: string | null;
  cv: string | null; // "upload:<token>"
  details: ApplicantDetails | null;
  consent: boolean;
};

// PTY-R3, R8: operations (submitApplication). A found profile is used as it is.
export async function findOrCreateApplicant(input: ApplicantInput, client: DbClient): Promise<{ id: string; created: boolean }> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone && !email) throw Errors.invalid("Enter a phone number or an email.", { phone: ["Enter a phone number or an email."] });
  const day = today();

  const found =
    (phone ? await client.applicant.findUnique({ where: { phone }, select: { id: true, dateOfBirth: true } }) : null) ??
    (email ? await client.applicant.findUnique({ where: { email }, select: { id: true, dateOfBirth: true } }) : null);
  if (found) {
    if (ageOn(toDateOnly(found.dateOfBirth), day) < PARTIES_CONFIG.minApplicantAge) {
      throw Errors.invalid("Applicants must be 18 or older.", { dateOfBirth: ["Must be 18 or older."] });
    }
    return { id: found.id, created: false };
  }
  if (input.returning) {
    throw Errors.invalid("We could not find your profile. Choose “No” and create it.", {
      phone: ["We could not find this phone or email."],
    });
  }

  const missing: Record<string, string[]> = {};
  if (!input.fullName || input.fullName.trim().length < 2) missing.fullName = ["Enter your full name."];
  if (!input.dateOfBirth) missing.dateOfBirth = ["Enter your date of birth."];
  if (!input.trade) missing.trade = ["Enter your trade."];
  if (!input.experience) missing.experience = ["Describe your experience."];
  if (!input.consent) missing.consent = ["Please agree so we can store your profile."];
  if (Object.keys(missing).length) throw Errors.invalid("Please complete your profile.", missing);
  if (ageOn(input.dateOfBirth!, day) < PARTIES_CONFIG.minApplicantAge) {
    throw Errors.invalid("Applicants must be 18 or older.", { dateOfBirth: ["You must be 18 or older."] });
  }
  const cvUrl = input.cv ? await resolveUpload(input.cv, "cv", false) : null;
  const created = await client.applicant.create({
    data: {
      fullName: input.fullName!.trim(),
      phone,
      email,
      dateOfBirth: toDate(input.dateOfBirth!),
      gender: input.gender,
      trade: input.trade!,
      experience: input.experience!,
      district: input.district,
      cvUrl,
      details: input.details ?? undefined,
      consentAt: new Date(),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}
