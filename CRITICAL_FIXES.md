# CRITICAL FIXES - DO NOT OVERWRITE

> **IMPORTANT:** This document lists all critical fixes that MUST be preserved in any deployment.
> Before deploying ANY code changes, verify these fixes are present in the codebase.

---

## 🔴 CRITICAL FIX #1: Pydantic Response Model Removal (v2.5.9)

**File:** `/app/backend/routes/mechanic.py`

**Line ~201:**
```python
# ❌ WRONG - Causes 500 error when car_year is int
@router.get("/inspections", response_model=List[MechanicInspectionResponse])

# ✅ CORRECT - No response_model validation
@router.get("/inspections")
```

**Why:** The Pydantic `response_model` enforces strict type validation. When `car_year` in MongoDB is stored as `int` instead of `str`, Pydantic throws a validation error causing 500 Internal Server Error.

**Symptoms if missing:**
- All mechanics get 500 error on `/mechanic/inspections`
- "Internal Server Error" with no useful logs
- Endpoint code never executes

---

## 🔴 CRITICAL FIX #2: Safe String Conversion (v2.5.4+)

**Files:** 
- `/app/backend/routes/mechanic.py` (Line ~287-293)
- `/app/backend/server.py` (multiple locations)

**Code Pattern:**
```python
def safe_str(val, default=""):
    if val is None:
        return default
    try:
        return str(val) if val else default
    except:
        return default

# Use for all potentially integer fields:
"manufacturingYear": safe_str(insp.get("car_year", insp.get("manufacturing_year", ""))),
"odometerReading": safe_str(insp.get("odometer_reading")),
```

**Why:** MongoDB data has inconsistent types. `car_year` can be `int` (2021) or `str` ("2021"). Without conversion, JSON serialization or Pydantic validation fails.

**Fields requiring safe_str:**
- `car_year` / `manufacturing_year`
- `odometer_reading`
- `car_number`
- Any field that might be stored as int in some documents

---

## 🔴 CRITICAL FIX #3: JSONResponse Wrapper (v2.5.4+)

**Files:** 
- `/app/backend/routes/mechanic.py`
- `/app/backend/server.py`

**Code Pattern:**
```python
from fastapi.responses import JSONResponse

# ❌ WRONG - Subject to automatic Pydantic validation
return result

# ✅ CORRECT - Bypasses Pydantic validation
return JSONResponse(content=result)
```

**Why:** FastAPI automatically validates return values. Using `JSONResponse` explicitly bypasses this validation, preventing 500 errors from type mismatches.

---

## 🔴 CRITICAL FIX #4: Global Try-Catch in Mechanic Endpoints (v2.5.7+)

**File:** `/app/backend/routes/mechanic.py`

**Code Pattern:**
```python
@router.get("/inspections")
async def get_mechanic_inspections(...):
    try:
        # ALL code inside try block
        mechanic_id = current_user["id"]
        # ... rest of function
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"CRITICAL ERROR: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(content=[], status_code=200)
```

**Why:** Unhandled exceptions return 500 error with no useful information. Global try-catch ensures graceful degradation and proper logging.

---

## 🔴 CRITICAL FIX #5: Regex Escaping for City/Name Queries (v2.5.6+)

**Files:** 
- `/app/backend/routes/mechanic.py`
- `/app/backend/server.py`

**Code Pattern:**
```python
import re

# ❌ WRONG - Special characters in names can break regex
{"mechanic_name": {"$regex": f"^{mechanic_name}$", "$options": "i"}}

# ✅ CORRECT - Escape special regex characters
{"mechanic_name": {"$regex": f"^{re.escape(mechanic_name)}$", "$options": "i"}}
```

**Why:** Names or cities containing regex special characters (like `.`, `+`, `()`) will cause invalid regex patterns or unexpected matches.

---

## 🟡 IMPORTANT FIX #6: Q&A Screen Uses Questionnaire Endpoint (v2.5.5)

**File:** `/app/mechanic-app-native/app/category/[...params].tsx`

**Code Pattern:**
```javascript
// Q&A screen should get answers from questionnaire (same as Categories)
const questionnaireAnswers = data?.existing_answers || {};
const serverAnswers = questionnaireAnswers;
```

**Why:** The `getInspection` endpoint's `inspection_answers` field was inconsistent. Using `existing_answers` from questionnaire endpoint ensures consistency between Categories and Q&A screens.

---

## 🟡 IMPORTANT FIX #7: Cache Clearing After Answer Save (v2.5.4)

**File:** `/app/mechanic-app-native/src/lib/api.ts`

**Code Pattern:**
```javascript
// After successful save
inspectionsApi.clearQuestionnaireCache(id);
diagLogger.info(`CACHE_CLEARED: ${id}`, { reason: 'answer_saved' });
```

**Why:** Without cache clearing, refreshing after save shows old data because questionnaire is cached for 5 minutes.

---

## 🟡 IMPORTANT FIX #8: Force Refresh on Categories Screen (v2.5.5)

**File:** `/app/mechanic-app-native/app/inspection-categories.tsx`

**Code Pattern:**
```javascript
// Always force refresh to get latest answers
const [data, inspectionData] = await Promise.all([
  inspectionsApi.getQuestionnaire(currentInspectionId, true), // forceRefresh=true
  inspectionsApi.getInspection(currentInspectionId)
]);
```

**Why:** Ensures mechanics always see the latest answer counts after saving.

---

## Version History

| Version | Date | Critical Fixes |
|---------|------|----------------|
| v2.5.9 | 2026-03-05 | ROOT CAUSE: Removed response_model from routes/mechanic.py |
| v2.5.8 | 2026-03-05 | Added public debug endpoint |
| v2.5.7 | 2026-03-05 | Wrapped entire function in try-catch |
| v2.5.6 | 2026-03-05 | Regex escaping, global error handler |
| v2.5.5 | 2026-03-05 | Q&A uses questionnaire endpoint |
| v2.5.4 | 2026-03-05 | Cache clearing, JSONResponse wrapper |
| v2.5.2 | 2026-03-04 | Safe string conversion for all fields |
| v2.5.1 | 2026-03-04 | Initial manufacturingYear fix |

---

## Pre-Deployment Checklist

Before deploying ANY backend changes, verify:

- [ ] `routes/mechanic.py` line ~201 has NO `response_model` on `/inspections` endpoint
- [ ] `safe_str()` function exists and is used for `manufacturingYear`, `odometerReading`
- [ ] All mechanic endpoints return `JSONResponse(content=...)` not raw dict/list
- [ ] All mechanic endpoints have try-catch wrapper
- [ ] All regex queries use `re.escape()` for user input
- [ ] Version number is incremented (check `/api/version`)

---

## Quick Verification Commands

```bash
# Check if response_model is removed
grep -n "response_model.*MechanicInspection" /app/backend/routes/mechanic.py

# Check if safe_str exists
grep -n "def safe_str" /app/backend/routes/mechanic.py

# Check if JSONResponse is used
grep -n "return JSONResponse" /app/backend/routes/mechanic.py

# Check current version
curl https://crmdev.wisedrive.com/api/version | jq .version
```

---

**Last Updated:** 2026-03-05
**Minimum Safe Version:** v2.5.9
