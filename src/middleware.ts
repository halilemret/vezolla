import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Yalnızca /api rotaları için CORS başlıklarını ekle
  if (request.nextUrl.pathname.startsWith("/api")) {
    const origin = request.headers.get("origin") || "*";

    // Preflight (OPTIONS) istekleri için anında 204 yanıtı dön
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With, Accept, Origin",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
