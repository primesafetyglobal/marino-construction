// Test if JavaScript regex can handle matching very long hex strings
const hexLen = 16384;
const hex = "30" + "a".repeat(hexLen - 2) + "00".repeat(0);
const padded = hex.padEnd(hexLen, "0");
const testStr = "/Contents <" + padded + ">\n/Name (Test)";

console.log("Test string length:", testStr.length);
console.log("Hex portion length:", padded.length);

const regex = /\/Contents\s*<([0-9a-fA-F]+)>/;
const match = testStr.match(regex);

if (match) {
  console.log("✅ Regex matched, captured group length:", match[1].length);
} else {
  console.log("❌ Regex did NOT match");
}

// Now test with a very large neighbourhood (like in extractSignatures)
const before = "x".repeat(4096);  // 4KB before
const after = "x".repeat(4096);   // 4KB after
const bigStr = before + testStr + after;
console.log("\nBig string length:", bigStr.length);

const match2 = bigStr.match(regex);
if (match2) {
  console.log("✅ Big string regex matched, captured group length:", match2[1].length);
} else {
  console.log("❌ Big string regex did NOT match");
}

// Test with the neighbourhood as done in extractSignatures
// ByteRange match position, then slice neighbourhood
const fullPdf = "xyzabc /ByteRange [ 0000000000 0000001234 0000017620 0000000456 ]\n/Contents <" + padded + ">\n/Name (Test)\nmore stuff";
console.log("\nFull PDF-like string length:", fullPdf.length);

const brRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
const brMatch = brRegex.exec(fullPdf);
if (brMatch) {
  console.log("ByteRange matched at:", brMatch.index);
  const searchStart = Math.max(0, brMatch.index - 4096);
  const searchEnd = Math.min(fullPdf.length, brMatch.index + brMatch[0].length + 24576);
  const neighbourhood = fullPdf.slice(searchStart, searchEnd);
  console.log("Neighbourhood length:", neighbourhood.length);
  
  const contentsMatch = neighbourhood.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
  if (contentsMatch) {
    console.log("✅ Contents matched in neighbourhood, hex length:", contentsMatch[1].length);
  } else {
    console.log("❌ Contents did NOT match in neighbourhood");
    console.log("  /Contents index in neighbourhood:", neighbourhood.indexOf("/Contents"));
  }
} else {
  console.log("❌ ByteRange did NOT match");
}
