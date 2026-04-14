export const API_BASE_URL = process.env.NEXT_PUBLIC_SERVER_API ?? "";

export const ENDPOINTS = {
  SIGN_PDF: `${API_BASE_URL}/api/sign`,
  BULK_SIGN: `${API_BASE_URL}/api/bulksign/direct`,
} as const;