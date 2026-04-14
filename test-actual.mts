/**
 * Test: Import the actual signPdf and extractSignatures from the project.
 * This runs the exact same code path as the server actions.
 */

// We need to run this with tsx to handle TypeScript
const { signPdf, extractSignatures, verifySignature } = await import("./src/lib/pdf-signature.js") as any;
import forge from "node-forge";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function main() {
  console.log("=== Creating test certificate ===");
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
  console.log("PFX size:", pfxBytes.length, "bytes");

  // Create a test PDF
  console.log("\n=== Creating test PDF ===");
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Test document for digital signature verification", { x: 50, y: 700, size: 16, font });
  const pdfBytes = new Uint8Array(await pdfDoc.save());
  console.log("PDF size:", pdfBytes.length, "bytes");

  // Sign the PDF using the actual signPdf function
  console.log("\n=== Signing PDF ===");
  const position = { pageIndex: 0, x: 100, y: 100, width: 200, height: 50 };
  const signedPdf = await signPdf(pdfBytes, pfxBytes, "test123", position);
  console.log("Signed PDF size:", signedPdf.length, "bytes");

  // Now extract signatures — this is the exact same path as verifyDocument
  console.log("\n=== Extracting signatures ===");
  const sigs = extractSignatures(signedPdf);
  console.log("Signatures found:", sigs.length);

  if (sigs.length > 0) {
    console.log("\n=== Verifying signature ===");
    for (const sig of sigs) {
      console.log("Signer:", sig.signerName);
      console.log("Date:", sig.signDate);
      console.log("Reason:", sig.reason);
      console.log("ByteRange:", sig.byteRange);
      console.log("ContentsHex length:", sig.contentsHex.length);

      try {
        const result = verifySignature(signedPdf, sig);
        console.log("Verification result:", JSON.stringify(result, null, 2));
      } catch (err) {
        console.error("Verification error:", err);
      }
    }
  } else {
    console.log("❌ No signatures found! Dumping debug info...");

    // Check raw bytes
    const str = String.fromCharCode.apply(null, Array.from(signedPdf.slice(0, 100)));
    console.log("First 100 bytes:", JSON.stringify(str));

    // Look for ByteRange in the raw bytes
    const fullStr = [];
    const CHUNK = 8192;
    for (let i = 0; i < signedPdf.length; i += CHUNK) {
      fullStr.push(String.fromCharCode(...signedPdf.subarray(i, Math.min(i + CHUNK, signedPdf.length))));
    }
    const text = fullStr.join("");
    
    const brIdx = text.indexOf("/ByteRange");
    console.log("/ByteRange at index:", brIdx);
    if (brIdx >= 0) {
      console.log("Context:", JSON.stringify(text.slice(brIdx, brIdx + 100)));
    }
    
    const contIdx = text.indexOf("/Contents <");
    console.log("/Contents < at index:", contIdx);
    if (contIdx >= 0) {
      console.log("Context:", JSON.stringify(text.slice(contIdx, contIdx + 50)));
    }
  }
}

main().catch(console.error);
