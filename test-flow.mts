/**
 * Test: simulate the full flow from sign → base64 encode → base64 decode → verify
 * This tests the exact same code path as the server actions + client download.
 */
const pdfSig = await import("./src/lib/pdf-signature.js");
const { signPdf, parsePfx, extractSignatures, verifySignature, checkCertification } = pdfSig;
import forge from "node-forge";
import { PDFDocument, StandardFonts } from "pdf-lib";

// 1. Create test cert
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "01";
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
cert.setSubject([{ name: "commonName", value: "John Doe" }, { name: "organizationName", value: "Acme Corp" }]);
cert.setIssuer([{ name: "commonName", value: "John Doe" }, { name: "organizationName", value: "Acme Corp" }]);
cert.sign(keys.privateKey, forge.md.sha256.create());

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "password");
const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const pfxBytes = new Uint8Array(p12Der.length);
for (let i = 0; i < p12Der.length; i++) pfxBytes[i] = p12Der.charCodeAt(i);

// 2. Create test PDF
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([612, 792]);
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText("Contract Agreement - CONFIDENTIAL", { x: 50, y: 700, size: 18, font });
page.drawText("This is a legally binding document.", { x: 50, y: 660, size: 12, font });
const pdfBytes = new Uint8Array(await pdfDoc.save());
console.log("Original PDF:", pdfBytes.length, "bytes");

// ──── SIMULATE signDocument SERVER ACTION ────
console.log("\n=== Step 1: signDocument server action ===");
const signedBytes = await signPdf(pdfBytes, pfxBytes, "password", {
  pageIndex: 0, x: 350, y: 50, width: 200, height: 50,
});
console.log("Signed PDF:", signedBytes.length, "bytes");

// Server action converts to base64
const base64 = Buffer.from(signedBytes).toString("base64");
console.log("Base64 length:", base64.length);

// ──── SIMULATE CLIENT DOWNLOAD ────
console.log("\n=== Step 2: Client download (base64 → Uint8Array) ===");
// This is exactly what the client does: Uint8Array.from(atob(base64), c => c.charCodeAt(0))
const decoded = Buffer.from(base64, "base64");
const downloadedBytes = new Uint8Array(decoded);
console.log("Downloaded PDF:", downloadedBytes.length, "bytes");
console.log("Bytes match:", Buffer.compare(Buffer.from(signedBytes), Buffer.from(downloadedBytes)) === 0);

// ──── SIMULATE verifyDocument SERVER ACTION ────
console.log("\n=== Step 3: verifyDocument server action ===");
// This is exactly what happens when the user uploads the downloaded file
const pdfBytesForVerify = downloadedBytes; // Same as: new Uint8Array(await file.arrayBuffer())

const signatures = extractSignatures(pdfBytesForVerify);
console.log("Signatures found:", signatures.length);

if (signatures.length === 0) {
  console.log("❌ ERROR: No digital signatures found!");
  process.exit(1);
}

let allValid = true;
for (const sig of signatures) {
  const result = verifySignature(pdfBytesForVerify, sig);
  console.log(`\nSigner: ${result.signerInfo.name}`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Tampered: ${result.isTampered}`);
  console.log(`  Coverage: ${result.coverageStatus}`);
  console.log(`  Org: ${result.signerInfo.organization}`);
  console.log(`  Issuer: ${result.signerInfo.issuer}`);
  if (!result.isValid) allValid = false;
}

const certification = checkCertification(pdfBytesForVerify);
console.log("\nCertified:", certification.isCertified);

console.log("\n" + (allValid ? "✅ FULL FLOW WORKS!" : "❌ VERIFICATION FAILED"));
