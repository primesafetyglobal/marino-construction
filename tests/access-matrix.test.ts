// The access matrix (DNSA 28.2): every exported action and query, with the
// access it must have. D-3: allowed roles come from the static role map, which
// must reproduce Architecture §6.

import { beforeAll, describe, expect, it } from "vitest";
import { ALL_KEYS, DECLARED_KEYS, ROLE_PERMISSIONS, type Role } from "@/server/validation/auth";
import { makeUser, resetDb, settle, signInAs, type TestUser } from "./auth/fixtures";

import * as categoryActions from "@/server/modules/catalog/category/category.actions";
import * as categoryQueries from "@/server/modules/catalog/category/category.queries";
import * as equipmentActions from "@/server/modules/catalog/equipment/equipment.actions";
import * as equipmentQueries from "@/server/modules/catalog/equipment/equipment.queries";
import * as productActions from "@/server/modules/catalog/product/product.actions";
import * as productQueries from "@/server/modules/catalog/product/product.queries";
import * as serviceActions from "@/server/modules/catalog/service/service.actions";
import * as serviceQueries from "@/server/modules/catalog/service/service.queries";
import * as trainingActions from "@/server/modules/catalog/training/training.actions";
import * as trainingQueries from "@/server/modules/catalog/training/training.queries";
import * as searchQueries from "@/server/modules/catalog/search/search.queries";
import * as eqReqActions from "@/server/modules/operations/equipment-request/equipment-request.actions";
import * as eqReqQueries from "@/server/modules/operations/equipment-request/equipment-request.queries";
import * as soActions from "@/server/modules/operations/supply-order/supply-order.actions";
import * as soQueries from "@/server/modules/operations/supply-order/supply-order.queries";
import * as srActions from "@/server/modules/operations/service-request/service-request.actions";
import * as srQueries from "@/server/modules/operations/service-request/service-request.queries";
import * as wrActions from "@/server/modules/operations/workforce-request/workforce-request.actions";
import * as wrQueries from "@/server/modules/operations/workforce-request/workforce-request.queries";
import * as jaActions from "@/server/modules/operations/job-application/job-application.actions";
import * as jaQueries from "@/server/modules/operations/job-application/job-application.queries";
import * as dashboardQueries from "@/server/modules/operations/dashboard/dashboard.queries";
import * as clientActions from "@/server/modules/parties/client/client.actions";
import * as clientQueries from "@/server/modules/parties/client/client.queries";
import * as vendorActions from "@/server/modules/parties/vendor/vendor.actions";
import * as vendorQueries from "@/server/modules/parties/vendor/vendor.queries";
import * as applicantActions from "@/server/modules/parties/applicant/applicant.actions";
import * as applicantQueries from "@/server/modules/parties/applicant/applicant.queries";
import * as paymentActions from "@/server/modules/parties/payment/payment.actions";
import * as paymentQueries from "@/server/modules/parties/payment/payment.queries";
import * as contactQueries from "@/server/modules/parties/contact-check/contact-check.queries";
import * as userActions from "@/server/modules/access/user/user.actions";
import * as userQueries from "@/server/modules/access/user/user.queries";
import * as authEventActions from "@/server/modules/access/auth-event/auth-event.actions";
import * as authEventQueries from "@/server/modules/access/auth-event/auth-event.queries";
import * as reviewActions from "@/server/modules/access/review/review.actions";
import * as reviewQueries from "@/server/modules/access/review/review.queries";
import * as fileActions from "@/server/modules/filing/file/file.actions";
import * as fileQueries from "@/server/modules/filing/file/file.queries";
import * as fileStorageActions from "@/server/modules/filing/file-storage/file-storage.actions";
import * as fileStorageQueries from "@/server/modules/filing/file-storage/file-storage.queries";
import * as fileSettingsActions from "@/server/modules/filing/file-settings/file-settings.actions";
import * as fileSettingsQueries from "@/server/modules/filing/file-settings/file-settings.queries";
import * as fileBackupActions from "@/server/modules/filing/file-backup/file-backup.actions";
import * as fileBackupQueries from "@/server/modules/filing/file-backup/file-backup.queries";
import * as jobsActions from "@/server/modules/filing/jobs/jobs.actions";
import * as jobsQueries from "@/server/modules/filing/jobs/jobs.queries";
import { PERMISSIONS as CATALOG_PERMISSIONS } from "@/server/modules/catalog/catalog.permissions";
import { PERMISSIONS as OPS_PERMISSIONS } from "@/server/modules/operations/operations.permissions";
import { PERMISSIONS as PARTIES_PERMISSIONS } from "@/server/modules/parties/parties.permissions";
import { PERMISSIONS as ACCESS_PERMISSIONS } from "@/server/modules/access/access.permissions";

const MODULES = [
  categoryActions, categoryQueries, equipmentActions, equipmentQueries, productActions, productQueries, serviceActions, serviceQueries, trainingActions, trainingQueries, searchQueries,
  eqReqActions, eqReqQueries, soActions, soQueries, srActions, srQueries, wrActions, wrQueries, jaActions, jaQueries, dashboardQueries,
  clientActions, clientQueries, vendorActions, vendorQueries, applicantActions, applicantQueries, paymentActions, paymentQueries, contactQueries,
  userActions, userQueries, authEventActions, authEventQueries, reviewActions, reviewQueries,
  fileActions, fileQueries, fileStorageActions, fileStorageQueries, fileSettingsActions, fileSettingsQueries, fileBackupActions, fileBackupQueries, jobsActions, jobsQueries,
] as Record<string, unknown>[];

type Access = "public" | "authenticated" | string[];
const P = "public" as const;
const READ_ANY_REQUEST = ["equipment-request:read", "supply-order:read", "service-request:read", "workforce-request:read"];

// name → access (and an input when {} would not reach the access check meaningfully)
const ENTRIES: Record<string, { access: Access; input?: unknown }> = {
  // catalog
  createCategory: { access: ["category:create"] }, updateCategory: { access: ["category:update"] }, deleteCategory: { access: ["category:delete"] },
  listCategories: { access: P }, getCategory: { access: P }, getCategoryBySlug: { access: P }, getCategoriesByType: { access: P }, getCategoriesByDivision: { access: P },
  createEquipment: { access: ["equipment:create"] }, updateEquipment: { access: ["equipment:update"] }, setEquipmentStatus: { access: ["equipment:update"] }, approveEquipment: { access: ["equipment:approve"] }, deleteEquipment: { access: ["equipment:delete"] },
  submitEquipment: { access: P }, createEquipmentUploadTicket: { access: P },
  createCatalogUploadTicket: { access: ["equipment:create", "equipment:update", "product:create", "product:update", "service:create", "service:update", "training:create", "training:update", "category:create", "category:update"] },
  listEquipment: { access: P }, getEquipment: { access: P }, getEquipmentBySlug: { access: P }, getFeaturedEquipment: { access: P },
  listEquipmentAdmin: { access: ["equipment:read"] }, getEquipmentAdmin: { access: ["equipment:read"] }, getPendingEquipmentCount: { access: ["equipment:read"] },
  createProduct: { access: ["product:create"] }, updateProduct: { access: ["product:update"] }, deleteProduct: { access: ["product:delete"] },
  listProducts: { access: P }, getProduct: { access: P }, getProductBySlug: { access: P }, getFeaturedProducts: { access: P }, getPaintProducts: { access: P },
  listProductsAdmin: { access: ["product:read"] }, getProductAdmin: { access: ["product:read"] },
  createService: { access: ["service:create"] }, updateService: { access: ["service:update"] }, deleteService: { access: ["service:delete"] },
  listServices: { access: P }, getService: { access: P }, getServiceBySlug: { access: P }, getServicesByDivision: { access: P }, getFeaturedServices: { access: P },
  listServicesAdmin: { access: ["service:read"] }, getServiceAdmin: { access: ["service:read"] },
  createTraining: { access: ["training:create"] }, updateTraining: { access: ["training:update"] }, deleteTraining: { access: ["training:delete"] },
  listTrainings: { access: P }, getTraining: { access: P }, getPublishedTrainings: { access: P }, getFeaturedTrainings: { access: P },
  listTrainingsAdmin: { access: ["training:read"] }, getTrainingAdmin: { access: ["training:read"] },
  searchCatalog: { access: P },
  // operations
  submitEquipmentRequest: { access: P }, createEquipmentRequest: { access: ["equipment-request:create"] }, updateEquipmentRequest: { access: ["equipment-request:update"] }, setEquipmentRequestStatus: { access: ["equipment-request:update"] }, setEquipmentRequestHandler: { access: ["equipment-request:update"] },
  listEquipmentRequests: { access: ["equipment-request:read"] }, getEquipmentRequest: { access: ["equipment-request:read"] }, getEquipmentRentHistory: { access: ["equipment-request:read", "equipment:read"] },
  submitSupplyOrder: { access: P }, createSupplyOrder: { access: ["supply-order:create"] }, updateSupplyOrder: { access: ["supply-order:update"] }, setSupplyOrderStatus: { access: ["supply-order:update"] }, setSupplyOrderHandler: { access: ["supply-order:update"] },
  listSupplyOrders: { access: ["supply-order:read"] }, getSupplyOrder: { access: ["supply-order:read"] },
  submitServiceRequest: { access: P }, createServiceRequest: { access: ["service-request:create"] }, updateServiceRequest: { access: ["service-request:update"] }, setServiceRequestStatus: { access: ["service-request:update"] }, setServiceRequestHandler: { access: ["service-request:update"] }, createDeliveryReportUploadTicket: { access: ["service-request:update"] },
  listServiceRequests: { access: ["service-request:read"] }, getServiceRequest: { access: ["service-request:read"] },
  submitWorkforceRequest: { access: P }, createWorkforceRequest: { access: ["workforce-request:create"] }, updateWorkforceRequest: { access: ["workforce-request:update"] }, publishJob: { access: ["workforce-request:publish"] }, unpublishJob: { access: ["workforce-request:publish"] }, setWorkforceRequestStatus: { access: ["workforce-request:update"] }, setWorkforceRequestHandler: { access: ["workforce-request:update"] },
  listWorkforceRequests: { access: ["workforce-request:read"] }, getWorkforceRequest: { access: ["workforce-request:read"] }, getOpenJobs: { access: P }, getJobByNumber: { access: P },
  submitApplication: { access: P }, setApplicationStatus: { access: ["job-application:update"] }, deleteApplication: { access: ["job-application:delete"] },
  listApplications: { access: ["job-application:read"] }, getApplication: { access: ["job-application:read"] }, getApplicationsByRequest: { access: ["job-application:read"] }, getApplicationsByApplicant: { access: ["job-application:read"] },
  getOperationsDashboard: { access: READ_ANY_REQUEST }, getOperationsCounters: { access: READ_ANY_REQUEST },
  // parties
  createClient: { access: ["client:create"] }, updateClient: { access: ["client:update"] }, deleteClient: { access: ["client:delete"] }, listClients: { access: ["client:read"] }, getClient: { access: ["client:read"] },
  createVendor: { access: ["vendor:create"] }, updateVendor: { access: ["vendor:update"] }, setVendorStatus: { access: ["vendor:update"] }, setVendorPartner: { access: ["vendor:partner"] }, deleteVendor: { access: ["vendor:delete"] },
  submitVendor: { access: P }, createPartiesUploadTicket: { access: ["vendor:update", "vendor:create", "applicant:update"] },
  listVendors: { access: ["vendor:read"] }, getVendor: { access: ["vendor:read"] }, getPartners: { access: P }, getFeaturedShops: { access: P }, getPendingVendorCount: { access: ["vendor:read"] },
  updateApplicant: { access: ["applicant:update"] }, deleteApplicant: { access: ["applicant:delete"] }, createCvUploadTicket: { access: P }, listApplicants: { access: ["applicant:read"] }, getApplicant: { access: ["applicant:read"] },
  recordPayment: { access: ["payment:record"] }, createInstallmentPlan: { access: ["payment:record"] }, markPaymentPaid: { access: ["payment:record"] }, deletePayment: { access: ["payment:delete"] },
  listPayments: { access: ["payment:read"] }, getPayment: { access: ["payment:read"] }, getPaymentsByRequest: { access: ["payment:read"] }, getOverduePayments: { access: ["payment:read"] }, getPaymentSummary: { access: ["payment:read"] }, getOverdueCount: { access: ["payment:read"] },
  checkContact: { access: P },
  // access
  inviteUser: { access: ["user:invite"] }, resendInvite: { access: ["user:invite"] }, updateUser: { access: ["user:update"] }, setUserActive: { access: ["user:update"] }, sendPasswordReset: { access: ["user:update"] }, deleteUser: { access: ["user:delete"] },
  changeOwnPassword: { access: "authenticated" }, requestEmailChange: { access: "authenticated" },
  acceptInvite: { access: P }, requestPasswordReset: { access: P }, resetPassword: { access: P }, verifyEmail: { access: P },
  listUsers: { access: ["user:read", "equipment-request:update", "supply-order:update", "service-request:update", "workforce-request:update"], input: { picker: "1" } }, getUser: { access: ["user:read"] }, getCurrentUser: { access: "authenticated" },
  listAuthEvents: { access: ["auth-event:read"] }, getAuthEvent: { access: ["auth-event:read"] }, getUserActivity: { access: ["auth-event:read"] },
  submitReview: { access: P }, setReviewStatus: { access: ["review:publish"] }, deleteReview: { access: ["review:delete"] },
  listReviews: { access: ["review:read"] }, getReview: { access: ["review:read"] }, getReviewCounters: { access: ["review:read"] }, getPublicReviews: { access: P }, getReviewSummary: { access: P },
  // filing (guide §11)
  requestFileUpload: { access: ["file:create"] }, confirmFileUpload: { access: ["file:create"] }, moveFiles: { access: ["file:update"] }, renameFile: { access: ["file:update"] },
  renameFolder: { access: ["file:update"] }, deleteFiles: { access: ["file:delete"] }, getFileAccessUrl: { access: ["file:read"] },
  listFiles: { access: ["file:read"] }, listFileFolders: { access: ["file:read"] }, getFileStats: { access: ["file:read"] }, getFile: { access: ["file:read"] }, getFileUsage: { access: ["file:read"] }, openFile: { access: ["file:read"] },
  createStorage: { access: ["file-storage:create"] }, updateStorage: { access: ["file-storage:update"] }, testStorage: { access: ["file-storage:update"] }, activateStorage: { access: ["file-storage:update"] }, deleteStorage: { access: ["file-storage:delete"] },
  listStorages: { access: ["file-storage:read"] }, getStorage: { access: ["file-storage:read"] },
  updateFileSettings: { access: ["file-settings:update"] }, getFileSettings: { access: ["file-settings:read", "file:create"] },
  createBackup: { access: ["file-backup:create"] }, deleteBackup: { access: ["file-backup:delete"] },
  listBackups: { access: ["file-backup:read"] }, getBackup: { access: ["file-backup:read"] }, getBackupEstimate: { access: ["file-backup:read"] }, getBackupDownload: { access: ["file-backup:read"] },
  runImportJob: { access: ["file:create"] }, runCheckJob: { access: ["file:update"] }, applyReferenceFixes: { access: ["file:update"] }, applyStorageFixes: { access: ["file:update"] },
  deleteAbandonedUploads: { access: ["file:delete"] }, markDiscoveryFalsePositives: { access: ["file:update"] }, changeStorageBaseUrl: { access: ["file-storage:update"] },
  startMigration: { access: ["file-storage:update"] }, resumeMigration: { access: ["file-storage:update"] }, cancelMigration: { access: ["file-storage:update"] }, finishMigration: { access: ["file-storage:update"] },
  markMigrationMissing: { access: ["file-storage:update"] }, purgeStorage: { access: ["file-storage:delete"] },
  getCurrentJob: { access: ["file:read"] }, listJobReports: { access: ["file:read"] }, getJobReport: { access: ["file:read"] }, getMigrationState: { access: ["file-storage:read"] }, getMigrationPrecheck: { access: ["file-storage:update"] },
};

// The public entry points recorded in docs/modules/*.md.
const RECORDED_PUBLIC = [
  "listCategories", "getCategory", "getCategoryBySlug", "getCategoriesByType", "getCategoriesByDivision",
  "listEquipment", "getEquipment", "getEquipmentBySlug", "getFeaturedEquipment", "submitEquipment", "createEquipmentUploadTicket",
  "listProducts", "getProduct", "getProductBySlug", "getFeaturedProducts", "getPaintProducts",
  "listServices", "getService", "getServiceBySlug", "getServicesByDivision", "getFeaturedServices",
  "listTrainings", "getTraining", "getPublishedTrainings", "getFeaturedTrainings", "searchCatalog",
  "submitEquipmentRequest", "submitSupplyOrder", "submitServiceRequest", "submitWorkforceRequest", "submitApplication", "getOpenJobs", "getJobByNumber",
  "submitVendor", "createCvUploadTicket", "getPartners", "getFeaturedShops", "checkContact",
  "acceptInvite", "requestPasswordReset", "resetPassword", "verifyEmail", "submitReview", "getPublicReviews", "getReviewSummary",
].sort();

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "STAFF"];
const allowed = (access: Access, role: Role) => access === "public" || access === "authenticated" || access.some((k) => ROLE_PERMISSIONS[role].has(k));

async function codeOf(fn: unknown, input: unknown): Promise<string> {
  const r = await settle(() => (fn as (i: unknown) => Promise<unknown>)(input));
  if (!r.ok) return r.code!;
  const d = r.data as { ok?: boolean; error?: { code: string } } | null;
  if (d && typeof d === "object" && "ok" in d && typeof d.ok === "boolean") return d.ok ? "OK" : d.error!.code;
  return "OK";
}

const users = {} as Record<Role, TestUser>;
beforeAll(async () => {
  await resetDb();
  for (const r of ROLES) users[r] = await makeUser({ role: r });
});

describe("access matrix", () => {
  it("covers every exported action and query (completeness)", () => {
    const exported = MODULES.flatMap((m) => Object.keys(m).filter((k) => typeof m[k] === "function")).sort();
    expect(exported).toEqual(Object.keys(ENTRIES).sort());
  });

  it("the public entry points are exactly the ones in the module records", () => {
    expect(Object.entries(ENTRIES).filter(([, e]) => e.access === "public").map(([n]) => n).sort()).toEqual(RECORDED_PUBLIC);
  });

  it("D-3 declared keys equal the modules' PERMISSIONS; every key in the role map is a generated or declared key", () => {
    expect([...DECLARED_KEYS].sort()).toEqual([...CATALOG_PERMISSIONS, ...OPS_PERMISSIONS, ...PARTIES_PERMISSIONS, ...ACCESS_PERMISSIONS].sort());
    for (const r of ROLES) for (const k of ROLE_PERMISSIONS[r]) expect(ALL_KEYS).toContain(k);
    for (const e of Object.values(ENTRIES)) if (Array.isArray(e.access)) for (const k of e.access) expect(ALL_KEYS).toContain(k);
  });

  it("D-3 the role map reproduces Architecture §6", () => {
    const S = ROLE_PERMISSIONS.STAFF;
    const A = ROLE_PERMISSIONS.ADMIN;
    // Catalog: Staff create / read / update; Admin+ also delete.
    for (const m of ["category", "equipment", "product", "service", "training"]) {
      for (const a of ["read", "create", "update"]) expect(S.has(`${m}:${a}`)).toBe(true);
      expect(S.has(`${m}:delete`)).toBe(false);
      expect(A.has(`${m}:delete`)).toBe(true);
    }
    // Requests, job posts, applications: Staff create / read / update; Admin deletes applications.
    for (const m of ["equipment-request", "supply-order", "service-request", "workforce-request"]) for (const a of ["read", "create", "update"]) expect(S.has(`${m}:${a}`)).toBe(true);
    expect(S.has("workforce-request:publish")).toBe(true);
    expect(S.has("job-application:delete")).toBe(false);
    expect(A.has("job-application:delete")).toBe(true);
    // Parties: Staff no delete; partner badge Admin+.
    for (const m of ["client", "vendor", "applicant"]) {
      expect(S.has(`${m}:update`)).toBe(true);
      expect(S.has(`${m}:delete`)).toBe(false);
      expect(A.has(`${m}:delete`)).toBe(true);
    }
    expect(S.has("vendor:partner")).toBe(false);
    expect(A.has("vendor:partner")).toBe(true);
    // Payments: Staff record and delete DUE (the service refuses PAID).
    expect(S.has("payment:record")).toBe(true);
    expect(S.has("payment:delete")).toBe(true);
    // Reviews: Staff publish / hide; Admin deletes.
    expect(S.has("review:publish")).toBe(true);
    expect(S.has("review:delete")).toBe(false);
    expect(A.has("review:delete")).toBe(true);
    // Users: no access for Staff; Admin and Super Admin hold the same keys (D-4 scope differs).
    for (const k of ["user:read", "user:invite", "user:update", "user:delete", "auth-event:read"]) {
      expect(S.has(k)).toBe(false);
      expect(A.has(k)).toBe(true);
    }
    // Filing (guide §11): Staff browse, upload and organise; storages, settings, backups and deletes stay with Admin+.
    for (const a of ["read", "create", "update"]) expect(S.has(`file:${a}`)).toBe(true);
    expect(S.has("file:delete")).toBe(false);
    for (const m of ["file-storage", "file-settings", "file-backup"]) {
      for (const a of ["read", "create", "update", "delete"]) {
        expect(S.has(`${m}:${a}`)).toBe(false);
        expect(A.has(`${m}:${a}`)).toBe(true);
      }
    }
    expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...A].sort());
  });

  it("a deactivated user is treated as signed out (UNAUTHENTICATED)", async () => {
    const off = await makeUser({ role: "ADMIN", active: false });
    signInAs(off);
    expect(await codeOf(clientQueries.listClients, {})).toBe("UNAUTHENTICATED");
  });

  for (const [name, entry] of Object.entries(ENTRIES)) {
    const fn = MODULES.find((m) => name in m)?.[name];
    it(`${name}: no session → ${entry.access === "public" ? "allowed" : "UNAUTHENTICATED"}; each role as the role map says`, async () => {
      signInAs(null);
      const anonymous = await codeOf(fn, entry.input ?? {});
      if (entry.access === "public") expect(anonymous).not.toBe("UNAUTHENTICATED");
      else expect(anonymous).toBe("UNAUTHENTICATED");
      for (const role of ROLES) {
        signInAs(users[role]);
        const code = await codeOf(fn, entry.input ?? {});
        if (allowed(entry.access, role)) expect([role, code]).not.toEqual([role, "FORBIDDEN"]);
        else expect([role, code]).toEqual([role, "FORBIDDEN"]);
        expect(code).not.toBe("UNAUTHENTICATED");
        expect(code).not.toBe("INTERNAL");
      }
    });
  }
});
