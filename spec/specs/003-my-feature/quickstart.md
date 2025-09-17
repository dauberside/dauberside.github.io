# Quickstart

This feature validates a self-serve booking flow against the Booking API
contract.

## Prerequisites

- Node 22, pnpm
- Env vars for Google API if running actual integration later (not needed for
  contract tests)

## Run checks

- Lint / Typecheck / Tests + Spec Validator

```zsh
pnpm -s format:check && pnpm -s lint && pnpm -s typecheck && pnpm -s test -i && ./spec/scripts/validate-spec.sh
```

## Contract-first outline

1. Review OpenAPI: `contracts/booking.openapi.yml`
2. Write Jest contract tests from `contracts/booking.contract.test.md` into
   `src/__tests__/contract/booking.test.ts` (to be created)
3. Implement `/api/slots` and `/api/book` to make tests pass

### Suggested minimal test cases

- GET /api/slots returns 200 and an array of {start,end}
- POST /api/book returns 201 {id, status: 'confirmed'} on a free slot
- POST /api/book returns 409 on concurrent booking of same slot
- Input validation error paths (400), and rate limit (429)

## Local dev (optional)

- Start dev server

```zsh
pnpm dev
```

- Sample curl (replace ISO times)

```zsh
curl -s "http://localhost:3000/api/slots?date=2025-09-12&duration=30&tz=Asia/Tokyo" | jq .

curl -s -X POST "http://localhost:3000/api/book" \
	-H "Content-Type: application/json" \
	-d '{"start":"2025-09-12T09:00:00Z","end":"2025-09-12T09:30:00Z","name":"Taro","email":"taro@example.com","note":"hello"}' | jq .
```

## Notes

- Source of truth is Google Calendar; for unit tests you may mock googleapis,
  but prefer an integration test path later.
- Respect existing API constraints: body <= 16KB, note <= 140 chars.
