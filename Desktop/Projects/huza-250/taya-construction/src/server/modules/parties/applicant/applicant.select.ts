// APPLICANT SELECT: admin only (date of birth and gender are never public), and its types.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { PartiesOut } from "../parties.dates";
import type { ApplicantDetails } from "./applicant.schema";

export const applicantListSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  dateOfBirth: true,
  gender: true,
  trade: true,
  district: true,
  cvUrl: true, // mapped to hasCv by the service, never returned
  createdAt: true,
  _count: { select: { applications: true } },
} satisfies Prisma.ApplicantSelect;

// D-1: applications (operations) through the locked schema's relation.
export const applicantDetailSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  dateOfBirth: true,
  gender: true,
  trade: true,
  experience: true,
  district: true,
  cvUrl: true, // mapped to cvLink by the service, never returned
  details: true,
  consentAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  applications: {
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      workforceRequest: { select: { id: true, number: true, role: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  },
} satisfies Prisma.ApplicantSelect;

export const applicantRefSelect = { id: true, fullName: true } satisfies Prisma.ApplicantSelect;

type Row<S extends Prisma.ApplicantSelect> = Prisma.ApplicantGetPayload<{ select: S }>;
export type ApplicantListItem = PartiesOut<Omit<Row<typeof applicantListSelect>, "cvUrl">> & { hasCv: boolean; age: number };
export type ApplicantDetail = PartiesOut<Omit<Row<typeof applicantDetailSelect>, "cvUrl" | "details">> & {
  details: ApplicantDetails | null;
  hasCv: boolean;
  cvLink: string | null;
  age: number;
  can: { delete: boolean };
};
export type ApplicantRef = Row<typeof applicantRefSelect>;
export type ApplicantListPage = Page<ApplicantListItem>;
