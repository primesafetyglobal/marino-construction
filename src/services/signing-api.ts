import axios, { AxiosError, type AxiosProgressEvent } from "axios";
import { ENDPOINTS, API_BASE_URL } from "@/lib/endpoints";
import { PdfSignRequestSchema } from "@/schema/PdfSignRequest";
import type { z } from "zod";
import { saveAs } from "file-saver";

/* ================================================================
 * Axios instance – shared config, interceptors, timeouts
 * ================================================================ */

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5 * 60 * 1000, // 5 min – generous for large PDFs
  withCredentials: false,
  headers: {
    Accept: "application/pdf, application/zip, application/octet-stream, application/json",
  },
});

// ── Response interceptor: normalise errors ──
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (axios.isCancel(error)) throw error; // let caller handle cancellation

    const status = error.response?.status;
    const data = error.response?.data;

    // Try to extract a human-readable message from the API response
    let message = "";

    // When responseType is "blob", error data comes back as a Blob – read it
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        try {
          const json = JSON.parse(text) as Record<string, unknown>;
          message =
            (json.message as string) ??
            (json.error as string) ??
            (json.detail as string) ??
            (json.title as string) ??
            text;
        } catch {
          // Not JSON – use raw text
          message = text;
        }
      } catch {
        message = "";
      }
    } else if (typeof data === "string" && data.length > 0) {
      message = data;
    } else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      message =
        (obj.message as string) ??
        (obj.error as string) ??
        (obj.detail as string) ??
        (obj.title as string) ??
        JSON.stringify(data);
    }

    // Build the final error message with status code context
    if (status && message) {
      message = `[${status}] ${message}`;
    } else if (status && !message) {
      message = `Server responded with status ${status} (${error.response?.statusText ?? "Unknown"})`;
    } else if (error.code === "ECONNABORTED") {
      message = "Request timed out – the server took too long to respond.";
    } else if (error.code === "ERR_NETWORK") {
      message = `Network error – could not reach the signing server at ${API_BASE_URL}. Ensure the API is running and CORS is configured.`;
    } else if (!message) {
      message = error.message || "An unexpected error occurred.";
    }

    console.error("[signing-api] Request failed:", {
      url: error.config?.url,
      status,
      code: error.code,
      message,
    });

    throw new Error(message);
  },
);

/* ================================================================
 * Types
 * ================================================================ */

export type PdfSignPayload = z.infer<typeof PdfSignRequestSchema>;

export interface SignApiOptions {
  /** Fields matching PdfSignRequestSchema (minus files) */
  payload: PdfSignPayload;
  /** The .pfx certificate file */
  pfx: File;
  /** The PDF to sign */
  pdf: File;
  /** Optional hand-signature image */
  image?: File | null;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Upload progress callback (0-100) */
  onUploadProgress?: (percent: number) => void;
}

export interface BulkSignApiOptions {
  /** Shared signing parameters (applied to every document) */
  payload: PdfSignPayload;
  /** The .pfx certificate file */
  pfx: File;
  /** Array of PDF files to sign */
  pdfs: File[];
  /** Optional hand-signature image */
  image?: File | null;
  /** Progress callback: (completed, total) */
  onProgress?: (completed: number, total: number) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Upload progress callback (0-100) */
  onUploadProgress?: (percent: number) => void;
}

/* ================================================================
 * Helpers
 * ================================================================ */

/** Append all PdfSignPayload fields to a FormData instance. */
function appendPayloadFields(fd: FormData, payload: PdfSignPayload): void {
  fd.append("SignerID", payload.SignerID);
  fd.append("docID", payload.docID);
  fd.append("is_SigningInfoShown", String(payload.is_SigningInfoShown));
  fd.append("is_SignatureVisible", String(payload.is_SignatureVisible));
  fd.append("height", String(payload.height));
  fd.append("width", String(payload.width));
  fd.append("offsetX", String(payload.offsetX));
  fd.append("offsetY", String(payload.offsetY));
  fd.append("page", String(payload.page));
  fd.append("password", payload.password);
}

/** Build a multipart/form-data body for a single sign request. */
function buildSignFormData(opts: SignApiOptions): FormData {
  const fd = new FormData();
  appendPayloadFields(fd, opts.payload);

  fd.append("pfx", opts.pfx, opts.pfx.name);
  fd.append("pdf", opts.pdf, opts.pdf.name);

  if (opts.image) {
    fd.append("image", opts.image, opts.image.name);
  }

  return fd;
}

/** Build a multipart/form-data body for a bulk sign request. */
function buildBulkSignFormData(opts: BulkSignApiOptions): FormData {
  const fd = new FormData();
  appendPayloadFields(fd, opts.payload);

  fd.append("pfx", opts.pfx, opts.pfx.name);

  for (const pdf of opts.pdfs) {
    fd.append("pdfs", pdf, pdf.name);
  }

  if (opts.image) {
    fd.append("image", opts.image, opts.image.name);
  }

  return fd;
}

/** Convert AxiosProgressEvent to a 0-100 percentage. */
function toPercent(e: AxiosProgressEvent): number {
  if (!e.total || e.total <= 0) return 0;
  return Math.round((e.loaded * 100) / e.total);
}

/* ================================================================
 * API calls
 * ================================================================ */

/**
 * Sign a single PDF via the external API.
 * Returns the signed PDF blob for download.
 */
export async function signPdfApi(opts: SignApiOptions): Promise<Blob> {
  PdfSignRequestSchema.parse(opts.payload);

  const fd = buildSignFormData(opts);

  const { data } = await api.post<Blob>(ENDPOINTS.SIGN_PDF, fd, {
    responseType: "blob",
    signal: opts.signal,
    onUploadProgress: opts.onUploadProgress
      ? (e) => opts.onUploadProgress!(toPercent(e))
      : undefined,
  });

  // The server may return a JSON error body with a 200 status — detect that
  if (data instanceof Blob && data.type.includes("application/json")) {
    const text = await data.text();
    let message = text;
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      message =
        (body.message as string) ??
        (body.error as string) ??
        (body.detail as string) ??
        text;
    } catch { /* raw text is fine */ }
    throw new Error(message);
  }

  return data;
}

/**
 * Bulk sign multiple PDFs via the external API.
 * Returns a zip blob containing all signed documents.
 */
export async function bulkSignPdfApi(opts: BulkSignApiOptions): Promise<Blob> {
  PdfSignRequestSchema.parse(opts.payload);

  if (opts.pdfs.length === 0) {
    throw new Error("No PDF files provided for bulk signing.");
  }

  const fd = buildBulkSignFormData(opts);

  opts.onProgress?.(0, opts.pdfs.length);

  const { data } = await api.post<Blob>(ENDPOINTS.BULK_SIGN, fd, {
    responseType: "blob",
    signal: opts.signal,
    onUploadProgress: opts.onUploadProgress
      ? (e) => opts.onUploadProgress!(toPercent(e))
      : undefined,
  });

  // The server may return a JSON error body with a 200 status — detect that
  if (data instanceof Blob && data.type.includes("application/json")) {
    const text = await data.text();
    let message = text;
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      message =
        (body.message as string) ??
        (body.error as string) ??
        (body.detail as string) ??
        text;
    } catch { /* raw text is fine */ }
    throw new Error(message);
  }

  opts.onProgress?.(opts.pdfs.length, opts.pdfs.length);

  return data;
}

/* ================================================================
 * Download helpers
 * ================================================================ */

/** Trigger a signed PDF blob download. */
export function downloadSignedPdf(blob: Blob, originalName: string): void {
  const fileName = originalName.replace(/\.pdf$/i, "-signed.pdf");
  saveAs(blob, fileName);
}

/** Trigger a bulk-signed zip blob download. */
export function downloadBulkSignedZip(blob: Blob, batchName?: string): void {
  const fileName = batchName
    ? `${batchName}-signed.zip`
    : `signed-documents-${Date.now()}.zip`;
  saveAs(blob, fileName);
}
