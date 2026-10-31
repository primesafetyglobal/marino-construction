// CATALOG SELECT: types several catalog folders share. Types only.

export type UploadTicket = {
  uploadUrl: string;
  headers: Record<string, string>;
  uploadToken: string;
  expiresAt: string;
};

export type Spec = { label: string; value: string };
