# Data Model

## Entities

### Slot

- id: string (derived: `${start}_${end}` in UTC)
- start: DateTime (ISO8601, UTC)
- end: DateTime (ISO8601, UTC)
- durationMin: number (15|30|45|60)

Validation:

- start < end; (end - start) == durationMin
- aligned to 5-min boundaries (optional)

### Person

- name: string (<= 80)
- email: string (RFC5322, <= 254)

Validation:

- name required, trimmed, non-empty
- email required, valid format

### Booking

- id: string (GCal event id)
- slotId: string (Slot.id)
- person: Person
- note: string (<= 140, optional)
- status: 'confirmed'

Validation:

- slot exists and is free at booking time (no overlapping confirmed events)
- rate-limit: 1 IP / min (reuse existing KV)
- body size <= 16KB (existing API constraint)

## Derived/Integration Notes

- Source of truth: Google Calendar (primary calendar)
- Conflict policy: optimistic concurrency — on creation conflict, return 409
- Time zones: store/process in UTC; render in user TZ
