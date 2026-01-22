# 🔒 Security Audit Report - Buynt MVP

**Date:** January 21, 2026  
**Author:** Security-minded Staff Engineer  
**Project:** Buynt - P2P Rental Marketplace  
**Stack:** Vite + React + Supabase (Postgres/Auth/Storage) + Vercel  

---

## Executive Summary

This audit identifies **CRITICAL**, **HIGH**, and **MEDIUM** security vulnerabilities in the Buynt MVP. The application has partial RLS implementation but significant gaps that could lead to data leakage, unauthorized access, and injection vulnerabilities.

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 3 | Requires immediate fix |
| 🟠 HIGH | 7 | Should fix before production |
| 🟡 MEDIUM | 5 | Fix in near term |

---

## 1. Tables & RLS Status

| Table | RLS Enabled | Policies Exist | Status |
|-------|-------------|----------------|--------|
| `items` | ✅ | ✅ 4 policies | ⚠️ Exposes `owner_contact` (email) |
| `item_images` | ✅ | ✅ 4 policies | ✅ OK |
| `rental_requests` | ✅ | ✅ 2 policies (SELECT/INSERT) | ⚠️ Missing UPDATE/DELETE |
| `rentals` | ✅ | ✅ 2 policies (SELECT only) | ⚠️ Missing UPDATE |
| `booking_media` | ✅ | ✅ 3 policies | ✅ OK |
| `conversations` | ✅ | ✅ 3 policies | ⚠️ Uses email TEXT, not UUID |
| `messages` | ✅ | ✅ 2 policies | ⚠️ Uses email TEXT |
| `message_attachments` | ✅ | ✅ 2 policies | ⚠️ Uses email TEXT |
| `notifications` | ✅ | ✅ 2 policies + INSERT(true) | 🔴 INSERT allows anyone! |
| `user_blocks` | ✅ | ✅ 3 policies | ⚠️ Uses email TEXT |
| `profiles` | ❓ | ❓ | 🔴 Unknown - needs verification |
| `requests` (legacy) | ❓ | ❓ | 🔴 Unknown - potential exposure |

---

## 2. Critical Vulnerabilities

### 🔴 CRITICAL-1: Data Leakage via `items.select('*')`

**Location:** `src/services/supabaseDb.ts:35-41`

```typescript
async getAll(): Promise<Item[]> {
    const { data, error } = await supabase
        .from('items')
        .select('*')  // ⚠️ Exposes ALL columns including owner_contact (email)
```

**Risk:** Any anonymous user can retrieve all users' emails via the public items feed.

**Evidence:** The `Item` type includes `owner_contact: string` which contains the owner's email address.

**Fix:** Create a view or select specific columns excluding PII.

---

### 🔴 CRITICAL-2: Notifications INSERT Policy Too Permissive

**Location:** `supabase/migrations/20250111_fix_rls_policies.sql:107`

```sql
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (true);  -- ⚠️ ANYONE can insert!
```

**Risk:** Any authenticated user can inject fake notifications to any other user, enabling phishing/social engineering attacks within the platform.

**Fix:** Restrict INSERT to server-side only (SECURITY DEFINER functions) or to self-notifications.

---

### 🔴 CRITICAL-3: Storage Policies Not Enforcing Ownership

**Location:** `supabase/migrations/20260121_setup_storage_buckets.sql`

```sql
CREATE POLICY "Authenticated upload items-public"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'items-public');  -- ⚠️ No ownership check!
```

**Risk:** Any authenticated user can upload files to any path in `items-public`, potentially:
- Overwriting other users' images
- Uploading to paths like `items/{OTHER_USER_ITEM_ID}/...`
- Filling storage quota

**Fix:** Validate that the path belongs to an item owned by `auth.uid()`.

---

## 3. High Vulnerabilities

### 🟠 HIGH-1: TEXT UUID Fields in Chat Tables

**Location:** `conversations`, `messages`, `user_blocks`, `notifications`

**Issue:** User IDs stored as TEXT instead of UUID. Policies use `auth.jwt() ->> 'email'` comparison.

**Risks:**
- Email changes would break access
- Case sensitivity issues (`User@email.com` vs `user@email.com`)
- No referential integrity with `auth.users`

**Current Workaround:** Policies use `(auth.jwt() ->> 'email')` which works but is fragile.

**Fix:** Migrate to UUID with foreign key to `auth.users.id`.

---

### 🟠 HIGH-2: Rental Requests Missing UPDATE/DELETE Policies

**Location:** `supabase/migrations/20260113_rental_requests_system.sql:220-228`

**Issue:** No UPDATE or DELETE policies exist. While RPCs handle mutations, direct Supabase client access is blocked entirely (good for security-by-default but blocks legitimate use cases).

**Risk:** If any code tries direct UPDATE, it silently fails.

**Current mitigation:** All updates go through SECURITY DEFINER RPCs.

**Fix:** Add explicit UPDATE policies for allowed transitions.

---

### 🟠 HIGH-3: Rentals Missing UPDATE Policy

**Location:** Same migration file

**Issue:** Owner cannot directly update rental status (e.g., mark as completed).

**Current mitigation:** Need to verify if there's an RPC for this.

**Fix:** Add UPDATE policy for owner-only status changes.

---

### 🟠 HIGH-4: No Immutability Triggers

**Issue:** Once created, `rental_requests` and `rentals` fields like `item_id`, `owner_id`, `renter_id`, `total_amount` should NEVER change.

**Risk:** Malicious user could potentially modify amounts after creation if an UPDATE policy is added.

**Fix:** Add `BEFORE UPDATE` trigger that blocks changes to immutable fields.

---

### 🟠 HIGH-5: Missing Rate Limiting

**Location:** All services (frontend-only app)

**Issue:** No rate limiting on:
- Creating rental requests (abuse potential)
- Sending messages (spam)
- Uploading images (storage exhaustion)

**Fix:** Implement server-side rate limiting via Supabase Edge Functions or Vercel middleware.

---

### 🟠 HIGH-6: No Security Headers

**Location:** `vite.config.ts`

**Issue:** No CSP, HSTS, X-Frame-Options, etc. configured.

**Risk:** XSS attacks, clickjacking, MIME-type sniffing.

**Fix:** Add headers via Vercel config or server middleware.

---

### 🟠 HIGH-7: No Audit Trail

**Issue:** No logging of security-relevant events (item creation, request acceptance, login attempts).

**Fix:** Create `audit_events` table and log critical mutations.

---

## 4. Medium Vulnerabilities

### 🟡 MEDIUM-1: Message Content Not Sanitized

**Location:** `src/services/chatService.ts:203-207`

```typescript
const { data, error } = await supabase
    .from('messages')
    .insert({
        ...
        body: body.trim()  // Only trims, no sanitization
    })
```

**Risk:** Stored XSS if messages are rendered with `dangerouslySetInnerHTML`.

**Current mitigation:** React auto-escapes by default. Need to verify rendering.

---

### 🟡 MEDIUM-2: Legacy `requests` Table Status Unknown

**Location:** `src/services/supabaseDb.ts:159-209`

**Issue:** The old `requests` table is still used by `requestsService`. Unknown RLS status.

**Fix:** Either migrate to `rental_requests` or apply strict RLS.

---

### 🟡 MEDIUM-3: `bookings` Table Reference Without Schema

**Location:** `src/services/supabaseDb.ts:7-29`

**Issue:** Code references `bookings` table that may not exist (fallback to `requests`).

**Fix:** Remove dead code or implement proper `bookings` table.

---

### 🟡 MEDIUM-4: Chat Attachments Bucket May Not Exist

**Location:** `src/services/chatService.ts:295-318`

**Issue:** Code uploads to `chat-attachments` bucket but only `items-public` and `booking-proof-private` are created.

**Fix:** Create `chat-attachments` bucket with proper policies.

---

### 🟡 MEDIUM-5: Email Used as User Identifier

**Location:** Throughout `messagesService.ts` and `chatService.ts`

**Issue:** User email used as identifier instead of UUID. This couples the system to email which may change.

**Fix:** Migrate to UUID-based identification.

---

## 5. Queries & Mutations Inventory

### Public Queries (Anonymous Access)

| File | Method | Table | Columns | Risk |
|------|--------|-------|---------|------|
| `supabaseDb.ts` | `getAll()` | items | `*` | 🔴 Leaks `owner_contact` |
| `supabaseDb.ts` | `getById(id)` | items | `*` | 🔴 Leaks `owner_contact` |
| `rentalRequestsService.ts` | `getBlockedDates()` | rentals | period only | ✅ OK |

### Authenticated Queries

| File | Method | Table | RLS Protected |
|------|--------|-------|--------------|
| `supabaseDb.ts` | `getByUserId()` | items | ✅ |
| `chatService.ts` | `listMyConversations()` | conversations | ✅ via email |
| `chatService.ts` | `getMessages()` | messages | ✅ via conversation join |
| `rentalRequestsService.ts` | `listIncoming/Outgoing()` | rental_requests | ✅ via owner_id/renter_id |

### Mutations

| File | Method | Table | Protection |
|------|--------|-------|------------|
| `supabaseDb.ts` | `add()` | items | ✅ RLS checks owner_id |
| `supabaseDb.ts` | `update()` | items | ✅ RLS checks owner_id |
| `supabaseDb.ts` | `delete()` | items | ✅ RLS checks owner_id |
| `chatService.ts` | `sendMessage()` | messages | ✅ RLS checks sender_id + conversation |
| `rentalRequestsService.ts` | `create()` | rental_requests | ✅ via RPC |
| `rentalRequestsService.ts` | `respond()` | rental_requests | ✅ via RPC |
| `itemImagesService.ts` | `upload()` | item_images | ✅ RLS checks item ownership |

---

## 6. Immediate Action Items

### Phase 1: Critical (Do Now)
1. **Fix items query** - Remove `owner_contact` from public queries
2. **Fix notifications INSERT** - Restrict to SECURITY DEFINER functions
3. **Fix storage policies** - Add ownership validation to path

### Phase 2: High (This Sprint)
4. Add UPDATE policies for rental_requests and rentals
5. Add immutability triggers
6. Add security headers
7. Create audit_events table

### Phase 3: Medium (Next Sprint)
8. Migrate chat tables from TEXT to UUID
9. Create chat-attachments bucket
10. Clean up legacy tables
11. Implement rate limiting

---

## 7. Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `supabase/migrations/20260122_security_hardening.sql` | CREATE | 🔴 CRITICAL |
| `supabase/migrations/20260122_audit_trail.sql` | CREATE | 🟠 HIGH |
| `vercel.json` | CREATE/MODIFY | 🟠 HIGH |
| `src/services/supabaseDb.ts` | MODIFY | 🔴 CRITICAL |
| `docs/security-model.md` | CREATE | 🟠 HIGH |
| `docs/security-test-plan.md` | CREATE | 🟡 MEDIUM |

---

## Appendix A: Existing RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| items | ✅ public | ✅ owner | ✅ owner | ✅ owner |
| item_images | ✅ public | ✅ item owner | ✅ item owner | ✅ item owner |
| rental_requests | ✅ participant | ✅ renter | ❌ MISSING | ❌ MISSING |
| rentals | ✅ participant + public dates | ❌ | ❌ MISSING | ❌ |
| booking_media | ✅ participant | ✅ participant | ❌ | ✅ uploader |
| conversations | ✅ participant | ✅ renter | ✅ participant | ❌ |
| messages | ✅ participant | ✅ sender+participant | ❌ | ❌ |
| notifications | ✅ owner | ❌ | ✅ owner | ❌ |
| user_blocks | ✅ blocker+blocked | ✅ blocker | ❌ | ✅ blocker |

---

**Next Step:** Proceed to FASE 1 - Security Model Documentation
