"use server";

import type { IVerificationReport, ISignerVerification } from "@/types";
import {
  extractSignatures,
  verifySignature,
  checkCertification,
} from "@/lib/pdf-signature";

/**
 * Server action: Verify all digital signatures in a PDF document.
 *
 * Expects a FormData with:
 *   - file: the signed PDF to verify
 *
 * Returns IVerificationReport with:
 *   - isValid: all signatures are valid and no tampering detected
 *   - isCertified: has DocMDP certification
 *   - certificationLevel: permission level if certified
 *   - signers[]: full info for each signer
 *   - modifiedAfterSigning: whether bytes were added after the last signature
 *   - signatureCount: total signatures found
 */
export async function verifyDocument(formData: FormData): Promise<IVerificationReport> {
  try {
    // ── 1. Extract the file ──
    const file = formData.get("file") as File | null;
    if (!file) {
      return {
        isValid: false,
        isCertified: false,
        signers: [],
        modifiedAfterSigning: false,
        signatureCount: 0,
        error: "No file provided.",
      };
    }

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    console.log("[verifyDocument] File received:", file.name, "size:", pdfBytes.length, "bytes");

    // Quick sanity check: does this look like a PDF?
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    console.log("[verifyDocument] File header:", JSON.stringify(header));

    // ── 2. Extract all signatures ──
    const signatures = extractSignatures(pdfBytes);
    console.log("[verifyDocument] Signatures found:", signatures.length);

    if (signatures.length === 0) {
      return {
        isValid: false,
        isCertified: false,
        signers: [],
        modifiedAfterSigning: false,
        signatureCount: 0,
        error: "No digital signatures found in this document.",
      };
    }

    // ── 3. Verify each signature ──
    const signers: ISignerVerification[] = [];
    let allValid = true;
    let anyTampered = false;

    for (const sig of signatures) {
      const result = verifySignature(pdfBytes, sig);

      if (!result.isValid) allValid = false;
      if (result.isTampered) anyTampered = true;

      signers.push({
        name: result.signerInfo.name,
        organization: result.signerInfo.organization,
        email: result.signerInfo.email,
        issuer: result.signerInfo.issuer,
        serialNumber: result.signerInfo.serialNumber,
        signedAt: sig.signDate ?? new Date().toISOString(),
        validFrom: result.signerInfo.validFrom,
        validTo: result.signerInfo.validTo,
        isSignatureValid: result.isValid,
        isCertificateExpired: result.signerInfo.isExpired,
        isTampered: result.isTampered,
        coverageStatus: result.coverageStatus,
      });
    }

    // ── 4. Check for DocMDP certification ──
    const certification = checkCertification(pdfBytes);

    // ── 5. Check if document was modified after the last signature ──
    const lastSig = signatures[signatures.length - 1];
    const [, , r2Start, r2Len] = lastSig.byteRange;
    const modifiedAfterSigning = r2Start + r2Len < pdfBytes.length;

    return {
      isValid: allValid && !anyTampered,
      isCertified: certification.isCertified,
      certificationLevel: certification.certificationLevel,
      signers,
      modifiedAfterSigning,
      signatureCount: signatures.length,
    };
  } catch (err) {
    console.error("[verifyDocument] Error:", err);
    return {
      isValid: false,
      isCertified: false,
      signers: [],
      modifiedAfterSigning: false,
      signatureCount: 0,
      error: err instanceof Error ? err.message : "Verification failed.",
    };
  }
}
