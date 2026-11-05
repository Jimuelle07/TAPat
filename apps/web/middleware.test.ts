import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { middleware } from "./middleware";

const ORIGIN = "https://tapat.example.vercel.app";

function request(path: string, authorization?: string): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, { headers: authorization ? { authorization } : {} });
}

function basic(credentials: string): string {
  return `Basic ${btoa(credentials)}`;
}

/** NextResponse.next() marks a pass-through with this header. */
function passed(response: Response): boolean {
  return response.status === 200 && response.headers.get("x-middleware-next") === "1";
}

afterEach(() => {
  delete process.env.WEB_BASIC_AUTH;
});

describe("apps/web/middleware.ts basic auth", () => {
  it("is a no-op when WEB_BASIC_AUTH is unset", () => {
    expect(passed(middleware(request("/")))).toBe(true);
  });

  describe("with WEB_BASIC_AUTH=user:pass", () => {
    it("answers 401 with a Basic challenge when no Authorization header is sent", () => {
      process.env.WEB_BASIC_AUTH = "user:pass";
      const response = middleware(request("/"));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe('Basic realm="TAPat"');
    });

    it("answers 401 to wrong credentials, a prefix of the right ones, and a non-Basic scheme", () => {
      process.env.WEB_BASIC_AUTH = "user:pass";
      expect(middleware(request("/demo", basic("user:wrong"))).status).toBe(401);
      expect(middleware(request("/demo", basic("user:pas"))).status).toBe(401);
      expect(middleware(request("/demo", basic("user:pass2"))).status).toBe(401);
      expect(middleware(request("/demo", "Bearer user:pass")).status).toBe(401);
      expect(middleware(request("/api/dashboard", "Basic !!!")).status).toBe(401);
    });

    it("passes the correct Basic base64(user:pass)", () => {
      process.env.WEB_BASIC_AUTH = "user:pass";
      expect(passed(middleware(request("/station/A", basic("user:pass"))))).toBe(true);
    });

    it("lets /api/webhooks/velo and /api/health through with no header", () => {
      process.env.WEB_BASIC_AUTH = "user:pass";
      expect(passed(middleware(request("/api/webhooks/velo")))).toBe(true);
      expect(passed(middleware(request("/api/health")))).toBe(true);
      expect(middleware(request("/api/healthz")).status).toBe(401);
    });
  });
});
