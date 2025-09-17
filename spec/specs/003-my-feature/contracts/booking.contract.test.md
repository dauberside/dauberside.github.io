# Contract Tests Sketch

These tests will be implemented in Jest. For now, we capture the expected
behavior.

## GET /api/slots

- returns 200 with array of slots [{start, end}] for valid date/duration
- returns 400 for invalid date or duration

## POST /api/book

- returns 201 with {id, status: "confirmed"} when booking a free slot
- returns 409 if slot already booked (conflict)
- returns 400 for invalid payload (missing fields, invalid email)
- returns 429 when rate limit exceeded
