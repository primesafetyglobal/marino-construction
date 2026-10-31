// PARTIES SELECT: types several parties folders share. Types only.

export type UploadTicket = {
  uploadUrl: string;
  headers: Record<string, string>;
  uploadToken: string;
  expiresAt: string;
};

export type PayableType = "EQUIPMENT_REQUEST" | "SUPPLY_ORDER" | "SERVICE_REQUEST";
