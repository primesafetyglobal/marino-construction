/**
 * Test with a larger PDF to check if the extraction works with bigger files.
 * Also save the signed PDF so we can manually test uploading it.
 */
const { signPdf, extractSignatures, verifySignature } = await import("./src/lib/pdf-signature.js");
import forge from "node-forge";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";

// Create a self-signed cert
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "01";
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
const attrs = [
  { name: "commonName", value: "Test Signer" },
  { name: "organizationName", value: "Test Org" },
];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "test123");
const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const pfxBytes = new Uint8Array(p12Der.length);
for (let i = 0; i < p12Der.length; i++) {
  pfxBytes[i] = p12Der.charCodeAt(i);
}

// Save cert as PFX for manual testing
fs.writeFileSync("test-cert.pfx", pfxBytes);
console.log("Saved test-cert.pfx (password: test123)");

// Create a larger PDF with multiple pages and lots of text
const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

for (let p = 0; p < 5; p++) {
  const page = pdfDoc.addPage([612, 792]);
  for (let i = 0; i < 30; i++) {
    page.drawText(`Page ${p + 1}, Line ${i + 1}: This is a test document with enough content to make it reasonably sized for testing purposes.`, {
      x: 50,
      y: 750 - i * 22,
      size: 9,
      font,
    });
  }
}

const pdfBytes = new Uint8Array(await pdfDoc.save());
console.log("Original PDF size:", pdfBytes.length, "bytes");

// Save unsigned PDF for reference
fs.writeFileSync("test-unsigned.pdf", pdfBytes);

// Sign it
const position = { pageIndex: 0, x: 350, y: 50, width: 200, height: 50 };
const signedPdf = await signPdf(pdfBytes, pfxBytes, "test123", position);
console.log("Signed PDF size:", signedPdf.length, "bytes");

// Save signed PDF
fs.writeFileSync("test-signed-output.pdf", signedPdf);
console.log("Saved test-signed-output.pdf");

// Verify
const sigs = extractSignatures(signedPdf);
console.log("\nSignatures found:", sigs.length);

if (sigs.length > 0) {
  for (const sig of sigs) {
    const result = verifySignature(signedPdf, sig);
    console.log("Valid:", result.isValid, "| Tampered:", result.isTampered, "| Signer:", result.signerInfo.name);
  }
  console.log("\n✅ All good! Upload test-signed-output.pdf to the verify page to test.");
} else {
  console.log("\n❌ No signatures found in signed PDF");
}

// Also test: simulate what verifyDocument does (read from file as if from FormData)
console.log("\n=== Simulating file upload ===");
const readBack = new Uint8Array(fs.readFileSync("test-signed-output.pdf"));
console.log("Read back size:", readBack.length, "bytes");
console.log("Bytes match original:", Buffer.compare(signedPdf, readBack) === 0);

const sigs2 = extractSignatures(readBack);
console.log("Signatures from re-read file:", sigs2.length);
