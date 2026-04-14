/**
 * Quick test: create a PDF with a signature placeholder and inspect what
 * extractSignatures would see in the raw bytes.
 */
import { PDFDocument, PDFName, PDFHexString, PDFString, PDFArray, PDFNumber, PDFDict, StandardFonts, rgb } from "pdf-lib";

const SIGNATURE_MAX_LENGTH = 16384;

function latin1Decode(buf) {
  const CHUNK = 8192;
  let out = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    out += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return out;
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

async function main() {
  // 1. Create a minimal PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Test document", { x: 50, y: 700, size: 18, font });

  // 2. Build signature dict exactly like the production code
  const context = pdfDoc.context;
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
  sigDict.set(PDFName.of("Reason"), PDFString.of("Test signing"));

  const sigDictRef = context.register(sigDict);

  const widgetDict = context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    Rect: [100, 100, 300, 150],
    V: sigDictRef,
    T: PDFString.of("Signature1"),
    F: 132,
    P: page.ref,
  });

  const widgetRef = context.register(widgetDict);

  // Add widget to page
  const pageDict = page.node;
  const newAnnots = PDFArray.withContext(context);
  newAnnots.push(widgetRef);
  pageDict.set(PDFName.of("Annots"), newAnnots);

  // Add AcroForm
  const catalog = pdfDoc.catalog;
  const fieldsArr = PDFArray.withContext(context);
  fieldsArr.push(widgetRef);
  const newAcroForm = context.obj({ SigFlags: 3 });
  newAcroForm.set(PDFName.of("Fields"), fieldsArr);
  catalog.set(PDFName.of("AcroForm"), newAcroForm);

  // 3. Save
  const savedBytes = await pdfDoc.save({ useObjectStreams: false });
  const pdf = new Uint8Array(savedBytes);
  let str = latin1Decode(pdf);

  console.log("=== PDF size:", pdf.length, "bytes ===\n");

  // 4. Check what's in the PDF around the signature
  const br9Idx = str.indexOf("9999999999");
  console.log("Index of '9999999999':", br9Idx);
  if (br9Idx >= 0) {
    // Go back to find /ByteRange
    const start = Math.max(0, br9Idx - 50);
    console.log("Context around 9999999999:", JSON.stringify(str.slice(start, br9Idx + 80)));
  }

  // 5. Apply insertByteRangePlaceholder
  const placeholder9 = "9999999999 9999999999 9999999999 9999999999";
  const idx9 = str.indexOf(placeholder9);
  console.log("\nplaceholder9 found at:", idx9);
  if (idx9 >= 0) {
    const replacement = "0000000000 0000000000 0000000000 0000000000";
    pdf.set(latin1Encode(replacement), idx9);
    str = latin1Decode(pdf);
    console.log("After replacement, context:", JSON.stringify(str.slice(idx9 - 30, idx9 + 60)));
  }

  // 6. Now simulate patchByteRange — find /Contents hex placeholder
  const contentsHex = "0".repeat(SIGNATURE_MAX_LENGTH);
  const contentsStart = str.indexOf("<" + contentsHex + ">");
  console.log("\n/Contents <000...> found at:", contentsStart);
  if (contentsStart >= 0) {
    const contentsEnd = contentsStart + 1 + SIGNATURE_MAX_LENGTH + 1;
    const range1Start = 0;
    const range1Length = contentsStart;
    const range2Start = contentsEnd;
    const range2Length = pdf.length - contentsEnd;
    console.log("ByteRange values:", [range1Start, range1Length, range2Start, range2Length]);

    // Patch
    const placeholder0 = "0000000000 0000000000 0000000000 0000000000";
    const placeholderIdx = str.indexOf(placeholder0);
    const brValues = `${pad10(range1Start)} ${pad10(range1Length)} ${pad10(range2Start)} ${pad10(range2Length)}`;
    pdf.set(latin1Encode(brValues), placeholderIdx);
    str = latin1Decode(pdf);
  }

  // 6.5. Inject fake PKCS#7 hex (like real signing would)
  const fakePkcs7Hex = "308201a006092a864886f70d010702a08201910401000201010031002f0002011102010130213019060908608648016503040201050004102a864886f70d01010b05000404deadbeef";
  if (contentsStart >= 0) {
    const padded = fakePkcs7Hex.padEnd(SIGNATURE_MAX_LENGTH, "0");
    // +1 to skip opening '<'
    pdf.set(latin1Encode(padded), contentsStart + 1);
    str = latin1Decode(pdf);
  }

  // 7. Now test extraction
  console.log("\n=== Testing extractSignatures regex ===\n");

  // Check /ByteRange
  const brIdx = str.indexOf("/ByteRange");
  console.log("/ByteRange found at:", brIdx);
  if (brIdx >= 0) {
    console.log("/ByteRange context (80 chars):", JSON.stringify(str.slice(brIdx, brIdx + 80)));
  }

  // Test the regex
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const brMatch = byteRangeRegex.exec(str);
  if (brMatch) {
    console.log("\n✅ ByteRange regex MATCHED:", brMatch[0]);
    console.log("   Values:", brMatch.slice(1, 5));

    // Now test /Contents search
    const searchStart = Math.max(0, brMatch.index - 4096);
    const searchEnd = Math.min(str.length, brMatch.index + brMatch[0].length + 24576);
    const neighbourhood = str.slice(searchStart, searchEnd);
    console.log("\nNeighbourhood size:", neighbourhood.length);

    const contentsMatch = neighbourhood.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
    if (contentsMatch) {
      console.log("✅ /Contents regex MATCHED, hex length:", contentsMatch[1].length);
    } else {
      console.log("❌ /Contents regex did NOT match");
      // Debug
      const cIdx = neighbourhood.indexOf("/Contents");
      if (cIdx >= 0) {
        console.log("   /Contents found at offset:", cIdx);
        console.log("   Context:", JSON.stringify(neighbourhood.slice(cIdx, cIdx + 60)));
        // Check what's after /Contents
        const afterContents = neighbourhood.slice(cIdx + 9, cIdx + 30);
        console.log("   After '/Contents':", JSON.stringify(afterContents));
      } else {
        console.log("   /Contents NOT FOUND in neighbourhood at all");
      }
    }
  } else {
    console.log("❌ ByteRange regex did NOT match");
    // Debug: search manually
    const testRegex = /ByteRange/g;
    const m = testRegex.exec(str);
    if (m) {
      console.log("   'ByteRange' found at:", m.index);
      console.log("   Context:", JSON.stringify(str.slice(m.index - 5, m.index + 80)));
    }
  }
}

main().catch(console.error);
