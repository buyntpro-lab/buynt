# Consolidation A - Test Plan

**Date:** 2025-01-21  
**Purpose:** Verify all request flows work after legacy system removal

---

## Prerequisites

1. ✅ Build passes: `npm run build`
2. ⬜ RLS lockdown migration applied in Supabase
3. ⬜ App deployed (or running locally via `npm run dev`)
4. ⬜ Two test user accounts available

---

## Test Scenarios

### 1. Route Redirects

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 1.1 `/my-requests` redirect | Navigate to `/my-requests` | Redirects to `/solicitudes` | ⬜ |
| 1.2 `/inbox` redirect | Navigate to `/inbox` | Redirects to `/solicitudes` | ⬜ |
| 1.3 `/solicitudes` access | Navigate to `/solicitudes` when logged in | Shows solicitudes page with tabs | ⬜ |
| 1.4 Protected route | Navigate to `/solicitudes` when logged out | Redirects to login | ⬜ |

---

### 2. Create Rental Request Flow

**Setup:** User A owns an item, User B wants to rent it

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 2.1 View item detail | As User B, go to item owned by User A | See BookingWidget with date picker | ⬜ |
| 2.2 Select dates | Pick start/end dates | Price calculation shown | ⬜ |
| 2.3 Submit request | Click "Solicitar" button | Toast success, request created | ⬜ |
| 2.4 View sent request | Go to `/solicitudes` → "Enviadas" tab | See new request with pending status | ⬜ |
| 2.5 Blocked dates | Try to book same dates | Dates should be disabled | ⬜ |

---

### 3. Manage Incoming Requests (Owner)

**Setup:** User A has pending request from User B

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 3.1 View incoming | As User A, go to `/solicitudes` → "Recibidas" tab | See pending request from User B | ⬜ |
| 3.2 Accept request | Click "Aceptar" | Status changes to "accepted", rental created | ⬜ |
| 3.3 Reject request | Click "Rechazar" on another request | Status changes to "rejected" | ⬜ |
| 3.4 Realtime update | Accept/reject in another tab | First tab updates automatically | ⬜ |

---

### 4. Cancel Request (Renter)

**Setup:** User B has a pending request

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 4.1 View detail | Click on pending request in "Enviadas" | Opens `/solicitudes/:id` detail page | ⬜ |
| 4.2 Cancel request | Click "Cancelar" button | Status changes to "cancelled" | ⬜ |
| 4.3 Cannot cancel accepted | Try to cancel accepted request | Button not shown or disabled | ⬜ |

---

### 5. Request Detail Page

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 5.1 View as renter | Open detail of sent request | See item info, dates, prices, cancel button | ⬜ |
| 5.2 View as owner | Open detail of received request | See item info, dates, prices, accept/reject | ⬜ |
| 5.3 Invalid ID | Navigate to `/solicitudes/invalid-uuid` | Error message or redirect | ⬜ |
| 5.4 Other user's request | Try to access request you're not part of | Access denied or not found | ⬜ |

---

### 6. UI Badge Counts

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6.1 Header badge | Have pending incoming requests | Badge shows count in header | ⬜ |
| 6.2 Bottom nav badge | Have pending incoming requests | Badge shows count in mobile nav | ⬜ |
| 6.3 Badge clears | Accept all pending requests | Badge disappears | ⬜ |

---

### 7. RLS Security (Post-Migration)

**Run these AFTER applying `20250121_lockdown_legacy_requests.sql`**

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 7.1 Legacy table locked | Try `SELECT * FROM requests` in SQL Editor | Access denied or empty | ⬜ |
| 7.2 No console errors | Use app normally | No Supabase errors for `requests` table | ⬜ |

---

### 8. Error Handling

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 8.1 Network error | Disconnect network, try to create request | Graceful error message | ⬜ |
| 8.2 Invalid dates | Try end_date before start_date | Validation error | ⬜ |
| 8.3 Own item | Try to request your own item | Prevented or error | ⬜ |

---

## Regression Tests

| Area | Test | Expected | Status |
|------|------|----------|--------|
| Items | Can still browse `/explorar` | Items load | ⬜ |
| Items | Can still publish new item | Item created | ⬜ |
| Items | Can still edit own item | Item updated | ⬜ |
| Chat | Can still send messages | Message sent | ⬜ |
| Auth | Can login/logout | Session works | ⬜ |
| Profile | Can view/edit profile | Profile works | ⬜ |

---

## Test Accounts

| User | Email | Role |
|------|-------|------|
| User A | (owner) | Has items listed |
| User B | (renter) | Requests items |

---

## Known Issues

_None identified yet_

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | AI Agent | 2025-01-21 | ✅ |
| QA Tester | | | ⬜ |
| Product Owner | | | ⬜ |

---

## Console Commands for Quick Testing

```bash
# Start dev server
npm run dev

# Check for TypeScript errors
npm run build

# Check for lint issues
npm run lint
```

## SQL Verification Query

```sql
-- Verify RLS policy on requests table
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'requests';

-- Expected: One policy "LEGACY_LOCKED_deny_all_access" with qual = 'false'

-- Count pending requests (modern system)
SELECT COUNT(*) FROM rental_requests WHERE status = 'pending';
```

---

*Test plan created as part of PROMPT A consolidation task*
