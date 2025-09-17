# Tasks for my-feature

Note: Follow TDD. Start with contract tests, then minimal implementations to
turn tests green. Mark [P] for independent/parallelizable work.

## Contract & Tests (RED)

1. [P] Create contract test scaffolding `src/__tests__/contract/booking.test.ts`
   (Jest, ts-jest). Load OpenAPI
   `spec/specs/003-my-feature/contracts/booking.openapi.yml` for schemas.
2. Write tests: GET /api/slots → 200 with array of {start,end}; validate
   date/duration/tz params and response shape.
3. Write tests: POST /api/book → 201 {id, status:'confirmed'} for a free slot;
   400 invalid payload; 409 on conflict; 429 on rate limit.
4. [P] Add integration test harness utilities for mocking googleapis (temporary)
   with a toggle to switch to real API later.

## Implementation (GREEN)

5. Implement `/api/slots` (pages/api/slots.ts):
   - Validate query (date, duration in [15,30,45,60], tz optional)
   - Use `lib/gcal.ts` to fetch availability, map to UTC ISO slots
6. Implement `/api/book` (pages/api/book.ts):
   - Validate payload (start,end,name<=80,email<=254,note<=140)
   - Rate-limit (KV, 1 IP/min) and body size 16KB 既存方針踏襲
   - Create GCal event; on conflict return 409
   - Send emails (nodemailer) to visitor/owner
7. [P] Reuse/extend existing incident logging (415/413/429) style for new
   endpoints; add structured context (endpoint, reason, masked ip).
8. [P] Add shared validators: email regex, iso date-time parse, duration guard
   under `src/lib/` or reuse existing utils.

## Edge cases & Reliability

9. Ensure timezone handling: inputs parsed to UTC; outputs rendered in user tz
   (for UI later); internally keep UTC.
10. Reject past slots; enforce alignment to 5-min boundaries (optional,
    feature-flag).
11. Protect against duplicate submissions (idempotency key =
    `${start}_${end}_${email}` within 1 min). Return 409 if duplicate.
12. [P] Handle partial failures (GCal created but email failed): log error,
    still return 201 with warning field; retry email via background later (out
    of scope for now, just log).

## UI (optional for MVP if API-first)

13. Build minimal UI component to list slots and post booking (shadcn UI):
    `src/components/booking/`.
14. Hook into an existing page (e.g., `/project` or add `/book`) with accessible
    form and keyboard support.

## Observability & Ops

15. Emit metrics counters (log lines) for: slots served, bookings confirmed,
    conflicts, validation errors, rate-limited.
16. Update README Operations section with new endpoints, body limits (16KB) and
    note<=140 reminder.
17. [P] Add runbook snippet into `spec/specs/003-my-feature/quickstart.md`
    (troubleshooting: 400/409/429, TZ pitfalls).

## Docs & Contracts

18. Review OpenAPI for completeness: error responses (400/409/429) examples; add
    examples payloads.
19. Update `spec/specs/003-my-feature/data-model.md` if entity fields change
    during implementation.
20. [P] Keep `booking.contract.test.md` and OpenAPI in sync with actual
    behavior.

## Quality Gates

21. Lint/Typecheck/Test scripts remain green in CI; add tests into pipeline.
22. A11y smoke (keyboard only) for booking UI; color contrast check.
23. p95 API latency checks on local smoke (optional; log-based approximation
    acceptable for now).

## Delivery

24. Prepare PR:

- Include API endpoints, tests, and docs updates
- Spec Validator passes; format/lint/typecheck/tests all green
- Include screenshots/gifs for UI (if built)

## Nice-to-haves (post-MVP)

25. Slack notification webhook for owner on booking confirmed.
26. ICS attachment in confirmation email.
27. Multi-calendar support behind a flag; duration presets per type.
