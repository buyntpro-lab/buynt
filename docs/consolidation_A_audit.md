# Consolidation A - Deep Audit Report

**Date:** 2025-01-21  
**Scope:** Eliminate legacy `public.requests` table usage  
**Target:** All request flow through `rental_requests` → `rentals` with RPCs

---

## 1. Executive Summary

### Critical Discovery
The codebase has **TWO PARALLEL request systems** that create confusion, security holes, and maintenance burden:

| System | Data Source | Service | Pages | Status |
|--------|-------------|---------|-------|--------|
| **LEGACY** | localStorage + `requests` table | `db.ts` + `supabaseDb.ts` | `MyRequests.tsx` | ❌ DELETE |
| **MODERN** | `rental_requests` + RPCs | `rentalRequestsService.ts` | `Solicitudes.tsx`, `SolicitudDetail.tsx` | ✅ KEEP |

### Shocking Finding
**`MyRequests.tsx` uses localStorage, not even Supabase!** This page is completely non-functional for real data - it only shows mock data from `db.requests.getAll()`.

---

## 2. File Inventory

### 2.1 LEGACY Files (TO BE ELIMINATED/REFACTORED)

#### `src/services/db.ts` - localStorage Mock Database
```
Location: Full file
Risk: HIGH - Stores sensitive request data in client localStorage
Usage: db.requests.getAll(), db.requests.add(), db.requests.updateStatus()
Action: REMOVE db.requests object entirely
```

**Legacy `requests` methods in db.ts:**
- `db.requests.getAll()` - Returns all localStorage requests
- `db.requests.add(request)` - Adds to localStorage
- `db.requests.updateStatus(id, status)` - Updates localStorage
- `db.requests.getByOwnerContact(email)` - Filters by owner

#### `src/services/supabaseDb.ts` - Legacy Supabase Operations
```
Lines affected: 20, 173-218
Table: from('requests')
Action: REMOVE requestsService entirely
```

**Legacy methods:**
| Line | Method | Query |
|------|--------|-------|
| 173 | `requestsService.getAll()` | `from('requests').select('*')` |
| 186 | `requestsService.getByItemId()` | `from('requests').select('*').eq('item_id')` |
| 199 | `requestsService.add()` | `from('requests').insert()` |
| 213 | `requestsService.updateStatus()` | `from('requests').update()` |

Also found: `bookingsService.getByUserId()` at line 20 has fallback to `requests` table.

#### `src/pages/MyRequests.tsx` - Legacy Page
```
Line 15: const allRequests = db.requests.getAll()
Route: /my-requests
Action: DELETE entire file or redirect to /solicitudes
```

**Problems:**
1. Uses localStorage mock (`db.requests`) - not Supabase!
2. Shows `owner_contact` email when accepted (PII exposure)
3. No realtime updates
4. Completely disconnected from production data

### 2.2 MODERN Files (TO KEEP)

#### `src/services/rentalRequestsService.ts` - Modern Service ✅
```
Lines: 1-349 (full file)
Uses: RPCs + rental_requests_with_items view
Status: PRODUCTION READY
```

**Modern methods using RPCs:**
| Method | RPC/View |
|--------|----------|
| `create()` | `create_rental_request` RPC |
| `respond()` | `respond_rental_request` RPC |
| `cancel()` | `cancel_rental_request` RPC |
| `getById()` | `rental_requests_with_items` view |
| `listOutgoing()` | `rental_requests_with_items` view |
| `listIncoming()` | `rental_requests_with_items` view |
| `getBlockedDates()` | `get_blocked_dates_for_item` RPC |

#### `src/pages/Solicitudes.tsx` - Modern Page ✅
```
Lines: 1-426
Route: /solicitudes
Uses: rentalRequestsService
Features: Tabs, realtime, proper UI
```

#### `src/pages/SolicitudDetail.tsx` - Modern Detail Page ✅
```
Route: /solicitudes/:id
Uses: rentalRequestsService.getById(), .cancel(), .respond()
```

---

## 3. Type System Analysis

### 3.1 Legacy Type (TO DEPRECATE)
```typescript
// src/services/types.ts - Line ~26
export interface Request {
    id: string;
    item_id: string;
    item_title: string;
    requester_name: string;
    requester_contact: string;
    owner_contact: string;      // PII EXPOSURE!
    message: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}
```

**Issues:**
- Exposes `owner_contact` email directly
- No `owner_id` or `renter_id` for proper auth checks
- Limited status values (no 'cancelled', 'expired')
- No pricing information

### 3.2 Modern Types (TO KEEP)
```typescript
// src/services/types.ts - Lines ~183-230
export type RentalRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface RentalRequest {
    id: string;
    item_id: string;
    owner_id: string;           // Proper UUID reference
    renter_id: string;          // Proper UUID reference
    start_date: string;
    end_date: string;
    daily_price: number;
    total_amount: number;
    status: RentalRequestStatus;
    // ... full pricing and tracking fields
}

export interface RentalRequestWithDetails extends RentalRequest {
    item_title: string;
    owner_name: string | null;  // Names from profiles, not raw emails
    renter_name: string | null;
    // ...
}
```

**Benefits:**
- Uses UUIDs for user references
- Full pricing breakdown
- Extended status options
- Joined view with item/user details

---

## 4. Route Analysis

### Current Routes (App.tsx)
```
/my-requests      → <MyRequests />      [LEGACY - localStorage]
/solicitudes      → <Solicitudes />     [MODERN - Supabase RPCs]
/solicitudes/:id  → <SolicitudDetail /> [MODERN - Supabase RPCs]
```

### Recommendation
```
/my-requests      → REDIRECT to /solicitudes OR DELETE
/solicitudes      → KEEP (primary requests page)
/solicitudes/:id  → KEEP (detail page)
```

---

## 5. Database Table Analysis

### `public.requests` (LEGACY - TO LOCK DOWN)
```sql
-- Schema (from migration history)
CREATE TABLE requests (
    id UUID PRIMARY KEY,
    item_id UUID,
    item_title TEXT,
    requester_name TEXT,
    requester_contact TEXT,     -- Raw email!
    owner_contact TEXT,         -- Raw email!
    message TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
);
```

**Problems:**
- Stores raw emails (PII exposure)
- No FK constraints
- No RLS policies protecting data
- Unused in production but still accessible

### `public.rental_requests` (MODERN - SOURCE OF TRUTH)
```sql
-- Schema (from 20260113_rental_requests_system.sql)
CREATE TABLE rental_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id),
    owner_id UUID NOT NULL,
    renter_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    daily_price NUMERIC(10,2),
    days_count INTEGER,
    deposit_amount NUMERIC(10,2),
    service_fee NUMERIC(10,2),
    total_amount NUMERIC(10,2),
    currency TEXT DEFAULT 'EUR',
    note TEXT,
    status rental_request_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    rental_id UUID REFERENCES rentals(id)
);
```

**Benefits:**
- Proper FK constraints
- UUID user references (not emails)
- Full audit trail
- RLS policies in place
- RPCs for business logic

---

## 6. Risk Assessment

### High Risk Items
| Item | Risk | Impact |
|------|------|--------|
| `MyRequests.tsx` using localStorage | Data loss, no persistence | Users see stale/no data |
| `requestsService` in supabaseDb.ts | Writes to wrong table | Data inconsistency |
| Legacy `Request` type | Encourages wrong patterns | Future code might use it |
| `/my-requests` route | User confusion | Two places to check requests |

### Security Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| `owner_contact` exposure in legacy type | HIGH | Remove from types, use modern service |
| `requests` table still readable | MEDIUM | Apply RLS deny-all policy |
| localStorage storing request data | MEDIUM | Remove db.requests entirely |

---

## 7. Consolidation Plan

### FASE 1: Plan
1. **Source of Truth**: `rental_requests_with_items` view
2. **RPCs**: Use existing `create_rental_request`, `respond_rental_request`, `cancel_rental_request`
3. **Route Decision**: Redirect `/my-requests` → `/solicitudes`

### FASE 2: Code Changes
1. **DELETE** `src/pages/MyRequests.tsx`
2. **REMOVE** `db.requests` object from `src/services/db.ts`
3. **REMOVE** `requestsService` from `src/services/supabaseDb.ts`
4. **DEPRECATE** `Request` interface in `src/services/types.ts`
5. **UPDATE** `App.tsx` to redirect `/my-requests` → `/solicitudes`
6. **CHECK** any remaining imports of deleted code

### FASE 3: Database Lockdown
Apply RLS deny-all on `public.requests`:
```sql
-- From 20260122_security_hardening.sql
DROP POLICY IF EXISTS "Deny all requests table access" ON requests;
CREATE POLICY "Deny all requests table access" ON requests
    FOR ALL USING (false);
```

### FASE 4: Data Migration (Optional)
```sql
-- Migrate any orphaned data from requests → rental_requests
-- Only if there's valuable data in requests table
SELECT COUNT(*) FROM requests WHERE created_at > '2025-01-01';
```

### FASE 5: Verification
1. Run `npm run build` - no type errors
2. Test `/solicitudes` flow end-to-end
3. Verify `/my-requests` redirects properly
4. Confirm no console errors about missing imports

---

## 8. Files to Modify (Complete List)

| File | Action | Details |
|------|--------|---------|
| `src/pages/MyRequests.tsx` | DELETE | Entire file |
| `src/services/db.ts` | MODIFY | Remove `requests` object (~30 lines) |
| `src/services/supabaseDb.ts` | MODIFY | Remove `requestsService` (~50 lines) |
| `src/services/types.ts` | MODIFY | Deprecate `Request` interface |
| `src/App.tsx` | MODIFY | Remove MyRequests route or add redirect |
| Any imports of above | CHECK | grep for MyRequests, requestsService |

---

## 9. Grep Results Summary

### References to `from('requests')` (5 hits)
```
src/services/supabaseDb.ts:20   - bookingsService fallback
src/services/supabaseDb.ts:173  - requestsService.getAll
src/services/supabaseDb.ts:186  - requestsService.getByItemId
src/services/supabaseDb.ts:199  - requestsService.add
src/services/supabaseDb.ts:213  - requestsService.updateStatus
```

### References to `db.requests` (4 hits)
```
src/services/db.ts             - Definition of requests object
src/pages/MyRequests.tsx:15    - db.requests.getAll()
```

### References to modern system (20+ hits)
```
src/services/rentalRequestsService.ts  - Full modern service
src/pages/Solicitudes.tsx              - Modern UI
src/pages/SolicitudDetail.tsx          - Modern detail
```

---

## 10. Conclusion

The codebase has a clear migration path:
1. **Legacy system** is barely used (one page, localStorage-based)
2. **Modern system** is fully functional with RPCs and proper security
3. **Consolidation is low-risk** because modern system already handles all real traffic

**Recommended approach:** Delete legacy code, lock down table, update routes. No data migration needed if `requests` table is empty or contains only test data.

---

*Document generated as part of FASE 0 audit for PROMPT A consolidation task.*
