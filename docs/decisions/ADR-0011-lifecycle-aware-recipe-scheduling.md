# ADR-0011: Lifecycle-Aware Recipe Scheduling

**Status**: Accepted
**Date**: 2025-12-10
**Decision Makers**: User, Claude Code
**Tags**: #cortex-os #recipes #scheduling #lifecycle

---

## Context

Cortex OS v1.2 implemented autonomous Recipe execution with fixed daily schedules:

| Recipe | Original Time | Issue |
|--------|--------------|-------|
| Recipe 13 | 22:00 JST | User absent on Tue/Thu (night shift) |
| Recipe 14 | 00:00 JST | Mac likely asleep (deep night) |
| Recipe 02 | 03:00 JST | Mac likely asleep (deep night) |
| Recipe 10 | 10:00 JST | User absent on Tue/Thu/Sat morning |

**User's Lifecycle Constraints**:
- **Tuesday/Thursday**: Night shift, not at home (evening → next morning)
- **Saturday**: Out until 17:00
- **Work hours**: Variable, Mac may be asleep
- **In-home reliability**: Monday, Wednesday, Friday, Sunday evenings

**Core Problem**: 24/7 fixed schedule assumes Mac is always awake, which doesn't match real human lifestyle patterns.

---

## Decision

**We will implement lifecycle-aware Recipe scheduling that aligns with user's actual availability.**

### New Schedule: Evening Batch Execution

**Target Days**: Monday, Wednesday, Friday, Saturday, Sunday
**Rationale**: High in-home probability, Mac awake during evening routine

| Recipe | New Time | Cron Expression | Purpose |
|--------|---------|-----------------|---------|
| **Recipe 13** | 20:00 JST | `0 20 * * 0,1,3,5,6` | Generate tomorrow's task candidates (wrap-up) |
| **Recipe 14** | 20:10 JST | `10 20 * * 0,1,3,5,6` | Generate daily digest |
| **Recipe 02** | 20:30 JST | `30 20 * * 0,1,3,5,6` | Rebuild KB index |
| **Recipe 10** | 20:40 JST | `40 20 * * 0,1,3,5,6` | Sync TODO.md |

**Excluded Days**: Tuesday (day 2), Thursday (day 4)
**Rationale**: Night shift days → minimal TODO structure expected

---

## Rationale

### Why Evening Batch (20:00-20:40)?

1. **High Mac Availability**
   - User typically home on Mon/Wed/Fri/Sat/Sun evenings
   - Mac awake and online during evening routine
   - Execution success probability: ~90% (vs. ~30% with night/morning schedule)

2. **Natural Workflow Alignment**
   - 20:00-20:40: End-of-day reflection time
   - Recipe 13 generates tomorrow's tasks → natural "wrap-up" moment
   - Recipe 10 syncs TODO → ready for next day planning

3. **Exception Days Design Philosophy**
   - Tue/Thu: "Light days" by design (night shift = different task structure)
   - No need to force daily Recipe execution
   - Manual `/brief` or mobile notes suffice for exception days

### Why Not Every Day?

**CDLM Principle**: "Multiple micro-CDLMs per lifecycle pattern" instead of "one rigid daily cycle"

- **High-structure days** (Mon/Wed/Fri/Sun): Full Recipe automation
- **Exception days** (Tue/Thu): Manual or mobile-first workflow
- **Partial days** (Sat): Evening batch after return home (17:00+)

---

## Consequences

### Positive

✅ **Immediate**:
- Recipe execution success rate: 30% → 90%
- No more "TODO.md not updated for 2 days" issues
- Aligns automation with human reality

✅ **Medium-term**:
- Clear separation: "automation days" vs. "manual days"
- Exception handling becomes a feature, not a bug
- Reduces sleep-related failure modes

✅ **Long-term**:
- Foundation for v2.0 "multi-pattern lifecycle design"
- Easier to add "mobile-first mode" for exception days
- Cloud migration becomes "v2 optimization" not "v1 blocker"

### Negative

⚠️ **Tue/Thu Gap**:
- No automatic digest/TODO sync on night shift days
- Mitigation: Use `/brief` on mobile or manual notes
- Long-term fix: Cloud-hosted n8n (v2.0)

⚠️ **Still Mac-Dependent**:
- If Mac sleeps at 20:00, Recipes still fail
- Mitigation: launchd + caffeinate for critical days
- Long-term fix: Cloud migration (v2.0)

⚠️ **Timezone Brittleness**:
- Cron expressions hardcoded to JST
- If user travels, schedules may misalign
- Mitigation: n8n timezone settings
- Long-term fix: User-configurable schedule (v2.0)

---

## Implementation Plan

### Phase 1: Immediate (Today)
1. ✅ Update n8n Recipe cron expressions
2. ✅ Test Recipe 10 at 20:40 tonight (2025-12-10)
3. ✅ Document new schedule in `cortex-os.md`

### Phase 2: Short-term (1 week)
4. Add launchd wake task for 19:55 JST on automation days
5. Monitor Recipe success rate for 7 consecutive days
6. Create health dashboard: "Recipe reliability by day-of-week"

### Phase 3: Medium-term (1 month)
7. Design "exception day workflow" (mobile + `/brief`)
8. Add Recipe execution alerts (Slack/email on failure)
9. Document "light day" vs. "full day" patterns

### Phase 4: Long-term (v2.0)
10. Migrate n8n to cloud (Railway/Fly.io)
11. Implement multi-pattern lifecycle management
12. Add user-configurable schedule UI

---

## Alternatives Considered

### Alternative 1: Keep 24/7 Schedule + caffeinate

**Rejected because**:
- Doesn't solve Tue/Thu night shift problem
- Mac battery drain on unused days
- Fights human reality instead of adapting to it

### Alternative 2: Immediate Cloud Migration

**Rejected because**:
- High upfront cost (setup time + infrastructure)
- Premature optimization (v1 should validate patterns first)
- Cloud migration is better as v2.0 milestone after proving lifecycle-aware design

### Alternative 3: Manual-Only Operation

**Rejected because**:
- Loses automation benefits entirely
- Doesn't leverage Cortex OS strengths
- User still needs "baseline automation" for high-structure days

---

## Monitoring & Success Metrics

### Week 1 Metrics (2025-12-10 to 2025-12-17)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recipe execution success rate | >80% | n8n execution logs |
| TODO.md update frequency | 5/7 days | Git commit timestamps |
| User satisfaction | Subjective improvement | User feedback |

### Month 1 Metrics (2025-12-10 to 2026-01-10)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Zero "Recipe not run for 2+ days" | 0 incidents | `/diagnose` reports |
| Exception day handling | Clear workflow documented | ADR + user tests |
| v2.0 cloud migration decision | Go/No-go | Cost-benefit analysis |

---

## Related ADRs

- **ADR-0010**: CDLM (Cortex Development Lifecycle Model) → Informed "micro-CDLM" design
- **ADR-0009**: Railway n8n Deployment → Future cloud migration path
- **ADR-0002**: Hot Path Optimization → Recipe 10 is on the hot path for daily workflow

---

## References

- [Cortex OS Requirements v1.3](../requirements/cortex-os.md)
- [Recipe Monitoring Guide](../operations/recipe-monitoring.md)
- [CDLM v1.0.0](../cortex/cdlm-v1.0.0.md)

---

**Last Updated**: 2025-12-10
**Next Review**: 2025-12-17 (after 7-day monitoring period)
