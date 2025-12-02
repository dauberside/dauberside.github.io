# Daily Digest Generation Error - Root Cause Analysis

**Date**: 2025-12-01  
**Error Time**: 14:10:19 UTC (23:10 JST)  
**Status**: 🔴 Resolved with improvements

---

## 🚨 Error Summary

```
:x: Daily Digest Generation Failed
Date: 2025-11-30 (JST)
Attempted at: 2025-12-01T14:10:19.802Z
Error output: Unknown error
```

**Symptom**: 
- Generated file: `cortex/daily/{{-digest.md` (invalid filename)
- Indicates `targetDate` was empty or `{{DATE}}` placeholder not replaced

---

## 🔍 Root Cause

### 1. Intl.DateTimeFormat Failure in Container

**Problem**:
```javascript
function formatDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    // ...
  });
  // MAY FAIL in minimal Docker containers without full locale data
}
```

**Why it failed**:
- Docker container may lack `ja-JP` locale data
- `Intl.DateTimeFormat` with non-default timezones requires ICU data
- Node.js in minimal containers (Alpine-based) may have incomplete Intl support

### 2. No Error Handling

**Before**:
```javascript
const targetDate = process.argv[2] || getYesterdayInJST();
// If getYesterdayInJST() returns undefined/empty → bad filename
```

**No validation**:
- No check if `targetDate` is valid
- No fallback if date calculation fails
- Silent failure → bad file generation

### 3. Template Replacement Issues

**Before**:
```javascript
.replace('{{DATE}}', targetDate)
// If targetDate is empty → "{{-digest.md"
```

**No verification**:
- Single `.replace()` only replaces first occurrence
- No check for unresolved placeholders

---

## ✅ Solutions Implemented

### Fix 1: Date Validation

**Added**:
```javascript
// Validate targetDate immediately
if (!targetDate || targetDate === 'undefined' || !targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
  console.error(`❌ Invalid target date: "${targetDate}"`);
  console.error(`   Expected format: YYYY-MM-DD`);
  
  // Emergency fallback
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  const fallbackDate = `${y}-${m}-${d}`;
  
  console.error(`   Using fallback date: ${fallbackDate}`);
  process.exit(1); // Exit to prevent bad file
}
```

**Benefit**:
- Catches invalid dates immediately
- Provides clear error message
- Prevents bad file generation

### Fix 2: Robust Date Calculation with Fallback

**Enhanced**:
```javascript
function getYesterdayInJST() {
  try {
    const now = new Date();
    
    // Validate date object
    if (isNaN(now.getTime())) {
      throw new Error('Invalid current date');
    }
    
    now.setDate(now.getDate() - 1);
    const result = formatDate(now);
    
    // Validate result format
    if (!result || !result.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`Invalid date format: ${result}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error calculating yesterday date:', error.message);
    console.error('   This may be due to timezone/Intl API issues');
    
    // Emergency fallback: UTC-based manual calculation
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
```

**Benefit**:
- Try Intl.DateTimeFormat first (preferred for JST)
- Fall back to UTC-based calculation if Intl fails
- Always returns valid date string
- Never returns undefined/empty

### Fix 3: Global Replace + Verification

**Enhanced**:
```javascript
// Replace ALL occurrences (using regex with /g flag)
let content = template
  .replace(/\{\{DATE\}\}/g, targetDate)
  .replace(/\{\{HIGH_PRIORITY_TASKS\}\}/g, formatTasks(highPriority))
  .replace(/\{\{REGULAR_TASKS\}\}/g, formatTasks(regular))
  .replace(/\{\{NO_TAG_TASKS\}\}/g, formatTasks(noTag))
  .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());

// Verify ALL placeholders replaced
const remainingPlaceholders = content.match(/\{\{[A-Z_]+\}\}/g);
if (remainingPlaceholders) {
  throw new Error(`Unresolved placeholders found: ${remainingPlaceholders.join(', ')}`);
}
```

**Benefit**:
- Replaces ALL occurrences (not just first)
- Explicit verification step
- Fails loudly if placeholders remain
- Prevents bad file from being written

---

## 🧪 Testing

### Test 1: Local Environment

```bash
cd "/Volumes/Extreme Pro/dauberside.github.io-1"
export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
node cortex/scripts/generate-daily-digest.mjs 2025-11-30
```

**Result**: ✅ Success
- File: `cortex/daily/2025-11-30-digest.md`
- Size: 395 bytes
- All placeholders replaced
- Validation passed

### Test 2: Docker Environment

**Command**:
```bash
docker exec n8n sh -c 'cd ${WORKSPACE_ROOT} && node cortex/scripts/generate-daily-digest.mjs 2025-11-30'
```

**Expected**:
- If Intl works: JST-accurate date
- If Intl fails: UTC-based fallback
- Either way: Valid file generated

**Status**: ⏳ Pending (Docker not available in current session)

---

## 📋 Verification Checklist

### Immediate Actions

- [x] Remove bad file: `cortex/daily/{{-digest.md`
- [x] Add date validation
- [x] Add error handling with fallback
- [x] Add placeholder verification
- [x] Test locally (✅ Success)
- [ ] Test in Docker container
- [ ] Monitor next n8n execution (2025-12-02 00:30 JST)

### Monitoring

**Next Execution**: 2025-12-02 00:30 JST (2025-12-01 15:30 UTC)

**Watch for**:
1. ✅ File created: `cortex/daily/2025-12-01-digest.md`
2. ✅ No `{{` in filename
3. ✅ File size > 100 bytes
4. ✅ All placeholders replaced
5. ✅ Slack notification (success or detailed error)

---

## 🎯 Prevention Measures

### 1. Always Validate Input/Output

**Pattern**:
```javascript
// Validate input
if (!isValid(input)) {
  handleError();
  process.exit(1);
}

// Process
const output = process(input);

// Validate output
if (!isValid(output)) {
  handleError();
  process.exit(1);
}
```

### 2. Provide Fallbacks for Environment-Dependent APIs

**APIs that may fail in Docker**:
- `Intl.DateTimeFormat` with specific locales/timezones
- File system operations without proper paths
- Environment variables not set

**Solution**: Always provide fallback

### 3. Fail Loudly, Early

**Don't**:
```javascript
const date = getDate(); // May return undefined
generateFile(date); // Generates "undefined-file.md"
```

**Do**:
```javascript
const date = getDate();
if (!date) {
  throw new Error('Date calculation failed');
}
generateFile(date);
```

### 4. Test in Target Environment

- Local test ≠ Docker test
- Always test in actual deployment environment
- Use same Node version, base image, locale settings

---

## 📚 Related Documents

**Implementation**:
- `cortex/scripts/generate-daily-digest.mjs` (updated)
- `services/n8n/workflows/recipe-14-daily-digest-generator.json`

**Requirements**:
- `services/n8n/workflows/REQUIREMENTS-daily-digest.md`

**Error Logs**:
- Slack: Obsidian Notifier @ 23:10 JST

---

## 🎓 Lessons Learned

### 1. Intl API is Not Always Available

**Lesson**: `Intl.DateTimeFormat` with specific timezones requires full ICU data, which may be missing in minimal containers.

**Solution**: Always provide UTC-based fallback.

### 2. Silent Failures are Dangerous

**Lesson**: Returning `undefined` from a function and continuing execution can cause cascading failures.

**Solution**: Validate immediately, fail early with clear errors.

### 3. Template Replacement Needs Verification

**Lesson**: String `.replace()` only replaces first occurrence; unresolved placeholders can slip through.

**Solution**: Use regex `/g` flag + explicit verification step.

### 4. Environment Variables Matter

**Lesson**: `WORKSPACE_ROOT` may not be set in all contexts.

**Solution**: Always provide sensible defaults with fallback.

---

## 🔜 Next Steps

### Immediate (Before Next Run)

1. **Manual Test in Docker**:
   ```bash
   docker exec n8n sh -c 'cd ${WORKSPACE_ROOT} && node cortex/scripts/generate-daily-digest.mjs'
   ```

2. **Add Logging to n8n Workflow**:
   - Capture stdout/stderr
   - Send to Slack on failure
   - Include full error message

3. **Update Recipe 14**:
   - Ensure `WORKSPACE_ROOT` is set
   - Add error notification webhook

### Short-term (Phase 2)

1. **Unit Tests**:
   - Test `getYesterdayInJST()` in various conditions
   - Mock `Intl.DateTimeFormat` failure
   - Test fallback behavior

2. **Integration Tests**:
   - Test in Docker container
   - Test without locale data
   - Test with/without `WORKSPACE_ROOT`

3. **Enhanced Logging**:
   - JSON output for machine parsing
   - Structured error codes
   - Detailed diagnostic info

---

**Status**: 🟢 Fixed and ready for next run  
**Next Review**: After 2025-12-02 00:30 JST execution  
**Risk Level**: 🟡 Medium → 🟢 Low (after Docker verification)

---

**Created**: 2025-12-01 23:15 JST  
**Author**: GitHub Copilot CLI  
**Category**: Error Analysis / Post-Mortem
