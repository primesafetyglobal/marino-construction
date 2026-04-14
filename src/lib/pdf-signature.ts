/**
 * PDF Digital Signature Helpers
 *
 * Uses pdf-lib for PDF structure manipulation and node-forge for PKCS#7/CMS.
 * All functions run server-side only (used by server actions).
 *
 * ── Signing flow (placeholder strategy, Adobe Reader compatible) ──
 * 1. Parse .pfx → extract private key + certificate chain
 * 2. Use pdf-lib to add a proper /Sig dictionary with /Widget annotation,
 *    /AcroForm, and a visible appearance stream showing "Digitally signed by CN"
 * 3. Save PDF with zeroed /Contents hex placeholder and /ByteRange placeholder
 * 4. Patch /ByteRange to real byte offsets
 * 5. Compute SHA-256 over the byte ranges (everything except /Contents value)
 * 6. Build PKCS#7 detached SignedData with node-forge using the real digest
 * 7. Inject hex-encoded PKCS#7 into the /Contents placeholder
 *
 * ── Verification flow ──
 * 1. Scan PDF bytes for /ByteRange entries → extract each signature's PKCS#7
 * 2. Re-hash byte ranges, verify against the embedded PKCS#7
 * 3. Extract signer certificate details
 * 4. Detect post-signing tampering & DocMDP certification
 */

import forge from "node-forge";
import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
  PDFArray,
  PDFNumber,
  PDFDict,
  StandardFonts,
  rgb,
} from "pdf-lib";

/* ================================================================
 * SHARED HELPERS
 * ================================================================ */

/**
 * Convert a Uint8Array to a binary string without blowing the call stack.
 * `String.fromCharCode.apply(null, hugeArray)` crashes for large arrays,
 * so we process in 8 KB chunks.
 */
function uint8ToBinaryString(buf: Uint8Array): string {
  const CHUNK = 8192;
  let out = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    out += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return out;
}

interface PfxContents {
  privateKey: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
  chain: forge.pki.Certificate[];
}

/**
 * Extract private key, end-entity certificate, and chain from a .pfx/.p12 file.
 */
export function parsePfx(pfxBytes: Uint8Array, password: string): PfxContents {
  const der = forge.util.binary.raw.encode(pfxBytes);
  const asn1 = forge.asn1.fromDer(der);
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags = pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag =
    keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
    pkcs12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];

  if (!keyBag?.key) throw new Error("No private key found in PFX file.");

  const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag });
  const allCerts = (certBags[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);

  if (allCerts.length === 0) throw new Error("No certificates found in PFX file.");

  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;
  const endEntity =
    allCerts.find((c) => {
      try {
        const pubPem = forge.pki.publicKeyToPem(c.publicKey);
        const privPubPem = forge.pki.publicKeyToPem(
          forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e)
        );
        return pubPem === privPubPem;
      } catch {
        return false;
      }
    }) ?? allCerts[0];

  return { privateKey, certificate: endEntity, chain: allCerts.filter((c) => c !== endEntity) };
}

/* ================================================================
 * CONSTANTS
 * ================================================================ */

/**
 * Size of the hex-encoded PKCS#7 placeholder in hex characters.
 * 8192 bytes of DER → 16384 hex chars. Generous for most certificates.
 */
const SIGNATURE_MAX_LENGTH = 16384;

/* ================================================================
 * SIGNING — pdf-lib + node-forge, Adobe Reader compatible
 * ================================================================ */

/**
 * Digitally sign a PDF with a PKCS#7 detached signature.
 * Produces a signature that is verifiable and clickable in Adobe Reader.
 *
 * @param signatureImageBytes Optional PNG/JPEG of a hand-drawn signature to embed.
 */
export async function signPdf(
  pdfBytes: Uint8Array,
  pfxBytes: Uint8Array,
  password: string,
  signaturePosition: {
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  signatureImageBytes?: Uint8Array,
): Promise<Uint8Array> {
  const { privateKey, certificate, chain } = parsePfx(pfxBytes, password);
  const cn = getCertAttr(certificate.subject.attributes, "CN") || "Digital Signer";
  const org = getCertAttr(certificate.subject.attributes, "O") || "";

  // ── 1. Build PDF with signature placeholder using pdf-lib ──
  const pdfWithPlaceholder = await buildPdfWithSignaturePlaceholder(
    pdfBytes,
    signaturePosition,
    cn,
    org,
    signatureImageBytes,
  );

  // ── 2. Patch /ByteRange to real byte offsets ──
  const { pdf: pdfWithByteRange, byteRange } = patchByteRange(pdfWithPlaceholder);

  // ── 3. Compute SHA-256 over the byte ranges ──
  const md = forge.md.sha256.create();
  md.update(uint8ToBinaryString(
    pdfWithByteRange.slice(byteRange[0], byteRange[0] + byteRange[1])
  ));
  md.update(uint8ToBinaryString(
    pdfWithByteRange.slice(byteRange[2], byteRange[2] + byteRange[3])
  ));

  // ── 4. Create PKCS#7 SignedData with the real digest ──
  const digestBytes = md.digest().bytes();
  const pkcs7Der = buildPkcs7SignedData(digestBytes, privateKey, certificate, chain);
  const pkcs7Hex = forge.util.bytesToHex(pkcs7Der);

  if (pkcs7Hex.length > SIGNATURE_MAX_LENGTH) {
    throw new Error(
      `PKCS#7 signature too large (${pkcs7Hex.length} hex chars > ${SIGNATURE_MAX_LENGTH}). Increase placeholder size.`
    );
  }

  // ── 5. Inject PKCS#7 hex into the /Contents placeholder ──
  return injectSignature(pdfWithByteRange, byteRange, pkcs7Hex);
}

/**
 * Use pdf-lib to add a proper /Sig dictionary, /Widget annotation,
 * /AcroForm entry, and visible appearance stream to the PDF.
 */
async function buildPdfWithSignaturePlaceholder(
  pdfBytes: Uint8Array,
  pos: { pageIndex: number; x: number; y: number; width: number; height: number },
  cn: string,
  org: string,
  signatureImageBytes?: Uint8Array,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const pages = pdfDoc.getPages();
  const page = pages[Math.min(pos.pageIndex, pages.length - 1)];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { x, y, width, height } = pos;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ── Draw visible signature appearance on the page ──
  if (signatureImageBytes && signatureImageBytes.length > 0) {
    // User provided a hand-signature image — embed it in the signing zone
    let image;
    try {
      image = await pdfDoc.embedPng(signatureImageBytes);
    } catch {
      // If not PNG, try JPEG
      image = await pdfDoc.embedJpg(signatureImageBytes);
    }

    // Draw a subtle background
    page.drawRectangle({
      x, y, width, height,
      color: rgb(1, 1, 1),
      opacity: 0.95,
    });

    // Scale image to fit the zone with padding
    const pad = 4;
    const imgDims = image.scaleToFit(width - pad * 2, height - pad * 2);
    const imgX = x + (width - imgDims.width) / 2;
    const imgY = y + (height - imgDims.height) / 2;
    page.drawImage(image, { x: imgX, y: imgY, width: imgDims.width, height: imgDims.height });
  } else {
    // Text-based appearance: Name + Date (+ Organization only if present)
    const fontSize1 = Math.min(7, height / 5);
    const fontSize2 = Math.min(10, height / 4);
    const lineHeight = fontSize2 * 1.4;

    page.drawRectangle({
      x, y, width, height,
      borderColor: rgb(0.2, 0.35, 0.15),
      borderWidth: 0.75,
      color: rgb(0.98, 0.99, 0.97),
      opacity: 0.95,
    });

    const textX = x + 6;
    let textY = y + height - fontSize2 - 6;

    // Name (bold)
    page.drawText(cn, { x: textX, y: textY, size: fontSize2, font: boldFont, color: rgb(0.1, 0.15, 0.05) });
    textY -= lineHeight;

    // Organization (only if present)
    if (org) {
      page.drawText(org, { x: textX, y: textY, size: fontSize1, font, color: rgb(0.35, 0.35, 0.35) });
      textY -= lineHeight * 0.85;
    }

    // Date
    page.drawText(dateStr, { x: textX, y: textY, size: fontSize1, font, color: rgb(0.4, 0.4, 0.4) });
  }

  // ── Build signature dictionary and widget annotation via raw PDF objects ──
  const context = pdfDoc.context;
  const pdfDate = toPdfDateString(now);

  // Create the /Sig value dictionary
  // IMPORTANT: /ByteRange MUST come before /Contents so that when pdf-lib
  // serializes the dict in insertion order, we can find /ByteRange before
  // the large hex placeholder when scanning the raw bytes.
  const sigDict = context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
  });

  // Add /ByteRange first with placeholder numbers that will be replaced after save.
  // CRITICAL: We use large 10-digit numbers so the serialized array has the EXACT
  // same byte length as our replacement. This prevents file size changes that would
  // invalidate the xref table generated by pdf-lib.
  const byteRangePlaceholderArr = PDFArray.withContext(context);
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  byteRangePlaceholderArr.push(PDFNumber.of(9999999999));
  sigDict.set(PDFName.of("ByteRange"), byteRangePlaceholderArr);

  // Add /Contents placeholder (zeroed hex string) — MUST come after /ByteRange
  sigDict.set(PDFName.of("Contents"), PDFHexString.of("0".repeat(SIGNATURE_MAX_LENGTH)));

  // Add remaining metadata entries
  sigDict.set(PDFName.of("Name"), PDFString.of(cn));
  sigDict.set(PDFName.of("M"), PDFString.of(pdfDate));
  sigDict.set(PDFName.of("Reason"), PDFString.of("Document digitally signed via Veriza"));
  sigDict.set(PDFName.of("Location"), PDFString.of("Veriza Digital Signing Platform"));

  const sigDictRef = context.register(sigDict);

  // Create the /Widget annotation
  const widgetDict = context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    Rect: [x, y, x + width, y + height],
    V: sigDictRef,
    T: PDFString.of("Signature1"),
    F: 132, // Print + Locked
    P: page.ref,
  });

  const widgetRef = context.register(widgetDict);

  // Add widget to the page's /Annots array
  const pageDict = page.node;
  const annots = pageDict.lookup(PDFName.of("Annots"));
  if (annots instanceof PDFArray) {
    annots.push(widgetRef);
  } else {
    const newAnnots = PDFArray.withContext(context);
    newAnnots.push(widgetRef);
    pageDict.set(PDFName.of("Annots"), newAnnots);
  }

  // Add /AcroForm to document catalog
  const catalog = pdfDoc.catalog;
  const acroForm = catalog.lookup(PDFName.of("AcroForm"));
  if (acroForm instanceof PDFDict) {
    acroForm.set(PDFName.of("SigFlags"), PDFNumber.of(3));
    const fields = acroForm.lookup(PDFName.of("Fields"));
    if (fields instanceof PDFArray) {
      fields.push(widgetRef);
    } else {
      const newFields = PDFArray.withContext(context);
      newFields.push(widgetRef);
      acroForm.set(PDFName.of("Fields"), newFields);
    }
  } else {
    const fieldsArr = PDFArray.withContext(context);
    fieldsArr.push(widgetRef);
    const newAcroForm = context.obj({
      SigFlags: 3,
    });
    newAcroForm.set(PDFName.of("Fields"), fieldsArr);
    catalog.set(PDFName.of("AcroForm"), newAcroForm);
  }

  // ── Save PDF ──
  const savedBytes = await pdfDoc.save({ useObjectStreams: false });

  // ── Replace the empty /ByteRange [] with our fixed-length placeholder ──
  return insertByteRangePlaceholder(new Uint8Array(savedBytes));
}

/**
 * After pdf-lib saves, find the /ByteRange placeholder (filled with 9999999999
 * values) and replace with our zero-padded placeholder that we'll patch later.
 * The replacement is the SAME byte length so xref offsets remain valid.
 */
function insertByteRangePlaceholder(pdf: Uint8Array): Uint8Array {
  const str = latin1Decode(pdf);

  // Find the placeholder ByteRange that pdf-lib wrote:
  // "[ 9999999999 9999999999 9999999999 9999999999 ]"
  const placeholder9 = "9999999999 9999999999 9999999999 9999999999";
  const idx = str.indexOf(placeholder9);
  if (idx === -1) throw new Error("Cannot find ByteRange placeholder (9999999999) in saved PDF.");

  // Replace with our zero-padded placeholder (same length = 43 chars)
  const replacement = "0000000000 0000000000 0000000000 0000000000";

  // Verify same length (both are 43 chars: 4×10 digits + 3 spaces)
  if (placeholder9.length !== replacement.length) {
    throw new Error("ByteRange placeholder length mismatch — this should never happen.");
  }

  const result = new Uint8Array(pdf);
  result.set(latin1Encode(replacement), idx);
  return result;
}

/**
 * Scan the PDF for our /ByteRange placeholder and fill in real byte offsets.
 */
function patchByteRange(pdf: Uint8Array): {
  pdf: Uint8Array;
  byteRange: [number, number, number, number];
} {
  const str = latin1Decode(pdf);

  // Find the /Contents hex placeholder: <0000...0000>
  const contentsHex = "0".repeat(SIGNATURE_MAX_LENGTH);
  const contentsStart = str.indexOf("<" + contentsHex + ">");
  if (contentsStart === -1) throw new Error("Cannot find /Contents hex placeholder.");

  const contentsEnd = contentsStart + 1 + SIGNATURE_MAX_LENGTH + 1; // <hex>

  // Byte ranges: everything before the hex, everything after
  const range1Start = 0;
  const range1Length = contentsStart;
  const range2Start = contentsEnd;
  const range2Length = pdf.length - contentsEnd;

  const byteRange: [number, number, number, number] = [
    range1Start, range1Length, range2Start, range2Length,
  ];

  // Find and replace the placeholder zeros
  const placeholder = "0000000000 0000000000 0000000000 0000000000";
  const placeholderIdx = str.indexOf(placeholder);
  if (placeholderIdx === -1) throw new Error("Cannot find ByteRange placeholder zeros.");

  const brValues =
    `${pad10(range1Start)} ${pad10(range1Length)} ${pad10(range2Start)} ${pad10(range2Length)}`;

  const result = new Uint8Array(pdf);
  result.set(latin1Encode(brValues), placeholderIdx);

  return { pdf: result, byteRange };
}

/**
 * Build a PKCS#7 / CMS SignedData manually with the correct document digest.
 *
 * We construct the ASN.1 structure directly to ensure:
 * - The message digest authenticated attribute contains the actual PDF digest
 * - The signature is computed over the DER-encoded authenticated attributes
 * - Adobe Reader can parse and verify the entire structure
 */
function buildPkcs7SignedData(
  digestBytes: string,
  privateKey: forge.pki.rsa.PrivateKey,
  certificate: forge.pki.Certificate,
  chain: forge.pki.Certificate[],
): string {
  const now = new Date();

  // ── Authenticated attributes ──
  const authenticatedAttrs = forge.asn1.create(
    forge.asn1.Class.CONTEXT_SPECIFIC, 0, true,
    [
      // 1. contentType = data
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(forge.pki.oids.contentType).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
            forge.asn1.oidToDer(forge.pki.oids.data).getBytes()),
        ]),
      ]),
      // 2. signingTime
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(forge.pki.oids.signingTime).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTCTIME, false,
            forge.asn1.dateToUtcTime(now)),
        ]),
      ]),
      // 3. messageDigest — THE REAL PDF DIGEST
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

  // ── Sign the authenticated attributes ──
  // Per CMS spec, sign the DER encoding of the attrs as a SET (not CONTEXT [0])
  const attrsAsSet = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true,
    authenticatedAttrs.value as forge.asn1.Asn1[],
  );
  const attrsDer = forge.asn1.toDer(attrsAsSet).getBytes();

  const attrsMd = forge.md.sha256.create();
  attrsMd.update(attrsDer);
  const signature = privateKey.sign(attrsMd);

  // ── Build issuer DN for SignerInfo ──
  const issuerAttrs = certificate.issuer.attributes.map((attr) =>
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer(attr.type!).getBytes()),
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          (attr.valueTagClass as unknown as forge.asn1.Type) ?? forge.asn1.Type.UTF8,
          false,
          String(attr.value),
        ),
      ]),
    ]),
  );

  const serialBytes = forge.util.hexToBytes(certificate.serialNumber);

  // ── SignerInfo ──
  const signerInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    // version = 1
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
      forge.util.hexToBytes("01")),
    // issuerAndSerialNumber
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, issuerAttrs),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, serialBytes),
    ]),
    // digestAlgorithm = SHA-256
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer(forge.pki.oids.sha256).getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
    ]),
    // authenticatedAttributes [0] IMPLICIT
    authenticatedAttrs,
    // signatureAlgorithm = RSA
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer(forge.pki.oids.rsaEncryption).getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
    ]),
    // signature value
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, signature),
  ]);

  // ── Certificate DER encodings ──
  const allCerts = [certificate, ...chain];
  const certsDer = allCerts.map((c) =>
    forge.asn1.fromDer(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes()),
  );

  // ── Full SignedData ──
  const signedData = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    // contentType = signedData
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
      forge.asn1.oidToDer(forge.pki.oids.signedData).getBytes()),
    // [0] EXPLICIT SignedData content
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        // version = 1
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
          forge.util.hexToBytes("01")),
        // digestAlgorithms SET
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
              forge.asn1.oidToDer(forge.pki.oids.sha256).getBytes()),
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ""),
          ]),
        ]),
        // encapContentInfo (data, no content for detached)
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
            forge.asn1.oidToDer(forge.pki.oids.data).getBytes()),
        ]),
        // certificates [0] IMPLICIT
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, certsDer),
        // signerInfos SET
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [signerInfo]),
      ]),
    ]),
  ]);

  return forge.asn1.toDer(signedData).getBytes();
}

/**
 * Inject the hex-encoded PKCS#7 into the /Contents placeholder.
 */
function injectSignature(
  pdf: Uint8Array,
  byteRange: [number, number, number, number],
  pkcs7Hex: string,
): Uint8Array {
  // The /Contents hex sits between byte range 1 end and byte range 2 start: <hex>
  const contentsStart = byteRange[0] + byteRange[1]; // position of '<'
  const padded = pkcs7Hex.padEnd(SIGNATURE_MAX_LENGTH, "0");

  const result = new Uint8Array(pdf);
  // +1 to skip the opening '<'
  result.set(latin1Encode(padded), contentsStart + 1);
  return result;
}

/* ================================================================
 * VERIFICATION
 * ================================================================ */

export interface ExtractedSignature {
  byteRange: [number, number, number, number];
  contentsHex: string;
  signerName?: string;
  signDate?: string;
  reason?: string;
  location?: string;
}

/**
 * Extract all digital signatures from a PDF file.
 *
 * Strategy: search for /ByteRange and /Contents entries directly in the
 * raw PDF text. A valid PDF digital signature always has both.
 */
export function extractSignatures(pdfBytes: Uint8Array): ExtractedSignature[] {
  const str = latin1Decode(pdfBytes);
  const signatures: ExtractedSignature[] = [];

  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let brMatch: RegExpExecArray | null;

  console.log("[extractSignatures] PDF size:", pdfBytes.length, "bytes, /ByteRange at:", str.indexOf("/ByteRange"));

  while ((brMatch = byteRangeRegex.exec(str)) !== null) {
    const byteRange: [number, number, number, number] = [
      parseInt(brMatch[1], 10),
      parseInt(brMatch[2], 10),
      parseInt(brMatch[3], 10),
      parseInt(brMatch[4], 10),
    ];

    const searchStart = Math.max(0, brMatch.index - 4096);
    // The /Contents hex can be very large (e.g. 16384+ chars), so we need a
    // wide forward search window to find the closing '>'
    const searchEnd = Math.min(str.length, brMatch.index + brMatch[0].length + 24576);
    const neighbourhood = str.slice(searchStart, searchEnd);

    const contentsMatch = neighbourhood.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
    if (!contentsMatch) {
      console.log("[extractSignatures] ByteRange found but no /Contents <hex> match nearby");
      continue;
    }

    // Extract the real PKCS#7 hex by reading the DER length from the header,
    // rather than naively stripping trailing zeros (which could corrupt the DER
    // if the actual signature bytes happen to end with 0x00).
    const rawHex = contentsMatch[1];
    const contentsHex = trimPkcs7Hex(rawHex);
    if (contentsHex.length === 0) {
      console.log("[extractSignatures] ByteRange found but PKCS#7 hex is empty after trimming");
      continue;
    }

    const nameMatch = neighbourhood.match(/\/Name\s*\(([^)]*)\)/);
    const signerName = nameMatch ? nameMatch[1] : undefined;

    const dateMatch = neighbourhood.match(/\/M\s*\(([^)]*)\)/);
    const signDate = dateMatch ? parsePdfDate(dateMatch[1]) : undefined;

    const reasonMatch = neighbourhood.match(/\/Reason\s*\(([^)]*)\)/);
    const reason = reasonMatch ? reasonMatch[1] : undefined;

    const locMatch = neighbourhood.match(/\/Location\s*\(([^)]*)\)/);
    const location = locMatch ? locMatch[1] : undefined;

    signatures.push({ byteRange, contentsHex, signerName, signDate, reason, location });
  }

  return signatures;
}

/**
 * Verify a single extracted signature against the PDF bytes.
 *
 * Strategy:
 * 1. Re-hash the byte ranges from the PDF (everything except the /Contents hex)
 * 2. Parse the PKCS#7 DER from /Contents
 * 3. Extract the message digest from the authenticated attributes
 * 4. Compare the re-computed digest with the embedded digest
 * 5. Verify the RSA signature over the authenticated attributes
 */
export function verifySignature(
  pdfBytes: Uint8Array,
  sig: ExtractedSignature,
): {
  isValid: boolean;
  isTampered: boolean;
  coverageStatus: "full" | "partial";
  signerInfo: {
    name: string;
    organization?: string;
    email?: string;
    issuer: string;
    serialNumber: string;
    validFrom: string;
    validTo: string;
    isExpired: boolean;
  };
} {
  const [r1Start, r1Len, r2Start, r2Len] = sig.byteRange;

  const coverageStatus: "full" | "partial" =
    r2Start + r2Len >= pdfBytes.length ? "full" : "partial";

  let isValid = false;
  let isTampered = false;
  let signerCert: forge.pki.Certificate | null = null;

  try {
    // ── 1. Re-compute SHA-256 digest over the signed byte ranges ──
    const md = forge.md.sha256.create();
    md.update(uint8ToBinaryString(pdfBytes.slice(r1Start, r1Start + r1Len)));
    md.update(uint8ToBinaryString(pdfBytes.slice(r2Start, r2Start + r2Len)));
    const computedDigest = md.digest().bytes();

    // ── 2. Parse the PKCS#7 / CMS SignedData from /Contents ──
    let hex = sig.contentsHex;
    if (hex.length % 2 !== 0) hex += "0";
    const derBytes = forge.util.hexToBytes(hex);
    const asn1Root = forge.asn1.fromDer(derBytes);

    // Navigate: SEQUENCE > [0] EXPLICIT > SEQUENCE (SignedData)
    const contentInfo = asn1Root.value as forge.asn1.Asn1[];
    const signedDataWrapper = contentInfo[1]; // [0] EXPLICIT
    const signedDataSeq = (signedDataWrapper.value as forge.asn1.Asn1[])[0];
    const sdChildren = signedDataSeq.value as forge.asn1.Asn1[];

    // ── 3. Extract certificates from [0] IMPLICIT SET ──
    for (const child of sdChildren) {
      if (child.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && child.constructed) {
        try {
          const certs = child.value as forge.asn1.Asn1[];
          if (certs.length > 0) {
            signerCert = forge.pki.certificateFromAsn1(certs[0]);
          }
        } catch { /* not the certificates field */ }
        break;
      }
    }

    // ── 4. Extract SignerInfo → authenticated attributes + signature ──
    // Last element in SignedData is the SET of SignerInfos
    const signerInfosSet = sdChildren[sdChildren.length - 1];
    const signerInfoSeq = (signerInfosSet.value as forge.asn1.Asn1[])[0];
    const siChildren = signerInfoSeq.value as forge.asn1.Asn1[];

    let authAttrsAsn1: forge.asn1.Asn1 | null = null;
    let signatureValue: string | null = null;
    let embeddedDigest: string | null = null;

    for (const child of siChildren) {
      // Authenticated attributes: CONTEXT [0] CONSTRUCTED
      if (child.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && child.constructed) {
        authAttrsAsn1 = child;

        // Extract messageDigest from the attributes
        const attrs = child.value as forge.asn1.Asn1[];
        for (const attr of attrs) {
          const attrChildren = attr.value as forge.asn1.Asn1[];
          if (attrChildren.length >= 2) {
            const oid = forge.asn1.derToOid((attrChildren[0].value as string));
            if (oid === forge.pki.oids.messageDigest) {
              const setVal = attrChildren[1].value as forge.asn1.Asn1[];
              if (setVal.length > 0) {
                embeddedDigest = setVal[0].value as string;
              }
            }
          }
        }
      }

      // Signature value: last OCTET STRING in SignerInfo
      if (
        child.tagClass === forge.asn1.Class.UNIVERSAL &&
        child.type === forge.asn1.Type.OCTETSTRING &&
        !child.constructed
      ) {
        signatureValue = child.value as string;
      }
    }

    // ── 5. Compare digests: embedded vs re-computed ──
    if (!embeddedDigest || !signatureValue || !authAttrsAsn1 || !signerCert) {
      isValid = false;
      isTampered = true;
    } else {
      // Check if the message digest matches what we computed from the PDF bytes
      const digestMatch = computedDigest === embeddedDigest;

      if (!digestMatch) {
        // The PDF content was modified after signing
        isValid = false;
        isTampered = true;
      } else {
        // ── 6. Verify RSA signature over authenticated attributes ──
        // Re-encode auth attrs as SET (not CONTEXT [0]) per CMS spec
        const attrsAsSet = forge.asn1.create(
          forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true,
          authAttrsAsn1.value as forge.asn1.Asn1[],
        );
        const attrsDer = forge.asn1.toDer(attrsAsSet).getBytes();

        const verifyMd = forge.md.sha256.create();
        verifyMd.update(attrsDer);

        try {
          const publicKey = signerCert.publicKey as forge.pki.rsa.PublicKey;
          const sigValid = publicKey.verify(verifyMd.digest().bytes(), signatureValue);
          isValid = sigValid;
          isTampered = !sigValid;
        } catch {
          isValid = false;
          isTampered = true;
        }
      }
    }
  } catch (err) {
    console.error("[verifySignature] Parse error:", err);
    isValid = false;
    isTampered = true;
  }

  const now = new Date();
  const signerInfo = signerCert
    ? {
        name: getCertAttr(signerCert.subject.attributes, "CN") || sig.signerName || "Unknown",
        organization: getCertAttr(signerCert.subject.attributes, "O") || undefined,
        email:
          getCertAttr(signerCert.subject.attributes, "E") ||
          getCertAttr(signerCert.subject.attributes, "emailAddress") ||
          undefined,
        issuer:
          getCertAttr(signerCert.issuer.attributes, "CN") ||
          getCertAttr(signerCert.issuer.attributes, "O") ||
          "Unknown Issuer",
        serialNumber: signerCert.serialNumber,
        validFrom: signerCert.validity.notBefore.toISOString(),
        validTo: signerCert.validity.notAfter.toISOString(),
        isExpired: now > signerCert.validity.notAfter,
      }
    : {
        name: sig.signerName || "Unknown",
        organization: undefined,
        email: undefined,
        issuer: "Unknown",
        serialNumber: "N/A",
        validFrom: "",
        validTo: "",
        isExpired: false,
      };

  return { isValid, isTampered, coverageStatus, signerInfo };
}

/**
 * Check if the PDF contains a DocMDP (certification) signature.
 */
export function checkCertification(pdfBytes: Uint8Array): {
  isCertified: boolean;
  certificationLevel?: "no_changes" | "form_fill" | "annotate";
} {
  const str = latin1Decode(pdfBytes);

  const docMdpMatch = str.match(/\/TransformMethod\s*\/DocMDP/);
  if (!docMdpMatch) return { isCertified: false };

  const afterDocMdp = str.slice(docMdpMatch.index ?? 0, (docMdpMatch.index ?? 0) + 512);
  const pMatch = afterDocMdp.match(/\/P\s+(\d)/);
  const pValue = pMatch ? parseInt(pMatch[1], 10) : 1;

  const levels: Record<number, "no_changes" | "form_fill" | "annotate"> = {
    1: "no_changes",
    2: "form_fill",
    3: "annotate",
  };

  return { isCertified: true, certificationLevel: levels[pValue] ?? "no_changes" };
}

/* ================================================================
 * UTILITY HELPERS
 * ================================================================ */

/** Decode Uint8Array to a latin-1 string (byte-to-char 1:1 mapping). */
function latin1Decode(buf: Uint8Array): string {
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...buf.subarray(i, Math.min(i + CHUNK, buf.length))));
  }
  return chunks.join("");
}

/** Encode a latin-1 string to Uint8Array. */
function latin1Encode(str: string): Uint8Array {
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
}

function pad10(n: number): string {
  return String(n).padStart(10, "0");
}

function toPdfDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `D:${y}${mo}${da}${h}${mi}${s}+00'00'`;
}

function parsePdfDate(pdfDate: string): string {
  const m = pdfDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return pdfDate;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).toISOString();
}

function getCertAttr(attrs: forge.pki.CertificateField[], oid: string): string {
  const found = attrs.find((a) => a.shortName === oid || a.name === oid);
  return found ? String(found.value) : "";
}

/**
 * Extract the real PKCS#7 hex from a zero-padded /Contents hex string.
 *
 * Instead of naively stripping trailing '0' chars (which could truncate a valid
 * DER byte like 0xA0), we read the ASN.1 top-level SEQUENCE length from the
 * first bytes to determine the exact boundary of the real data.
 */
function trimPkcs7Hex(hex: string): string {
  if (hex.length < 4) return "";

  // DER: first byte = tag (0x30 = SEQUENCE), then length encoding
  const tag = parseInt(hex.slice(0, 2), 16);
  if (tag !== 0x30) {
    // Not a SEQUENCE — fall back to stripping trailing zeros
    return hex.replace(/0+$/, "");
  }

  const lenByte = parseInt(hex.slice(2, 4), 16);
  let totalBytes: number;

  if (lenByte < 0x80) {
    // Short form: length is the byte itself
    totalBytes = 2 + lenByte; // 1 tag + 1 length + lenByte content
  } else {
    // Long form: lenByte & 0x7F = number of length bytes
    const numLenBytes = lenByte & 0x7F;
    if (numLenBytes === 0 || numLenBytes > 4) {
      return hex.replace(/0+$/, "");
    }
    const lenHex = hex.slice(4, 4 + numLenBytes * 2);
    if (lenHex.length < numLenBytes * 2) {
      return hex.replace(/0+$/, "");
    }
    const contentLen = parseInt(lenHex, 16);
    totalBytes = 1 + 1 + numLenBytes + contentLen; // tag + len-indicator + len-bytes + content
  }

  const realHexLen = totalBytes * 2;
  if (realHexLen > 0 && realHexLen <= hex.length) {
    return hex.slice(0, realHexLen);
  }

  // Fallback
  return hex.replace(/0+$/, "");
}
