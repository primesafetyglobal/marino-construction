import("./src/lib/pdf-signature.js").then(m => {
  console.log("Module keys:", Object.keys(m));
  console.log("Has extractSignatures:", typeof m.extractSignatures);
  console.log("Has signPdf:", typeof m.signPdf);
  console.log("Has parsePfx:", typeof m.parsePfx);
  console.log("Has verifySignature:", typeof m.verifySignature);
  console.log("Has checkCertification:", typeof m.checkCertification);
}).catch(e => console.error("Error:", e.message));
