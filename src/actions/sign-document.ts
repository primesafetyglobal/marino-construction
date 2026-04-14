"use server";

import type { ISignResult } from "@/types";
import { signPdf, parsePfx } from "@/lib/pdf-signature";

/**
 * Server action: Digitally sign a PDF document with a .pfx certificate.
 *
 * Expects a FormData with:
 *   - file: the PDF to sign
 *   - signaturePosition: JSON string { pageIndex, x, y, width, height }
 *   - certificate: the .pfx file
 *   - certificatePassword: string
 *
 * Returns ISignResult with the signed PDF as a base-64 string.
 */
export async function signDocument(formData: FormData): Promise<ISignResult> {
  try {
    // ── 1. Extract inputs ──
    const file = formData.get("file") as File | null;
    const certFile = formData.get("certificate") as File | null;
    const certPassword = (formData.get("certificatePassword") as string) ?? "";
    const positionJson = formData.get("signaturePosition") as string | null;
    const signatureImage = formData.get("signatureImage") as File | null;

    if (!file) return { success: false, error: "No PDF file provided." };
    if (!certFile) return { success: false, error: "No certificate (.pfx) provided." };
    if (!positionJson) return { success: false, error: "No signature position provided." };

    const position = JSON.parse(positionJson) as {
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    // ── 2. Read files into Uint8Arrays ──
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const pfxBytes = new Uint8Array(await certFile.arrayBuffer());
    const sigImageBytes = signatureImage
      ? new Uint8Array(await signatureImage.arrayBuffer())
      : undefined;

    // ── 3. Validate the certificate password first ──
    try {
      parsePfx(pfxBytes, certPassword);
    } catch {
      return { success: false, error: "Invalid certificate password." };
    }

    // ── 4. Sign the PDF ──
    const signedBytes = await signPdf(pdfBytes, pfxBytes, certPassword, position, sigImageBytes);

    // ── 5. Extract signer name from the certificate ──
    const { certificate } = parsePfx(pfxBytes, certPassword);
    const cn =
      certificate.subject.attributes.find(
        (a) => a.shortName === "CN" || a.name === "CN"
      )?.value ?? "Unknown";

    // ── 6. Return base-64 encoded PDF for client-side download ──
    const base64 = Buffer.from(signedBytes).toString("base64");

    return {
      success: true,
      signedPdfBase64: base64,
      signedAt: new Date().toISOString(),
      signer: String(cn),
    };
  } catch (err) {
    console.error("[signDocument] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unknown error occurred during signing.",
    };
  }
}
