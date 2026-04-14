import type { EDocumentStatus, EInvitationStatus, EVerificationResult } from "./enums";

export interface IDocument {
  id: string;
  name: string;
  status: EDocumentStatus;
  lastUpdated: string;
  createdAt: string;
  signers?: ISigner[];
}

export interface ISigner {
  id: string;
  name: string;
  email: string;
  signedAt?: string;
  status: EInvitationStatus;
}

export interface IVerificationResult {
  status: EVerificationResult;
  signerName?: string;
  signerEmail?: string;
  timestamp?: string;
  certificateIssuer?: string;
  certificateSerial?: string;
  algorithm?: string;
  isValid: boolean;
}

export interface IInvitation {
  id: string;
  documentId: string;
  documentName: string;
  senderName: string;
  senderEmail: string;
  status: EInvitationStatus;
  sentAt: string;
  expiresAt: string;
}
