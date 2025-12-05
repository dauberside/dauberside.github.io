# /suggest Test Cases

**Version**: 1.0 (MVP)  
**Created**: 2025-12-05  
**Purpose**: Comprehensive test coverage for `scripts/suggest.py`

---

## 📋 Test Categories

### 1. Input Validation Tests

#### TC-001: Missing temporal-patterns.json
- **Given**: `data/analytics/temporal-patterns.json` does not exist
- **When**: `/suggest` is executed
- **Then**: 
  - stderr: `⚠️  No temporal patterns found. Run analyze-workload.py first.`
  - Exit code: 0 (graceful degradation)
  - Output: Empty or fallback suggestions

#### TC-002: Missing tomorrow.json
- **Given**: `data/tomorrow.json` does not exist
- **When**: `/suggest` is executed
- **Then**:
  - stderr: `⚠️  No tomorrow candidates found.`
  - Exit code: 0
  - Output: Empty suggestions list

#### TC-003: Empty tomorrow_candidates
- **Given**: `tomorrow.json` exists but `tomorrow_candidates: []`
- **When**: `/suggest` is executed
- **Then**:
  - Output: No suggestions (or message indicating no candidates)
  - Exit code: 0

#### TC-004: Invalid JSON in temporal-patterns.json
- **Given**: `temporal-patterns.json` contains malformed JSON
- **When**: `/suggest` is executed
- **Then**:
  - stderr: `❌ Error reading temporal-patterns.json: <error details>`
  - Exit code: 1 (or graceful failure)

#### TC-005: Invalid JSON in tomorrow.json
- **Given**: `tomorrow.json` contains malformed JSON
- **When**: `/suggest` is executed
- **Then**:
  - stderr: `❌ Error reading tomorrow.json: <error details>`
  - Exit code: 1

---

### 2. Workload Detection Tests

#### TC-101: High Load Day (avg_tasks > 15)
- **Given**: 
  - Today is Wednesday
  - `temporal-patterns.json` shows `weekday_patterns.Wednesday.avg_tasks: 18`
- **When**: `/suggest` is executed
- **Then**:
  - Suggestion count: Limited to 3-5 tasks
  - Priority filter: Only "high" or "critical" tasks
  - Message: Indicates high load detected

#### TC-102: Low Load Day (avg_tasks < 8)
- **Given**:
  - Today is Sunday
  - `temporal-patterns.json` shows `weekday_patterns.Sunday.avg_tasks: 4`
- **When**: `/suggest` is executed
- **Then**:
  - Suggestion count: Up to 8-10 tasks
  - Priority filter: Includes "medium" and "low" priority tasks
  - Message: Indicates capacity available

#### TC-103: Medium Load Day (8 ≤ avg_tasks ≤ 15)
- **Given**:
  - Today is Monday
  - `temporal-patterns.json` shows `weekday_patterns.Monday.avg_tasks: 12`
- **When**: `/suggest` is executed
- **Then**:
  - Suggestion count: 5-7 tasks
  - Priority filter: "high" and "medium" tasks

#### TC-104: Missing Weekday Pattern
- **Given**:
  - Today is Friday
  - `temporal-patterns.json` does not contain `weekday_patterns.Friday`
- **When**: `/suggest` is executed
- **Then**:
  - Fallback to `summary.avg_tasks` or default value
  - No crash or error

---

### 3. Priority Adjustment Tests

#### TC-201: Priority Sorting on High Load
- **Given**: High load day (avg_tasks > 15)
- **When**: `/suggest` is executed with candidates of mixed priority
- **Then**:
  - Output: Tasks sorted by priority (critical → high → medium)
  - Low priority tasks excluded

#### TC-202: Priority Sorting on Low Load
- **Given**: Low load day (avg_tasks < 8)
- **When**: `/suggest` is executed with candidates of mixed priority
- **Then**:
  - Output: Includes medium and low priority tasks
  - Sorted by priority but more inclusive

#### TC-203: All Same Priority
- **Given**: All candidates have priority "medium"
- **When**: `/suggest` is executed
- **Then**:
  - Output: Tasks in original order or alphabetically sorted by title
  - No crash

---

### 4. Duplicate Detection Tests

#### TC-301: All Candidates in Today's Digest
- **Given**:
  - All tasks in `tomorrow.json` are present in `cortex/daily/{today}-digest.md`
- **When**: `/suggest` is executed
- **Then**:
  - Output: `✅ All candidate tasks are already in today's digest!`
  - No suggestions returned

#### TC-302: Some Candidates in Today's Digest
- **Given**:
  - 3 of 5 candidates are already in today's digest
- **When**: `/suggest` is executed
- **Then**:
  - Output: Only the 2 new tasks are suggested
  - Duplicates are filtered out

#### TC-303: No Today's Digest File
- **Given**:
  - `cortex/daily/{today}-digest.md` does not exist
- **When**: `/suggest` is executed
- **Then**:
  - All candidates are considered new
  - No crash

---

### 5. Edge Cases

#### TC-401: Zero Candidates After Filtering
- **Given**: All candidates are either duplicates or filtered by priority
- **When**: `/suggest` is executed
- **Then**:
  - Output: Empty list or informative message
  - Exit code: 0

#### TC-402: Extremely High Load (avg_tasks > 30)
- **Given**: `weekday_patterns.{today}.avg_tasks: 35`
- **When**: `/suggest` is executed
- **Then**:
  - Suggestion count: Maximum 2-3 critical tasks only
  - Warning message about overload

#### TC-403: Extremely Low Load (avg_tasks < 2)
- **Given**: `weekday_patterns.{today}.avg_tasks: 1`
- **When**: `/suggest` is executed
- **Then**:
  - Suggestion count: Up to 10 tasks
  - Encouragement message about capacity

#### TC-404: Missing Priority Field in Candidates
- **Given**: Some tasks in `tomorrow.json` lack a `priority` field
- **When**: `/suggest` is executed
- **Then**:
  - Default priority assigned (e.g., "medium")
  - No crash

#### TC-405: Invalid Date Format in temporal-patterns.json
- **Given**: `generated_at` field has incorrect format
- **When**: `/suggest` is executed
- **Then**:
  - Warning logged but execution continues
  - No crash

---

### 6. Output Format Tests

#### TC-501: Valid JSON Output
- **Given**: Normal execution with valid inputs
- **When**: `/suggest` is executed
- **Then**:
  - stdout: Valid JSON array
  - Each suggestion has required fields: `title`, `priority`, `source`

#### TC-502: No Suggestions Available
- **Given**: No candidates or all filtered
- **When**: `/suggest` is executed
- **Then**:
  - stdout: `[]` (empty JSON array) or informative JSON object
  - stderr: Explanation message

#### TC-503: Metadata in Output
- **Given**: Normal execution
- **When**: `/suggest` is executed
- **Then**:
  - Output includes metadata: `suggested_at`, `weekday`, `load_context`

---

### 7. Integration Tests

#### TC-601: Full Pipeline (extract → analyze → suggest)
- **Given**: Clean state with no existing task-entry files
- **When**: 
  1. Run `extract-tasks.py --days 7`
  2. Run `analyze-workload.py --days 7`
  3. Run `suggest.py`
- **Then**:
  - All steps complete without error
  - Final suggestions reflect patterns from last 7 days

#### TC-602: Incremental Update
- **Given**: Existing temporal-patterns.json from yesterday
- **When**: New task-entry added today, then `/suggest` executed
- **Then**:
  - Suggestions reflect updated patterns (if analyze-workload was re-run)
  - Or uses existing patterns if not re-run

---

## 🧪 Test Execution Checklist

### Setup
- [ ] Install dependencies: `pip install pandas`
- [ ] Ensure test fixtures exist in `tests/fixtures/`
- [ ] Mock `cortex/daily/`, `cortex/state/`, `data/` directories

### Run Tests
- [ ] Unit tests for each function (`load_json`, `load_temporal_patterns`, etc.)
- [ ] Integration tests for full pipeline
- [ ] Edge case tests

### Validation
- [ ] All tests pass with exit code 0
- [ ] stderr/stdout output matches expectations
- [ ] JSON output is valid and parseable

---

## 📝 Test Fixtures

### Required Fixtures
1. `tests/fixtures/temporal-patterns-valid.json`
2. `tests/fixtures/temporal-patterns-high-load.json`
3. `tests/fixtures/temporal-patterns-low-load.json`
4. `tests/fixtures/tomorrow-valid.json`
5. `tests/fixtures/tomorrow-empty.json`
6. `tests/fixtures/digest-2025-12-05.md` (sample daily digest)
7. `tests/fixtures/task-entry-2025-12-01.json` to `task-entry-2025-12-07.json`

---

## 🚀 Next Steps

1. **Implement Tests**: Create Jest/Pytest test suite using these cases
2. **CI Integration**: Add to GitHub Actions workflow
3. **Coverage Report**: Aim for >80% code coverage
4. **Documentation**: Link test results to `docs/cortex/v1.3-intelligence.md`

---

**Last Updated**: 2025-12-05  
**Status**: Test cases defined, implementation pending
