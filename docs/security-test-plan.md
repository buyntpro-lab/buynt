# Security Test Plan - Buynt Marketplace

## Overview

This document outlines manual and automated tests to verify RLS policies, storage access, rate limiting, and audit trail functionality work as expected after applying the security hardening migrations.

---

## Prerequisites

1. **Execute migrations in order:**
   ```
   supabase/migrations/20260121_setup_storage_buckets.sql
   supabase/migrations/20260121_photos_system.sql
   supabase/migrations/20260122_security_hardening.sql
   supabase/migrations/20260122_rate_limiting.sql
   ```

2. **Create test users:**
   - User A: `alice@test.com` (item owner)
   - User B: `bob@test.com` (renter)
   - User C: `carol@test.com` (third party)

3. **Create test data:**
   - Item X: owned by Alice
   - Rental Request R1: Bob → Item X
   - Conversation C1: between Alice and Bob about Item X

---

## Test Categories

### 1. Data Isolation Tests (A/B Tests)

#### TEST-1.1: User A cannot see User B's private data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Bob | Success |
| 2 | Query: `SELECT owner_contact FROM items` | Column should NOT exist (uses items_public view) |
| 3 | Query: `SELECT * FROM rental_requests WHERE renter_id != auth.uid()` | Returns empty (only own requests) |
| 4 | Query: `SELECT * FROM notifications WHERE user_id != auth.uid()` | Returns empty (RLS blocks) |

**SQL Test (run as Bob):**
```sql
-- Should return 0 rows (only Bob's notifications)
SELECT COUNT(*) FROM notifications WHERE user_id != auth.uid();

-- Should fail or return 0 (can't see Alice's requests)
SELECT * FROM rental_requests WHERE owner_id != auth.uid() AND renter_id != auth.uid();
```

#### TEST-1.2: Conversation isolation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Carol | Success |
| 2 | Query: `SELECT * FROM conversations` | Returns only Carol's conversations |
| 3 | Query: `SELECT * FROM messages WHERE conversation_id = 'C1_ID'` | Returns empty (Carol not participant) |

**SQL Test (run as Carol):**
```sql
-- C1 is conversation between Alice and Bob
-- Carol should see 0 messages
SELECT COUNT(*) FROM messages 
WHERE conversation_id = '<CONVERSATION_C1_UUID>';
-- Expected: 0
```

---

### 2. Storage Access Tests

#### TEST-2.1: Public bucket read access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As anonymous user | Not logged in |
| 2 | GET `items-public/<item-id>/image.jpg` | 200 OK (public read) |

#### TEST-2.2: Public bucket write restrictions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Bob | Success |
| 2 | Upload to `items-public/<alice-item-id>/hack.jpg` | 403 Forbidden |
| 3 | Upload to `items-public/<bob-item-id>/photo.jpg` | 200 OK |

**Client Test:**
```typescript
// Bob trying to upload to Alice's item folder
const { error } = await supabase.storage
  .from('items-public')
  .upload(`${aliceItemId}/malicious.jpg`, file);

console.log(error?.message); // Should be "not authorized" or similar
```

#### TEST-2.3: Private bucket isolation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Carol | Success |
| 2 | GET `booking-proof-private/<alice-bob-rental-id>/proof.jpg` | 403 Forbidden |
| 3 | Login as Alice | Success |
| 4 | GET `booking-proof-private/<alice-bob-rental-id>/proof.jpg` | 200 OK |

---

### 3. Mutation Permission Tests

#### TEST-3.1: Rental request status transitions

| Actor | Action | Expected |
|-------|--------|----------|
| Owner (Alice) | Update R1 status → 'accepted' | ✅ Success |
| Owner (Alice) | Update R1 status → 'cancelled' | ❌ Blocked |
| Renter (Bob) | Update R1 status → 'cancelled' | ✅ Success |
| Renter (Bob) | Update R1 status → 'accepted' | ❌ Blocked |
| Third party (Carol) | Update R1 status → anything | ❌ Blocked |

**SQL Tests:**
```sql
-- As Alice (owner), accept request
UPDATE rental_requests SET status = 'accepted' WHERE id = '<R1_ID>';
-- Expected: Success

-- As Alice (owner), try to cancel (forbidden)
UPDATE rental_requests SET status = 'cancelled' WHERE id = '<R1_ID>';
-- Expected: Error or 0 rows updated

-- As Bob (renter), cancel
UPDATE rental_requests SET status = 'cancelled' WHERE id = '<R1_ID>';
-- Expected: Success
```

#### TEST-3.2: Immutability enforcement

| Field | Change Attempt | Expected |
|-------|----------------|----------|
| rental_requests.item_id | Change to different item | ❌ Blocked by trigger |
| rental_requests.renter_id | Change to different user | ❌ Blocked by trigger |
| rental_requests.total_amount | Change price | ❌ Blocked by trigger |
| rentals.item_id | Change | ❌ Blocked by trigger |
| rentals.period | Change dates | ❌ Blocked by trigger |

**SQL Test:**
```sql
-- Should fail with trigger error
UPDATE rental_requests SET item_id = gen_random_uuid() WHERE id = '<R1_ID>';
-- Expected: ERROR: Cannot modify immutable fields

UPDATE rental_requests SET total_amount = 0.01 WHERE id = '<R1_ID>';
-- Expected: ERROR: Cannot modify immutable fields
```

---

### 4. Rate Limiting Tests

#### TEST-4.1: Message rate limit (20/min)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send 20 messages rapidly | All succeed |
| 2 | Send 21st message | Error: rate_limit_exceeded |
| 3 | Wait 1 minute | |
| 4 | Send message | Success |

**Client Test:**
```typescript
for (let i = 0; i < 21; i++) {
  const { data, error } = await supabase.rpc('send_message_rate_limited', {
    p_conversation_id: conversationId,
    p_body: `Test message ${i}`
  });
  
  if (i === 20) {
    console.log(error?.message); // Should contain "rate_limit"
  }
}
```

#### TEST-4.2: Rental request rate limit (10/hour)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create 10 rental requests | All succeed |
| 2 | Create 11th request | Error: rate_limit_exceeded |

---

### 5. Audit Trail Tests

#### TEST-5.1: Audit events captured

| Action | Expected audit_events record |
|--------|------------------------------|
| Create item | action='INSERT', table_name='items' |
| Update item | action='UPDATE', table_name='items' |
| Delete item | action='DELETE', table_name='items' |
| Accept rental request | action='UPDATE', table_name='rental_requests', new_data contains status='accepted' |

**SQL Verification:**
```sql
-- After creating an item, verify audit record exists
SELECT * FROM audit_events 
WHERE table_name = 'items' 
  AND action = 'INSERT'
  AND user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;

-- After accepting a request
SELECT * FROM audit_events
WHERE table_name = 'rental_requests'
  AND action = 'UPDATE'
  AND new_data->>'status' = 'accepted'
ORDER BY created_at DESC
LIMIT 1;
```

---

### 6. Security Headers Tests

#### TEST-6.1: Verify Vercel headers

After deploying to Vercel, check response headers:

```bash
curl -I https://your-app.vercel.app/

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
# Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

**Browser DevTools Test:**
1. Open Network tab
2. Load any page
3. Click on document request
4. Check Response Headers tab
5. Verify all security headers present

---

## Automated Test Suggestions

### Playwright/Cypress E2E Tests

```typescript
// tests/security.spec.ts

test.describe('Security Tests', () => {
  test('User cannot access other user\'s rental requests', async ({ page }) => {
    // Login as Bob
    await loginAs(page, 'bob@test.com');
    
    // Try to navigate to Alice's request directly
    await page.goto('/solicitud/alice-request-id');
    
    // Should show error or redirect
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('Cannot upload to another user\'s item folder', async ({ page }) => {
    // Login as Bob
    await loginAs(page, 'bob@test.com');
    
    // Attempt upload via Supabase SDK
    const result = await page.evaluate(async (aliceItemId) => {
      const { error } = await supabase.storage
        .from('items-public')
        .upload(`${aliceItemId}/attack.jpg`, new Blob(['test']));
      return error?.message;
    }, aliceItemId);
    
    expect(result).toContain('not authorized');
  });
});
```

---

## Test Execution Checklist

| Test ID | Description | Status | Notes |
|---------|-------------|--------|-------|
| TEST-1.1 | Data isolation - rental requests | ⬜ | |
| TEST-1.2 | Conversation isolation | ⬜ | |
| TEST-2.1 | Public bucket read | ⬜ | |
| TEST-2.2 | Public bucket write restriction | ⬜ | |
| TEST-2.3 | Private bucket isolation | ⬜ | |
| TEST-3.1 | Status transition rules | ⬜ | |
| TEST-3.2 | Immutability enforcement | ⬜ | |
| TEST-4.1 | Message rate limit | ⬜ | |
| TEST-4.2 | Request rate limit | ⬜ | |
| TEST-5.1 | Audit trail capture | ⬜ | |
| TEST-6.1 | Security headers | ⬜ | |

---

## Troubleshooting

### Common Issues

1. **"permission denied for table X"**
   - RLS policy missing or incorrect
   - Check policy conditions match user context

2. **"function X does not exist"**
   - Migration not executed
   - Run missing migration file

3. **Rate limit not working**
   - `rate_limits` table not created
   - `check_rate_limit` function not granted to authenticated users

4. **Audit events not appearing**
   - Triggers not created
   - Check `log_audit_event` function exists

### Verification Queries

```sql
-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- List all triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check rate_limits table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rate_limits'
);

-- Check audit_events has records
SELECT COUNT(*) FROM audit_events;
```

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Reviewer | | | |
| QA Lead | | | |
| Tech Lead | | | |
