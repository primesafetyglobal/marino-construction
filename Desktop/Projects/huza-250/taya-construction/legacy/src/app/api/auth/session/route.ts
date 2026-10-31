/* eslint-disable @typescript-eslint/no-unused-vars */
import { getUser } from "@/server/validation/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
   const user = getUser();

    if (!user) {
        return NextResponse.json({ isValid: false }, { status: 401 });
    }
    return NextResponse.json({ isValid: true, user},{status: 200});
}
