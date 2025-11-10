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
        : [
              "http://localhost:3000",
              "http://127.0.0.1:3000",
              // 3030 に統一運用する場合の開発ポート
              "http://localhost:3030",
              "http://127.0.0.1:3030",
          ];
}

export function middleware(request: NextRequest) {
    const urlPath = request.nextUrl.pathname;
    const enableProtection = process.env.ADMIN_ENABLE_PROTECTION === "1";

    // Simple protection for admin/protected paths (IP allowlist or Basic auth)
    const isProtectedPath =
        urlPath.startsWith("/agent/workflow") ||
        urlPath.startsWith("/api/agent/workflow") ||
        urlPath.startsWith("/api/agent/workflow-proxy");

    if (enableProtection && isProtectedPath) {
        // IP allowlist check (first IP from X-Forwarded-For)
        const xff = request.headers.get("x-forwarded-for") || "";
        const clientIp = xff.split(",")[0]?.trim() || request.ip || "";
        const ipList = (process.env.ADMIN_IP_ALLOWLIST || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const ipAllowed = ipList.length > 0 ? ipList.includes(clientIp) : false;

        // Basic auth fallback
        const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
        let basicAllowed = false;
        if (auth.toLowerCase().startsWith("basic ")) {
            try {
                const b64 = auth.slice(6).trim();
                const [user, pass] = Buffer.from(b64, "base64").toString("utf8").split(":");
                // Single pair (legacy)
                const u = (process.env.ADMIN_BASIC_USER || "").trim();
                const p = (process.env.ADMIN_BASIC_PASS || "").trim();
                if (u && p && user === u && pass === p) basicAllowed = true;

                // Multiple pairs: ADMIN_BASIC_USERS="user1:pass1,user2:pass2"
                if (!basicAllowed) {
                    const list = (process.env.ADMIN_BASIC_USERS || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((pair) => {
                            const idx = pair.indexOf(":");
                            if (idx > 0) return [pair.slice(0, idx), pair.slice(idx + 1)];
                            return null;
                        })
                        .filter(Boolean) as Array<[string, string]>;
                    if (list.length > 0) {
                        basicAllowed = list.some(([uu, pp]) => uu === user && pp === pass);
                    }
                }
            } catch {
                // ignore
            }
        }

        if (!ipAllowed && !basicAllowed) {
            const resp = new NextResponse("Unauthorized", { status: 401 });
            // Prevent indexing and caching of protected responses
            resp.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
            resp.headers.set("Cache-Control", "no-store");
            resp.headers.set("WWW-Authenticate", 'Basic realm="admin"');
            return resp;
        }
    }

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

    // For protected paths, always prevent indexing and caching even when authorized
    if (isProtectedPath) {
        res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        res.headers.set("Cache-Control", "no-store");
    }
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
    matcher: ["/api/:path*", "/agent/:path*"],
};
