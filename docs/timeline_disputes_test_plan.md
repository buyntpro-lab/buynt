# Timeline & Disputes System - Test Plan

## SQL Execution Order

**IMPORTANT**: Execute the migration file in Supabase SQL Editor **BEFORE** testing the UI.

### Step 1: Run the Migration

1. Open Supabase Dashboard > SQL Editor
2. Open file: `supabase/migrations/20260121_timeline_disputes_system.sql`
3. Copy the entire content and paste in SQL Editor
4. Click "Run"
5. Verify no errors in the output

### Step 2: Verification Queries

Run these queries to verify the tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('rental_events', 'disputes', 'dispute_messages');

-- Check RPCs exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'log_rental_event',
    'mark_handoff_uploaded', 
    'confirm_handoff',
    'mark_return_uploaded',
    'confirm_return',
    'complete_rental',
    'open_dispute',
    'add_dispute_message',
    'resolve_dispute'
);
```

---

## Manual Test Cases

### Prerequisites
- Two test users: `owner@test.com` and `renter@test.com`
- One item published by owner
- One rental request from renter that was accepted (creates rental)

### TC-01: Auto RENTAL_CREATED Event

**Expected**: When a rental_request is accepted, a `RENTAL_CREATED` event is automatically created.

**Steps**:
1. Login as renter
2. Request to rent an item
3. Login as owner
4. Go to Solicitudes, find the request
5. Accept the request
6. Verify rental_events table has a `RENTAL_CREATED` event

**Verify in SQL**:
```sql
SELECT * FROM rental_events WHERE rental_id = '<rental_id>' ORDER BY created_at;
```

---

### TC-02: Upload Handoff Photos Creates Event

**Expected**: When handoff photos are uploaded, a `HANDOFF_PHOTOS_UPLOADED` event is created.

**Steps**:
1. Login as owner
2. Go to Solicitudes > find accepted request
3. Scroll to "Evidencias del Alquiler"
4. Upload 3+ photos in "Fotos de Entrega" section
5. Timeline should update to show "Fotos de entrega" completed

**Verify**:
- Timeline progress bar advances
- Event shows in the timeline list

---

### TC-03: Confirm Handoff (Owner)

**Expected**: Owner can confirm handoff after photos are uploaded.

**Steps**:
1. Login as owner
2. Go to Solicitudes > find request with handoff photos
3. See "Confirmar entrega" action button
4. Click confirm
5. Timeline updates to show "Entrega confirmada"

**Verify**:
- Action button disappears after confirmation
- Event appears in timeline

---

### TC-04: Upload Return Photos Creates Event

**Expected**: When return photos are uploaded, a `RETURN_PHOTOS_UPLOADED` event is created.

**Steps**:
1. Login as renter
2. Go to Solicitudes > find request with confirmed handoff
3. Upload 3+ photos in "Fotos de Devolución" section
4. Timeline should update

---

### TC-05: Confirm Return (Renter)

**Expected**: Renter can confirm return after photos are uploaded.

**Steps**:
1. Login as renter
2. Go to Solicitudes > find request with return photos
3. See "Confirmar devolución" action button
4. Click confirm
5. Timeline updates

---

### TC-06: Complete Rental

**Expected**: Either party can complete the rental after return is confirmed.

**Steps**:
1. Login as owner OR renter
2. Go to Solicitudes > find request with confirmed return
3. See "Completar alquiler" action button
4. Click complete
5. Timeline shows 100% progress
6. "RENTAL_COMPLETED" event created
7. Rental status changes to 'completed'

---

### TC-07: Open Dispute

**Expected**: Either party can open a dispute while rental is active.

**Steps**:
1. Login as owner
2. Go to Solicitudes > find active request
3. Click "¿Hay algún problema? Abrir disputa"
4. Write reason: "El artículo llegó dañado"
5. Click "Abrir disputa"
6. Dispute panel appears with amber styling
7. `DISPUTE_OPENED` event in timeline

**Verify**:
- Other party cannot open another dispute
- Both parties can see the dispute

---

### TC-08: Dispute Messages

**Expected**: Both parties can exchange messages in the dispute.

**Steps**:
1. Login as owner (who opened the dispute)
2. Type message in dispute panel
3. Click send
4. Message appears in conversation
5. Login as renter
6. See the message from owner
7. Reply with a message
8. Both messages visible

---

### TC-09: Resolve Dispute

**Expected**: Only the party who did NOT open the dispute can resolve it.

**Steps**:
1. Login as renter (owner opened the dispute)
2. Go to dispute panel
3. Click "Marcar como resuelta"
4. Write resolution: "Acordamos reembolso del 50%"
5. Click "Resolver disputa"
6. Dispute panel turns green
7. `DISPUTE_RESOLVED` event in timeline

**Verify**:
- Opener cannot resolve their own dispute
- Resolution note is visible to both parties

---

### TC-10: RLS Security

**Expected**: Users cannot see other users' rental events or disputes.

**Steps**:
1. Create a third user `hacker@test.com`
2. Try to access rental_events via direct Supabase query
3. Should return empty results

**Verify in SQL** (as RLS user):
```sql
-- This should return nothing for non-participants
SELECT * FROM rental_events WHERE rental_id = '<other_users_rental>';
SELECT * FROM disputes WHERE rental_id = '<other_users_rental>';
```

---

### TC-11: Rate Limiting

**Expected**: Users cannot spam the system with too many actions.

**Steps**:
1. Try to call `confirm_handoff` multiple times in rapid succession
2. After the limit (configured in SQL), should get error
3. Wait for window to pass, can call again

---

### TC-12: Audit Logging

**Expected**: All actions create entries in `audit_events`.

**Verify in SQL**:
```sql
SELECT * FROM audit_events 
WHERE target_type = 'rental_event' OR target_type = 'dispute'
ORDER BY created_at DESC
LIMIT 20;
```

---

### TC-13: Notifications

**Expected**: Actions send notifications to the other party.

**Verify in SQL**:
```sql
SELECT * FROM notifications 
WHERE type IN ('HANDOFF_CONFIRMED', 'RETURN_CONFIRMED', 'RENTAL_COMPLETED', 'DISPUTE_OPENED', 'DISPUTE_MESSAGE', 'DISPUTE_RESOLVED')
ORDER BY created_at DESC;
```

---

## Edge Cases

### EC-01: Already Completed Rental
- Try to confirm handoff on completed rental → Should fail
- Try to open dispute on completed rental → Should fail (or only allow if configured)

### EC-02: Cancelled Rental
- All actions should be blocked
- Timeline should show cancelled state

### EC-03: Duplicate Event Prevention
- Try to mark handoff uploaded twice → Should only create one event
- Try to confirm handoff twice → Should fail second time

### EC-04: No Photos Uploaded
- Confirm buttons should NOT appear until photos are uploaded

---

## Files Modified/Created

### New Files
- `src/services/rentalEventsService.ts`
- `src/services/disputesService.ts`
- `src/components/rental/RentalTimeline.tsx`
- `src/components/rental/RentalActions.tsx`
- `src/components/rental/DisputePanel.tsx`
- `supabase/migrations/20260121_timeline_disputes_system.sql`

### Modified Files
- `src/services/types.ts` (added RentalEvent, Dispute, DisputeMessage types)
- `src/services/itemImagesService.ts` (bookingMediaService.upload calls RPC)
- `src/pages/SolicitudDetail.tsx` (integrated new components)
- `src/components/booking/BookingEvidence.tsx` (added onUploadComplete callback)

---

## Known Limitations (MVP)

1. **No admin resolution**: Only participants can resolve disputes (no admin panel)
2. **No partial refunds**: Disputes are binary open/resolved (no payment integration)
3. **No re-opening**: Once resolved, a dispute cannot be re-opened
4. **Single dispute per rental**: Only one dispute can be open at a time
5. **No file attachments in disputes**: Only text messages
