import { NextResponse } from "next/server";
import { getCurrentStaff, type AuthenticatedStaff } from "./session";
import { hasPermission, type PermissionKey } from "@/lib/rbac/permissions";

export interface ApiAuthResult {
  staff: AuthenticatedStaff | null;
  errorResponse: NextResponse | null;
}

export async function authenticateStaffApi(
  requiredPermission?: PermissionKey
): Promise<ApiAuthResult> {
  const staff = await getCurrentStaff();

  if (!staff) {
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: "Oturum süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapın." },
        { status: 401 }
      ),
    };
  }

  if (requiredPermission && !hasPermission(staff, requiredPermission)) {
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: `Bu işlem için "${requiredPermission}" yetkisi gerekiyor.` },
        { status: 403 }
      ),
    };
  }

  return { staff, errorResponse: null };
}
