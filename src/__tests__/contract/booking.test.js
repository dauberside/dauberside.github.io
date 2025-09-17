describe("Booking API contract", () => {
  describe("GET /api/slots", () => {
    it("returns 200 with { slots: [] } for basic GET without params", async () => {
      const handler = require("../../pages/api/slots");

      const req = { method: "GET", query: {} };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = (k, v) => {
          r.headers[k] = v;
        };
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeDefined();
      expect(Array.isArray(res.body.slots)).toBe(true);
    });

    it("returns non-empty slots with defaults (today, duration=30, SITE_TZ)", async () => {
      const handler = require("../../pages/api/slots");
      const req = { method: "GET", query: {} };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.slots)).toBe(true);
      expect(res.body.slots.length).toBeGreaterThan(0);
      for (const s of res.body.slots) {
        expect(typeof s.start).toBe("string");
        expect(typeof s.end).toBe("string");
        const start = Date.parse(s.start);
        const end = Date.parse(s.end);
        expect(Number.isNaN(start)).toBe(false);
        expect(Number.isNaN(end)).toBe(false);
        expect(end - start).toBe(30 * 60 * 1000);
      }
    });

    it("returns non-empty slots for date+duration+tz (Asia/Tokyo)", async () => {
      const handler = require("../../pages/api/slots");
      const req = {
        method: "GET",
        query: { date: "2025-01-15", duration: "30", tz: "Asia/Tokyo" },
      };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const slots = res.body.slots;
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) {
        const start = Date.parse(s.start);
        const end = Date.parse(s.end);
        expect(Number.isNaN(start)).toBe(false);
        expect(Number.isNaN(end)).toBe(false);
        expect(end - start).toBe(30 * 60 * 1000);
      }
    });

    it("returns 400 for invalid date format", async () => {
      const handler = require("../../pages/api/slots");
      const req = { method: "GET", query: { date: "2025/01/01" } };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body && typeof res.body.message === "string").toBe(true);
    });

    it("returns 400 for invalid duration (not in 15|30|45|60)", async () => {
      const handler = require("../../pages/api/slots");
      const req = { method: "GET", query: { duration: "10" } };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body && typeof res.body.message === "string").toBe(true);
    });
  });

  describe("POST /api/book", () => {
    it("returns 201 with {id, status:'confirmed'} when booking a free slot", async () => {
      const handler = require("../../pages/api/book");
      const req = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        body: {
          start: "2025-01-15T09:00:00Z",
          end: "2025-01-15T09:30:00Z",
          name: "Alice",
          email: "alice@example.com",
          note: "hello",
        },
      };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);
      expect(res.statusCode).toBe(201);
      expect(typeof res.body?.id).toBe("string");
      expect(res.body?.status).toBe("confirmed");
    });

    it("returns 400 for invalid payload (missing fields / invalid email)", async () => {
      const handler = require("../../pages/api/book");
      const bads = [
        { body: { end: "2025-01-15T09:30:00Z", name: "A", email: "a@b.com" } },
        {
          body: { start: "2025-01-15T09:00:00Z", name: "A", email: "a@b.com" },
        },
        {
          body: {
            start: "2025-01-15T09:00:00Z",
            end: "2025-01-15T09:30:00Z",
            name: "A",
            email: "invalid",
          },
        },
      ];
      for (const c of bads) {
        const req = {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.7",
          },
          body: c.body,
        };
        const res = (() => {
          const r = { statusCode: 200, headers: {}, body: undefined };
          r.setHeader = () => {};
          r.status = (code) => {
            r.statusCode = code;
            return r;
          };
          r.json = (data) => {
            r.body = data;
            return r;
          };
          return r;
        })();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
      }
    });

    it("returns 409 when the slot is already booked (conflict)", async () => {
      jest.resetModules();
      jest.doMock("../../lib/gcal", () => ({
        listGoogleCalendarEvents: async () => [
          {
            start: { dateTime: "2025-01-15T09:10:00Z" },
            end: { dateTime: "2025-01-15T09:40:00Z" },
          },
        ],
        createGoogleCalendarEvent: async () => ({ id: "x", htmlLink: "" }),
      }));

      const handler = require("../../pages/api/book");
      const req = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.20",
        },
        body: {
          start: "2025-01-15T09:00:00Z",
          end: "2025-01-15T09:30:00Z",
          name: "Bob",
          email: "bob@example.com",
        },
      };
      const res = (() => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      })();

      await handler(req, res);
      expect(res.statusCode).toBe(409);
    });

    it("returns 429 when rate limit is exceeded", async () => {
      const handler = require("../../pages/api/book");
      const makeReq = () => ({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.99",
        },
        body: {
          start: "2025-01-15T10:00:00Z",
          end: "2025-01-15T10:30:00Z",
          name: "Carol",
          email: "carol@example.com",
        },
      });
      const makeRes = () => {
        const r = { statusCode: 200, headers: {}, body: undefined };
        r.setHeader = () => {};
        r.status = (code) => {
          r.statusCode = code;
          return r;
        };
        r.json = (data) => {
          r.body = data;
          return r;
        };
        return r;
      };

      const res1 = makeRes();
      await handler(makeReq(), res1);
      expect([200, 201]).toContain(res1.statusCode);

      const res2 = makeRes();
      await handler(makeReq(), res2);
      expect(res2.statusCode).toBe(429);
    });
  });
});
