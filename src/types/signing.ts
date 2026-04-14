/** Signing-specific types used across the PDF signing flow */

export enum ESigningStep {
  Upload = "upload",
  PlaceSignature = "place_signature",
  Authenticate = "authenticate",
  Review = "review",
  Complete = "complete",
}

export interface ISignatureZone {
  id: string;
  pageIndex: number;
  /** PDF coordinates (bottom-left origin) */
  x: number;
  y: number;
  /** Zone dimensions in PDF points */
  width: number;
  height: number;
  /** CSS display coordinates (top-left origin, unscaled) */
  displayX: number;
  displayY: number;
  label?: string;
}

export interface IPageDimensions {
  width: number;
  height: number;
}

export interface ICertificateInfo {
  commonName: string;
  organization?: string;
  email?: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  isValid: boolean;
}

export interface ISigningPayload {
  file: File;
  signatureZones: ISignatureZone[];
  certificateFile?: File;
  certificatePassword?: string;
}

export interface ISigningFormData {
  formData: FormData;
  zones: ISignatureZone[];
}

/* ── Server action result types ── */

export interface ISignResult {
  success: boolean;
  /** Base-64 encoded signed PDF bytes (returned to client for download) */
  signedPdfBase64?: string;
  signedAt?: string;
  signer?: string;
  error?: string;
}

export interface ISignerVerification {
  name: string;
  organization?: string;
  email?: string;
  issuer: string;
  serialNumber: string;
  signedAt: string;
  validFrom: string;
  validTo: string;
  /** Cryptographic signature is mathematically valid */
  isSignatureValid: boolean;
  /** Certificate has expired */
  isCertificateExpired: boolean;
  /** PDF bytes were modified after this signature was applied */
  isTampered: boolean;
  /** "full" = signature covers entire file, "partial" = incremental save after */
  coverageStatus: "full" | "partial";
}

export interface IVerificationReport {
  /** All signatures valid and document not tampered */
  isValid: boolean;
  /** Document has a certification (DocMDP) signature */
  isCertified: boolean;
  /** Certification permission level */
  certificationLevel?: "no_changes" | "form_fill" | "annotate";
  /** Each signature found in the PDF */
  signers: ISignerVerification[];
  /** Any bytes modified after the last signature */
  modifiedAfterSigning: boolean;
  /** Total number of signatures found */
  signatureCount: number;
  error?: string;
}
