import type { ISignatureZone, ISigningFormData, ICertificateInfo } from "@/types";
import forge from "node-forge";

/**
 * Build a FormData payload ready to send to the signing backend.
 * Contains: file, signature position (bottom-left PDF coords), .pfx certificate, password, optional signature image.
 */
export function buildSigningFormData(
  file: File,
  zones: ISignatureZone[],
  certificateFile: File,
  certificatePassword: string,
  signatureImage?: File | null,
): ISigningFormData {
  const formData = new FormData();

  // The PDF document to sign
  formData.append("file", file, file.name);

  // Signature position — bottom-left PDF coordinates of the first (only) zone
  const zone = zones[0];
  if (zone) {
    formData.append("signaturePosition", JSON.stringify({
      pageIndex: zone.pageIndex,
      x: Math.round(zone.x),
      y: Math.round(zone.y),
      width: Math.round(zone.width),
      height: Math.round(zone.height),
    }));
  }

  // Digital certificate (.pfx / .p12)
  formData.append("certificate", certificateFile, certificateFile.name);

  // Certificate password (already verified client-side)
  formData.append("certificatePassword", certificatePassword);

  // Optional hand-signature image
  if (signatureImage) {
    formData.append("signatureImage", signatureImage, signatureImage.name);
  }

  return { formData, zones };
}

/**
 * Parse and validate a .pfx / .p12 certificate using a password.
 * Runs entirely client-side with node-forge.
 * Returns certificate info if valid, throws on failure.
 */
export async function parsePfxCertificate(
  pfxBuffer: ArrayBuffer,
  password: string
): Promise<ICertificateInfo> {
  const der = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer));
  const asn1 = forge.asn1.fromDer(der);

  let pkcs12: forge.pkcs12.Pkcs12Pfx;
  try {
    pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new Error("Invalid certificate password. Please try again.");
  }

  const bags = pkcs12.getBags({ bagType: forge.pki.oids.certBag });
  const certBags = bags[forge.pki.oids.certBag];

  if (!certBags || certBags.length === 0) {
    throw new Error("No certificates found in the PFX file.");
  }

  const cert = certBags[0].cert;
  if (!cert) {
    throw new Error("Could not read certificate data.");
  }

  const subject = cert.subject;
  const issuer = cert.issuer;

  const getAttr = (attrs: forge.pki.CertificateField[], oid: string): string => {
    const found = attrs.find((a) => a.shortName === oid || a.name === oid);
    return found ? String(found.value) : "";
  };

  const now = new Date();
  const validFrom = cert.validity.notBefore;
  const validTo = cert.validity.notAfter;
  const isValid = now >= validFrom && now <= validTo;

  return {
    commonName: getAttr(subject.attributes, "CN") || "Unknown",
    organization: getAttr(subject.attributes, "O") || undefined,
    email: getAttr(subject.attributes, "E") || getAttr(subject.attributes, "emailAddress") || undefined,
    issuer: getAttr(issuer.attributes, "CN") || getAttr(issuer.attributes, "O") || "Unknown Issuer",
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    serialNumber: cert.serialNumber,
    isValid,
  };
}

/**
 * Verify that a certificate password is correct for a .pfx file.
 */
export async function verifyCertificatePassword(
  pfxBuffer: ArrayBuffer,
  password: string
): Promise<boolean> {
  try {
    await parsePfxCertificate(pfxBuffer, password);
    return true;
  } catch {
    return false;
  }
}
