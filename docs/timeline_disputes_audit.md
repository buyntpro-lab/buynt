# Timeline & Disputes - Audit Report (FASE 0)

**Date:** 2026-01-21  
**Objective:** Implement rental timeline events + minimal disputes system  
**Status:** AUDIT COMPLETE - Ready for implementation

---

## 1. Executive Summary

### Current State
- ✅ Rentals system exists with `rental_requests` → `rentals` flow
- ✅ `booking_media` table exists for handoff/return photos
- ✅ `BookingEvidence` component uploads photos to `booking-proof-private` bucket
- ❌ NO timeline events system - photos upload silently with no state tracking
- ❌ NO disputes system - doesn't exist at all
- ❌ NO handoff/return confirmation flow - owner cannot mark steps complete
- ❌ NO complete_rental action - rentals stay `active` forever

### Key Findings
1. **`SolicitudDetail.tsx`** shows `BookingEvidence` component for handoff/return but has NO timeline
2. **`Profile.tsx`** shows "Mis Alquileres" tab using `bookingsService.getByUserId()` (legacy fallback)
3. **`booking_media`** inserts do NOT trigger any audit events or notifications
4. **`rentals.status`** can only be `active | completed | cancelled` - no intermediate states
5. **`is_rental_participant()`** function exists and works - REUSE for new tables

---

## 2. Files Inventory

### 2.1 Pages to Modify

| File | Current State | Changes Needed |
|------|--------------|----------------|
| `src/pages/SolicitudDetail.tsx` | Shows photos upload but no timeline | Add timeline component, action buttons |
| `src/pages/Profile.tsx` | Uses legacy bookingsService | Update to use rentalsService |

### 2.2 Services to Modify

| File | Current State | Changes Needed |
|------|--------------|----------------|
| `src/services/rentalRequestsService.ts` | Has `rentalsService.listMine()` | Add timeline methods, confirm actions |
| `src/services/itemImagesService.ts` | `bookingMediaService.upload()` | Call RPC after upload to log event |

### 2.3 Components to Create

| File | Purpose |
|------|---------|
| `src/components/rental/RentalTimeline.tsx` | Vertical timeline showing events |
| `src/components/rental/RentalActions.tsx` | Action buttons based on state |
| `src/components/rental/DisputePanel.tsx` | Open/view/resolve disputes |

### 2.4 Types to Add

```typescript
// In src/services/types.ts

export type RentalEventType = 
    | 'RENTAL_CREATED'
    | 'HANDOFF_PHOTOS_UPLOADED'
    | 'HANDOFF_CONFIRMED'
    | 'RETURN_PHOTOS_UPLOADED'
    | 'RETURN_CONFIRMED'
    | 'RENTAL_COMPLETED'
    | 'RENTAL_CANCELLED'
    | 'DISPUTE_OPENED'
    | 'DISPUTE_RESOLVED';

export interface RentalEvent {
    id: string;
    rental_id: string;
    event_type: RentalEventType;
    actor_id: string | null;
    payload: Record<string, any>;
    created_at: string;
}

export type DisputeStatus = 'open' | 'resolved' | 'closed';

export interface Dispute {
    id: string;
    rental_id: string;
    opened_by: string;
    reason: string;
    status: DisputeStatus;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
    resolution_note: string | null;
}

export interface DisputeMessage {
    id: string;
    dispute_id: string;
    sender_id: string;
    body: string;
    created_at: string;
}
```

---

## 3. Supabase Schema Analysis

### 3.1 Existing Functions to REUSE

| Function | Purpose | Used For |
|----------|---------|----------|
| `is_rental_participant(rental_id, user_id)` | Check if user is owner/renter | RLS policies for new tables |
| `check_rate_limit(action, max, window)` | Rate limiting | Dispute messages |
| `log_audit_event(type, target_type, target_id, payload)` | Audit logging | All new events |
| `create_notification(user_id, type, conv_id, payload)` | Notifications | Notify other party |
| `set_updated_at()` | Trigger for updated_at | disputes.updated_at |

### 3.2 Existing Triggers to Note

| Trigger | Table | Function |
|---------|-------|----------|
| `trg_audit_rentals` | rentals | `audit_rentals_changes()` |
| `trg_audit_rental_requests` | rental_requests | `audit_rental_requests_changes()` |
| `trg_rentals_updated_at` | rentals | `set_updated_at()` |

### 3.3 Current Rental Status Flow

```
rental_requests.status: pending → accepted → (creates rental)
rentals.status: active → (completed | cancelled)
```

**Problem:** No intermediate states between `active` and `completed`. Need events.

### 3.4 booking_media Current Behavior

- Photos upload directly to `booking_media` table
- NO event/audit logging on insert
- NO notification to other party
- NO state tracking (e.g., "handoff done", "return done")

---

## 4. Proposed Architecture

### 4.1 Event-Driven Timeline

```
rental_events table (source of truth for UI timeline)
├── RENTAL_CREATED (auto when rental inserted)
├── HANDOFF_PHOTOS_UPLOADED (after media upload)
├── HANDOFF_CONFIRMED (owner action)
├── RETURN_PHOTOS_UPLOADED (after media upload)
├── RETURN_CONFIRMED (owner action)
├── RENTAL_COMPLETED (owner action)
├── DISPUTE_OPENED (either party)
└── DISPUTE_RESOLVED (either party)
```

### 4.2 Integration Strategy

**Option A (Recommended): Frontend calls RPC after upload**
- `bookingMediaService.upload()` succeeds → call `mark_handoff_uploaded()` RPC
- Simple, explicit, testable
- Frontend controls when event is logged

**Option B: Database trigger on booking_media**
- Automatic but complex
- Would need to detect "new upload" vs "existing"
- Harder to debug

**Decision: Use Option A**

### 4.3 Notification Flow

```
Event Created → RPC logs event → RPC calls create_notification()
                              → Notification appears in UI
```

---

## 5. Risk Assessment

### High Risk
| Risk | Mitigation |
|------|------------|
| Breaking existing rental flow | Keep rentals.status as-is, add events alongside |
| RLS blocking new tables | Reuse is_rental_participant() proven pattern |
| Performance on timeline query | Add index on (rental_id, created_at DESC) |

### Medium Risk
| Risk | Mitigation |
|------|------------|
| Notifications not delivered | Test with existing chat notification system first |
| Rate limit too strict | Use same limits as messages (20/min) |

### Low Risk
| Risk | Mitigation |
|------|------------|
| UI regression | Timeline is additive, doesn't break existing |
| Type errors | Add types before implementation |

---

## 6. Dependencies

### External (Already Exist)
- ✅ `booking-proof-private` storage bucket with RLS
- ✅ `rentals` and `rental_requests` tables
- ✅ `notifications` table
- ✅ `is_rental_participant()` function

### New (To Create)
- ⬜ `rental_events` table
- ⬜ `disputes` table
- ⬜ `dispute_messages` table
- ⬜ RPCs for events and disputes
- ⬜ UI components

---

## 7. Implementation Order

### Phase 1: Database (SQL)
1. Create `rental_events` table
2. Create `disputes` table
3. Create `dispute_messages` table
4. Apply triggers for updated_at
5. Enable RLS and create policies
6. Create RPCs for timeline events
7. Create RPCs for disputes
8. Add trigger to log RENTAL_CREATED on rental insert

### Phase 2: Frontend Services
1. Add types to `types.ts`
2. Create `rentalEventsService.ts`
3. Create `disputesService.ts`
4. Modify `bookingMediaService.upload()` to call RPC

### Phase 3: UI Components
1. Create `RentalTimeline.tsx`
2. Create `RentalActions.tsx`
3. Create `DisputePanel.tsx`
4. Update `SolicitudDetail.tsx` with new components

### Phase 4: Testing
1. Test full flow: photos → events → timeline
2. Test disputes: open → message → resolve
3. Test RLS: unauthorized users cannot access
4. Test notifications work

---

## 8. SQL Files to Create

| File | Purpose |
|------|---------|
| `20260121_timeline_disputes_schema.sql` | Tables + indexes |
| `20260121_timeline_disputes_rls.sql` | RLS policies |
| `20260121_timeline_disputes_rpcs.sql` | Functions |
| `20260121_timeline_disputes_triggers.sql` | Auto-event triggers |

---

## 9. Questions Resolved

1. **Should events replace audit_events?** NO - events are for UI, audit_events for compliance
2. **Who can confirm handoff/return?** Owner only (has physical possession knowledge)
3. **Who can complete rental?** Owner only
4. **Can disputes be reopened?** NO - create new dispute instead
5. **Rate limit for disputes?** Yes, use check_rate_limit('open_dispute', 5, 60)

---

## 10. Checklist Before Implementation

- [x] Verified `is_rental_participant()` exists and works
- [x] Verified `check_rate_limit()` exists and works
- [x] Verified `create_notification()` exists and works
- [x] Verified `log_audit_event()` exists and works
- [x] Verified `set_updated_at()` trigger exists
- [x] Verified `booking_media` table structure
- [x] Verified `SolicitudDetail.tsx` shows rental_id for accepted requests
- [x] Confirmed NO existing disputes system

---

**AUDIT COMPLETE - Proceed to FASE 1: SQL Schema**
