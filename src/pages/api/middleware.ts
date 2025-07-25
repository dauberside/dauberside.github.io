import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : process.env.NODE_ENV === "production"
    ? ["https://www.xn--tu8hz2e.tk/"]
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") || "";

  if (allowedOrigins.includes(origin)) {
    return NextResponse.next({
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
