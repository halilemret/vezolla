import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { staff, errorResponse } = await authenticateStaffApi();
  if (errorResponse) return errorResponse;

  return NextResponse.json({ staff });
}
