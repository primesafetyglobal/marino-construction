/**
 * End-to-end test: create a PDF, sign it, then run extractSignatures.
 * Uses forge to create a self-signed cert for testing.
 */
import forge from "node-forge";
import { PDFDocument, PDFName, PDFHexString, PDFString, PDFArray, PDFNumber, StandardFonts, rgb } from "pdf-lib";

const SIGNATURE_MAX_LENGTH = 16384;

function uint8ToBinaryString(buf) {
  const CHUNK = 8192;
  let out = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    out += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return out;
}

function latin1Decode(buf) {
  const chunks = [];
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...buf.subarray(i, Math.min(i + CHUNK, buf.length))));
  }
  return chunks.join("");
}

function latin1Encode(str) {
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
}

function pad10(n) {
  return String(n).padStart(10, "0");
}

function trimPkcs7Hex(hex) {
  if (hex.length < 4) return "";
  const tag = parseInt(hex.slice(0, 2), 16);
  if (tag !== 0x30) {
    return hex.replace(/0+$/, "");
  }
  const lenByte = parseInt(hex.slice(2, 4), 16);
  let totalBytes;
  if (lenByte < 0x80) {
    totalBytes = 2 + lenByte;
  } else {
    const numLenBytes = lenByte & 0x7F;
    if (numLenBytes === 0 || numLenBytes > 4) {
      return hex.replace(/0+$/, "");
    }
    const lenHex = hex.slice(4, 4 + numLenBytes * 2);
    if (lenHex.length < numLenBytes * 2) {
      return hex.replace(/0+$/, "");
    }
    const contentLen = parseInt(lenHex, 16);
    totalBytes = 1 + 1 + numLenBytes + contentLen;
  }
  const realHexLen = totalBytes * 2;
  if (realHexLen > 0 && realHexLen <= hex.length) {
    return hex.slice(0, realHexLen);
  }
  return hex.replace(/0+$/, "");
}

// Create a self-signed certificate for testing
function createTestCert() {
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
  
  // Create PFX
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "test123");
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const pfxBytes = new Uint8Array(p12Der.length);
  for (let i = 0; i < p12Der.length; i++) {
    pfxBytes[i] = p12Der.charCodeAt(i);
  }
  
  return { pfxBytes, privateKey: keys.privateKey, certificate: cert };
}

async function main() {
  console.log("=== Creating test certificate ===");
  const { pfxBytes, privateKey, certificate } = createTestCert();
  console.log("PFX size:", pfxBytes.length, "bytes");

  // 1. Create a minimal PDF
  console.log("\n=== Creating test PDF ===");
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Test document for digital signature", { x: 50, y: 700, size: 18, font });
  const originalPdf = new Uint8Array(await pdfDoc.save());
  console.log("Original PDF size:", originalPdf.length, "bytes");

  // 2. Build PDF with signature placeholder (mimicking buildPdfWithSignaturePlaceholder)
  console.log("\n=== Building signature placeholder ===");
  const pdfDoc2 = await PDFDocument.load(originalPdf, { updateMetadata: false });
  const pages2 = pdfDoc2.getPages();
  const page2 = pages2[0];
  const context = pdfDoc2.context;

  const sigDict = context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
  });

  const byteRangePlaceholderArr = PDFArray.withContext(context);
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  sigDict.set(PDFName.of("ByteRange"), byteRangePlaceholderArr);
  sigDict.set(PDFName.of("Contents"), PDFHexString.of("0".repeat(SIGNATURE_MAX_LENGTH)));
  sigDict.set(PDFName.of("Name"), PDFString.of("Test Signer"));
  sigDict.set(PDFName.of("M"), PDFString.of("D:20250101120000+00'00'"));
  sigDict.set(PDFName.of("Reason"), PDFString.of("Testing"));
  sigDict.set(PDFName.of("Location"), PDFString.of("Test Location"));

  const sigDictRef = context.register(sigDict);
  const widgetDict = context.obj({
    Type: "Annot", Subtype: "Widget", FT: "Sig",
    Rect: [100, 100, 300, 150],
    V: sigDictRef, T: PDFString.of("Signature1"), F: 132, P: page2.ref,
  });
  const widgetRef = context.register(widgetDict);

  const pageDict = page2.node;
  const newAnnots = PDFArray.withContext(context);
  newAnnots.push(widgetRef);
  pageDict.set(PDFName.of("Annots"), newAnnots);

  const catalog = pdfDoc2.catalog;
  const fieldsArr = PDFArray.withContext(context);
  fieldsArr.push(widgetRef);
  const newAcroForm = context.obj({ SigFlags: 3 });
  newAcroForm.set(PDFName.of("Fields"), fieldsArr);
  catalog.set(PDFName.of("AcroForm"), newAcroForm);

  let savedBytes = new Uint8Array(await pdfDoc2.save({ useObjectStreams: false }));
  console.log("PDF with placeholder size:", savedBytes.length, "bytes");

  // 3. insertByteRangePlaceholder
  let str = latin1Decode(savedBytes);
  const placeholder9 = "9999999999 9999999999 9999999999 9999999999";
  const idx9 = str.indexOf(placeholder9);
  console.log("placeholder9 found at:", idx9);
  if (idx9 === -1) throw new Error("Cannot find placeholder9");
  const replacement = "0000000000 0000000000 0000000000 0000000000";
  savedBytes.set(latin1Encode(replacement), idx9);
  str = latin1Decode(savedBytes);

  // 4. patchByteRange
  const contentsHex = "0".repeat(SIGNATURE_MAX_LENGTH);
  const contentsStart = str.indexOf("<" + contentsHex + ">");
  console.log("/Contents <000...> found at:", contentsStart);
  if (contentsStart === -1) throw new Error("Cannot find /Contents hex placeholder");

  const contentsEnd = contentsStart + 1 + SIGNATURE_MAX_LENGTH + 1;
  const byteRange = [0, contentsStart, contentsEnd, savedBytes.length - contentsEnd];
  console.log("ByteRange:", byteRange);

  const placeholder0 = "0000000000 0000000000 0000000000 0000000000";
  const plIdx = str.indexOf(placeholder0);
  const brValues = `${pad10(byteRange[0])} ${pad10(byteRange[1])} ${pad10(byteRange[2])} ${pad10(byteRange[3])}`;
  savedBytes.set(latin1Encode(brValues), plIdx);
  str = latin1Decode(savedBytes);

  // 5. Compute digest
  const md = forge.md.sha256.create();
  md.update(uint8ToBinaryString(savedBytes.slice(byteRange[0], byteRange[0] + byteRange[1])));
  md.update(uint8ToBinaryString(savedBytes.slice(byteRange[2], byteRange[2] + byteRange[3])));
  const digestBytes = md.digest().getBytes();

  // 6. Build PKCS#7 (simplified)
  const now = new Date();
  const authenticatedAttrs = forge.asn1.create(
    forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(forge.pki.oids.contentType).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
            forge.asn1.oidToDer(forge.pki.oids.data).getBytes()),
        ]),
      ]),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(forge.pki.oids.signingTime).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTCTIME, false,
            forge.asn1.dateToUtcTime(now)),
        ]),
      ]),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(forge.pki.oids.messageDigest).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
            digestBytes),
        ]),
      ]),
    ],
  );

  const attrsAsSet = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true,
    authenticatedAttrs.value,
  );
  const attrsDer = forge.asn1.toDer(attrsAsSet).getBytes();
  const attrsMd = forge.md.sha256.create();
  attrsMd.update(attrsDer);
  const signature = privateKey.sign(attrsMd);

  // Build issuer DN
  const issuerAttrs = certificate.issuer.attributes.map((attr) =>
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(attr.type).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL,
          attr.type === "2.5.4.3" ? forge.asn1.Type.UTF8 : forge.asn1.Type.PRINTABLESTRING,
          false, String(attr.value)),
      ]),
    ])
  );

  const serialHex = certificate.serialNumber;
  const serialBytes = forge.util.hexToBytes(serialHex);

  const certAsn1 = forge.pki.certificateToAsn1(certificate);
  const certDer = forge.asn1.toDer(certAsn1).getBytes();

  const signerInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, "\x01"),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, issuerAttrs),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, serialBytes),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer("2.16.840.1.101.3.4.2.1").getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
    ]),
    authenticatedAttrs,
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer(forge.pki.oids.rsaEncryption).getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, signature),
  ]);

  const signedData = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
      forge.asn1.oidToDer(forge.pki.oids.signedData).getBytes()),
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, "\x01"),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
              forge.asn1.oidToDer("2.16.840.1.101.3.4.2.1").getBytes()),
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
          ]),
        ]),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
            forge.asn1.oidToDer(forge.pki.oids.data).getBytes()),
        ]),
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            certAsn1,  // Use the ASN1 directly
          ]),
        ]),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [signerInfo]),
      ]),
    ]),
  ]);

  const pkcs7Der = forge.asn1.toDer(signedData).getBytes();
  console.log("\nPKCS#7 DER size:", pkcs7Der.length, "bytes");

  // Convert to hex
  let pkcs7Hex = "";
  for (let i = 0; i < pkcs7Der.length; i++) {
    pkcs7Hex += pkcs7Der.charCodeAt(i).toString(16).padStart(2, "0");
  }
  console.log("PKCS#7 hex length:", pkcs7Hex.length, "chars");

  // 7. Inject signature
  const padded = pkcs7Hex.padEnd(SIGNATURE_MAX_LENGTH, "0");
  savedBytes.set(latin1Encode(padded), contentsStart + 1);
  str = latin1Decode(savedBytes);

  console.log("\n=== Final signed PDF ===");
  console.log("Size:", savedBytes.length, "bytes");

  // 8. Now test extractSignatures
  console.log("\n=== Testing extractSignatures ===\n");

  const brIdx = str.indexOf("/ByteRange");
  console.log("/ByteRange found at:", brIdx);
  if (brIdx >= 0) {
    console.log("/ByteRange context:", JSON.stringify(str.slice(brIdx, brIdx + 80)));
  }

  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const brMatch = byteRangeRegex.exec(str);
  if (brMatch) {
    console.log("✅ ByteRange matched:", brMatch[0]);
    
    const searchStart = Math.max(0, brMatch.index - 4096);
    const searchEnd = Math.min(str.length, brMatch.index + brMatch[0].length + 24576);
    const neighbourhood = str.slice(searchStart, searchEnd);
    console.log("Neighbourhood size:", neighbourhood.length);

    // Check if /Contents exists in neighbourhood
    const cIdx = neighbourhood.indexOf("/Contents");
    console.log("/Contents found at offset:", cIdx, "in neighbourhood");
    if (cIdx >= 0) {
      console.log("/Contents context (50 chars):", JSON.stringify(neighbourhood.slice(cIdx, cIdx + 50)));
    }

    const contentsMatch = neighbourhood.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
    if (contentsMatch) {
      console.log("✅ /Contents matched, raw hex length:", contentsMatch[1].length);
      const trimmed = trimPkcs7Hex(contentsMatch[1]);
      console.log("   Trimmed hex length:", trimmed.length);
      console.log("   First 20 chars of trimmed:", trimmed.slice(0, 20));

      if (trimmed.length > 0) {
        console.log("\n🎉 extractSignatures would return 1 signature!");
      } else {
        console.log("\n❌ trimPkcs7Hex returned empty string!");
      }
    } else {
      console.log("❌ /Contents regex did NOT match in neighbourhood");
      
      // Additional debug: check for the < and > around hex
      if (cIdx >= 0) {
        const afterContents = neighbourhood.slice(cIdx + 9, cIdx + 20);
        console.log("After /Contents:", JSON.stringify(afterContents));
        
        // Check if we can see the closing >
        const hexStart = neighbourhood.indexOf("<", cIdx);
        const hexEnd = neighbourhood.indexOf(">", hexStart + 1);
        console.log("< at offset:", hexStart, "> at offset:", hexEnd);
        if (hexStart >= 0 && hexEnd >= 0) {
          console.log("Hex content length:", hexEnd - hexStart - 1);
          console.log("First 40 chars of hex:", neighbourhood.slice(hexStart + 1, hexStart + 41));
        }
      }
    }
  } else {
    console.log("❌ ByteRange regex did NOT match");
  }

  // Save the signed PDF for external inspection
  const fs = await import("fs");
  fs.writeFileSync("test-signed.pdf", savedBytes);
  console.log("\nSaved test-signed.pdf for inspection");
}

main().catch(console.error);
