// Unit tests for pure helpers (no database).

import { describe, expect, it } from "vitest";
import { fakeCode, parseCode, requestCode } from "@/server/modules/operations/operations.reference";
import { canMove, EQUIPMENT_REQUEST_MOVES, equipmentRequestMoves, SERVICE_REQUEST_MOVES, SUPPLY_ORDER_MOVES, WORKFORCE_REQUEST_MOVES } from "@/server/modules/operations/operations.status";
import { normalizePhone as partiesPhone } from "@/server/modules/parties/parties.fields";
import { normalizePhone as opsPhone } from "@/server/modules/operations/operations.fields";
import { ageOn, birthDateForAge, today } from "@/server/modules/parties/parties.dates";
import { toOpsOut } from "@/server/modules/operations/operations.dates";
import { slugify } from "@/server/modules/catalog/catalog.slug";
import { checkRateLimit, resetRateLimits } from "@/server/validation/rate-limit";
import { isBot } from "@/server/validation/public-write";
import { formatRwf, formatRwfPer } from "@/server/modules/catalog/catalog.money";

describe("unit", () => {
  it("OPS-R1 request codes: EQ-0001, SO-0001, SR-0042, WR-0001; parsing; numbers above 9999", () => {
    expect(requestCode("EQUIPMENT_REQUEST", 1)).toBe("EQ-0001");
    expect(requestCode("SUPPLY_ORDER", 1)).toBe("SO-0001");
    expect(requestCode("SERVICE_REQUEST", 42)).toBe("SR-0042");
    expect(requestCode("WORKFORCE_REQUEST", 1)).toBe("WR-0001");
    expect(requestCode("SERVICE_REQUEST", 12345)).toBe("SR-12345");
    expect(parseCode("sr-0042")).toEqual({ kind: "SERVICE_REQUEST", number: 42 });
    expect(parseCode("EQ7")).toEqual({ kind: "EQUIPMENT_REQUEST", number: 7 });
    expect(parseCode("XX-1")).toBeNull();
    expect(fakeCode("SERVICE_REQUEST")).toMatch(/^SR-\d{4}$/);
  });

  it("PTY-R1 phones are normalised to +2507XXXXXXXX (every module's copy agrees)", () => {
    for (const fn of [partiesPhone, opsPhone]) {
      expect(fn("0788 123 456")).toBe("+250788123456");
      expect(fn("+250 788-123-456")).toBe("+250788123456");
      expect(fn("250788123456")).toBe("+250788123456");
      expect(fn("788123456")).toBe("+250788123456");
      expect(fn("0688123456")).toBeNull();
      expect(fn("12345")).toBeNull();
    }
  });

  it("PTY-R8 age on a day: birthdays, leap years, the 18th birthday", () => {
    expect(ageOn("2008-10-14", "2026-10-14")).toBe(18);
    expect(ageOn("2008-10-15", "2026-10-14")).toBe(17);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn(birthDateForAge(18, "2026-10-14"), "2026-10-14")).toBe(18);
  });

  it("PTY-R13 today is read in Africa/Kigali (UTC+2), not UTC", () => {
    expect(today(new Date("2026-10-05T22:30:00Z"))).toBe("2026-10-06");
    expect(today(new Date("2026-10-05T21:30:00Z"))).toBe("2026-10-05");
  });

  it("OPS-R4 status moves: allowed and refused pairs for every request type", () => {
    expect(canMove(EQUIPMENT_REQUEST_MOVES, "NEW", "QUOTED")).toBe(true);
    expect(canMove(EQUIPMENT_REQUEST_MOVES, "COMPLETED", "NEW")).toBe(false);
    expect(canMove(EQUIPMENT_REQUEST_MOVES, "CANCELLED", "ACTIVE")).toBe(false);
    expect(equipmentRequestMoves("CONFIRMED", "RENT")).toEqual(["ACTIVE", "CANCELLED"]);
    expect(equipmentRequestMoves("CONFIRMED", "BUY")).toEqual(["COMPLETED", "CANCELLED"]);
    expect(canMove(SUPPLY_ORDER_MOVES, "CONFIRMED", "DELIVERED")).toBe(true);
    expect(canMove(SUPPLY_ORDER_MOVES, "DELIVERED", "CANCELLED")).toBe(false);
    expect(canMove(SERVICE_REQUEST_MOVES, "IN_PROGRESS", "DELIVERED")).toBe(true);
    expect(canMove(SERVICE_REQUEST_MOVES, "NEW", "DELIVERED")).toBe(false);
    expect(canMove(WORKFORCE_REQUEST_MOVES, "NEW", "RECRUITING")).toBe(true);
    expect(canMove(WORKFORCE_REQUEST_MOVES, "CLOSED", "RECRUITING")).toBe(false);
  });

  it("OPS-R16 honeypot: any value means a bot; rate limit: the 6th call in a minute is refused", () => {
    expect(isBot("http://spam")).toBe(true);
    expect(isBot("")).toBe(false);
    expect(isBot(undefined)).toBe(false);
    resetRateLimits();
    for (let i = 0; i < 5; i++) checkRateLimit({ scope: "t", ip: "1.2.3.4", limit: 5, windowMs: 60_000, now: 1000 + i });
    expect(() => checkRateLimit({ scope: "t", ip: "1.2.3.4", limit: 5, windowMs: 60_000, now: 2000 })).toThrow(/Too many/);
    expect(() => checkRateLimit({ scope: "t", ip: "5.6.7.8", limit: 5, windowMs: 60_000, now: 2000 })).not.toThrow();
    expect(() => checkRateLimit({ scope: "t", ip: "1.2.3.4", limit: 5, windowMs: 60_000, now: 62_000 })).not.toThrow();
  });

  it("CAT-R1 slugify makes URL-safe slugs", () => {
    expect(slugify("Rollers & Compactors")).toBe("rollers-and-compactors");
    expect(slugify("  CAT 320 Excavator! ")).toBe("cat-320-excavator");
    expect(slugify("Ébène")).toBe("ebene");
  });

  it("D-5 money is whole RWF: RWF 150,000 / day", () => {
    expect(formatRwf(150000)).toBe("RWF 150,000");
    expect(formatRwfPer(150000, "DAY")).toBe("RWF 150,000 / day");
    expect(formatRwf(null)).toBe("Price on request");
  });

  it("calendar dates of requests leave the server as YYYY-MM-DD; instants stay Dates", () => {
    const out = toOpsOut({ startDate: new Date("2026-10-05T00:00:00Z"), createdAt: new Date("2026-10-05T10:00:00Z"), nested: [{ deadline: null }] });
    expect(out.startDate).toBe("2026-10-05");
    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.nested[0].deadline).toBeNull();
  });
});
