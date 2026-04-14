export enum EDocumentStatus {
  Draft = "draft",
  Pending = "pending",
  Signed = "signed",
  Verified = "verified",
  Declined = "declined",
}

export enum ESignatureStyle {
  Draw = "draw",
  Type = "type",
  Upload = "upload",
}

export enum EInvitationStatus {
  Pending = "pending",
  Accepted = "accepted",
  Declined = "declined",
  Expired = "expired",
}

export enum EPricingTier {
  Free = "free",
  Individual = "individual",
  Business = "business",
}

export enum EButtonSize {
  Small = "sm",
  Medium = "md",
  Large = "lg",
}

export enum EVerificationResult {
  Valid = "valid",
  Invalid = "invalid",
  Unknown = "unknown",
}
