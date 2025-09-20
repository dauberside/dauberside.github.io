import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function normalizeOrigin(origin: string): string {
    // Remove trailing slash (if any)
    return origin.replace(/\/$/, "");
}

function getAllowedOrigins(): string[] {
    const env = process.env.ALLOWED_ORIGINS;
    if (env) {
        return env
            .split(",")
            .map((s) => normalizeOrigin(s.trim()))
            .filter(Boolean);
    }
       return process.env.NODE_ENV === "production"
           ? ["https://www.xn--rn8h03a.st", "https://www.xn--tu8hz2e.tk"]
        : ["http://localhost:3000", "http://127.0.0.1:3000"];
}

export function middleware(request: NextRequest) {
    const origin = request.headers.get("origin") || "";
    const normalizedOrigin = normalizeOrigin(origin);
    const requestOrigin = normalizeOrigin(request.nextUrl.origin);
    const allowed = getAllowedOrigins();
    // Allow if explicitly allowed OR same-origin (SSR/Edge path access)
    const isAllowed =
        normalizedOrigin.length > 0 &&
        (allowed.includes(normalizedOrigin) ||
            (requestOrigin && normalizedOrigin === requestOrigin));

    // Preflight: respond with 204 and appropriate headers
    if (request.method === "OPTIONS") {
        if (isAllowed) {
            const allowRequestHeaders =
                request.headers.get("access-control-request-headers") ||
                "Content-Type, Authorization";
            const headers = new Headers({
                "Access-Control-Allow-Origin": normalizedOrigin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": allowRequestHeaders,
                "Access-Control-Max-Age": "86400",
                Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
            });
            return new NextResponse(null, { status: 204, headers });
        }
        // Not allowed origin: return empty 204 without CORS headers
        return new NextResponse(null, { status: 204 });
    }

    // Non-preflight: pass through but attach CORS headers for allowed origins
    const res = NextResponse.next();
    if (isAllowed) {
        res.headers.set("Access-Control-Allow-Origin", normalizedOrigin);
        res.headers.set(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS",
        );
        res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        // Help caching proxies vary properly by origin
        res.headers.set(
            "Vary",
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        );
    }
    return res;
}

export const config = {
    matcher: "/api/:path*",
};
