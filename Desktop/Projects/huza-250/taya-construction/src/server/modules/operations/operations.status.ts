// OPERATIONS STATUS: allowed status moves per request type (OPS-R4). CLIENT-SAFE:
// the status stepper shows only the moves the server would accept.

export const EQUIPMENT_REQUEST_MOVES: Record<string, readonly string[]> = {
  NEW: ["QUOTED", "CONFIRMED", "CANCELLED"],
  QUOTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ACTIVE", "COMPLETED", "CANCELLED"], // ACTIVE: rent only; COMPLETED: buy only (OPS-R5)
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const SUPPLY_ORDER_MOVES: Record<string, readonly string[]> = {
  NEW: ["QUOTED", "CONFIRMED", "CANCELLED"],
  QUOTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const SERVICE_REQUEST_MOVES: Record<string, readonly string[]> = {
  NEW: ["QUOTED", "SCHEDULED", "CANCELLED"],
  QUOTED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "DELIVERED", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const WORKFORCE_REQUEST_MOVES: Record<string, readonly string[]> = {
  NEW: ["RECRUITING", "CLOSED"],
  RECRUITING: ["FILLED", "CLOSED"],
  FILLED: ["RECRUITING", "CLOSED"],
  CLOSED: [],
};

export const APPLICATION_MOVES: Record<string, readonly string[]> = {
  NEW: ["SHORTLISTED", "PLACED", "REJECTED"],
  SHORTLISTED: ["NEW", "PLACED", "REJECTED"],
  PLACED: ["SHORTLISTED", "REJECTED"],
  REJECTED: ["NEW", "SHORTLISTED"],
};

// Equipment requests also depend on the type (OPS-R5).
export function equipmentRequestMoves(status: string, type: "RENT" | "BUY"): string[] {
  return (EQUIPMENT_REQUEST_MOVES[status] ?? []).filter((to) => {
    if (status === "CONFIRMED" && to === "ACTIVE") return type === "RENT";
    if (status === "CONFIRMED" && to === "COMPLETED") return type === "BUY";
    return true;
  });
}

export function canMove(moves: Record<string, readonly string[]>, from: string, to: string): boolean {
  return (moves[from] ?? []).includes(to);
}

export const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DELIVERED: "Delivered",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  RECRUITING: "Recruiting",
  FILLED: "Filled",
  CLOSED: "Closed",
  SHORTLISTED: "Shortlisted",
  PLACED: "Placed",
  REJECTED: "Rejected",
};
