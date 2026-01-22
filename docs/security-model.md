# 🔐 Security Model - Buynt MVP

**Version:** 1.0  
**Date:** January 21, 2026  
**Stack:** Vite + React + Supabase (Postgres/Auth/Storage) + Vercel

---

## 1. Roles & Principals

### 1.1 Anonymous (`anon`)
- No authentication required
- Browsing marketplace, viewing public item listings
- Cannot see: emails, phone numbers, personal data

### 1.2 Authenticated (`auth`)
- Logged in via Supabase Auth (email/password or OAuth)
- Principal identifier: `auth.uid()` (UUID)
- Email available via: `auth.jwt() ->> 'email'`

### 1.3 Service Role (Backend Only)
- Used only in Supabase Edge Functions or server-side operations
- Full database access
- NOT exposed to client

---

## 2. Access Control by Table

### 2.1 `items` - Product Listings

| Operation | anon | auth (other) | auth (owner) |
|-----------|------|--------------|--------------|
| SELECT | ✅ (limited columns) | ✅ (limited columns) | ✅ (all columns) |
| INSERT | ❌ | ❌ | ✅ `owner_id = auth.uid()` |
| UPDATE | ❌ | ❌ | ✅ `owner_id = auth.uid()` |
| DELETE | ❌ | ❌ | ✅ `owner_id = auth.uid()` |

**Hidden Columns (from public view):**
- `owner_contact` (email)
- Consider: `owner_name` could be shown as display name only

**Implementation:**
```sql
-- View for public access (NO owner_contact)
CREATE VIEW public.items_public AS
SELECT id, title, description, price_day, city, category, 
       image_url, owner_id, owner_name, created_at
FROM items;
```

---

### 2.2 `item_images` - Product Photos

| Operation | anon | auth (other) | auth (item owner) |
|-----------|------|--------------|-------------------|
| SELECT | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ |

**Validation:** `is_item_owner(item_id, auth.uid())`

---

### 2.3 `rental_requests` - Booking Requests

| Operation | anon | auth (other) | auth (owner) | auth (renter) |
|-----------|------|--------------|--------------|---------------|
| SELECT | ❌ | ❌ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ✅ |
| UPDATE status | ❌ | ❌ | ✅ (accept/reject) | ✅ (cancel only) |
| DELETE | ❌ | ❌ | ❌ | ❌ |

**Status Transitions:**
```
                  ┌─────────────────┐
                  │    pending      │
                  └────────┬────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ accepted │    │ rejected │    │cancelled │
    └──────────┘    └──────────┘    └──────────┘
         │
         │ (auto-creates rental)
         ▼
    ┌──────────┐
    │ expired  │ (system only, timeout)
    └──────────┘
```

**Allowed Transitions:**
- `renter`: `pending` → `cancelled`
- `owner`: `pending` → `accepted` OR `pending` → `rejected`
- `system`: `pending` → `expired` (via cron/scheduled function)

**Immutable Fields (after creation):**
- `item_id`, `owner_id`, `renter_id`
- `start_date`, `end_date`, `days_count`
- `daily_price`, `deposit_amount`, `service_fee`, `total_amount`, `currency`

---

### 2.4 `rentals` - Confirmed Bookings

| Operation | anon | auth (other) | auth (owner) | auth (renter) |
|-----------|------|--------------|--------------|---------------|
| SELECT | ❌ | ❌ | ✅ | ✅ |
| SELECT dates | ✅ (period only for calendar) | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ❌ (via RPC only) | ❌ |
| UPDATE status | ❌ | ❌ | ✅ | ❌ |
| DELETE | ❌ | ❌ | ❌ | ❌ |

**Status Transitions:**
```
    ┌──────────┐
    │  active  │
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────────┐  ┌──────────┐
│completed │  │cancelled │ (optional, owner only)
└──────────┘  └──────────┘
```

**Immutable Fields:** Same as `rental_requests`

---

### 2.5 `booking_media` - Evidence Photos

| Operation | anon | auth (other) | auth (participant) |
|-----------|------|--------------|-------------------|
| SELECT | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ (own uploads only) |

**Validation:** `is_rental_participant(rental_id, auth.uid())`

---

### 2.6 `conversations` - Chat Threads

| Operation | anon | auth (other) | auth (participant) |
|-----------|------|--------------|-------------------|
| SELECT | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ✅ (renter initiates) |
| UPDATE | ❌ | ❌ | ✅ (last_read_at only) |
| DELETE | ❌ | ❌ | ❌ |

**Validation:** `is_conversation_participant(id, auth.uid())`

**Note:** Currently uses `owner_id` and `renter_id` as TEXT (email). Migration to UUID planned.

---

### 2.7 `messages` - Chat Messages

| Operation | anon | auth (other) | auth (participant) |
|-----------|------|--------------|-------------------|
| SELECT | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ✅ `sender_id = auth.email` |
| UPDATE | ❌ | ❌ | ❌ |
| DELETE | ❌ | ❌ | ❌ |

**Validation:** User must be participant of the conversation.

---

### 2.8 `message_attachments` - Chat Files

| Operation | anon | auth (other) | auth (participant) |
|-----------|------|--------------|-------------------|
| SELECT | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ (own uploads) |

---

### 2.9 `profiles` - User Profiles

| Operation | anon | auth (other) | auth (self) |
|-----------|------|--------------|-------------|
| SELECT public fields | ✅ | ✅ | ✅ |
| SELECT private fields | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ✅ (on signup trigger) |
| UPDATE | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ |

**Public Fields:** `id`, `full_name`, `avatar_url`  
**Private Fields:** `email`, `phone`, `dni_verified`

---

### 2.10 `notifications`

| Operation | anon | auth (other) | auth (owner) |
|-----------|------|--------------|--------------|
| SELECT | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ (DEFINER only) | ❌ |
| UPDATE | ❌ | ❌ | ✅ (mark read) |
| DELETE | ❌ | ❌ | ❌ |

**Critical:** INSERT must be via SECURITY DEFINER functions only.

---

### 2.11 `user_blocks`

| Operation | anon | auth (blocked) | auth (blocker) |
|-----------|------|----------------|----------------|
| SELECT | ❌ | ✅ (know if blocked) | ✅ |
| INSERT | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ |

---

### 2.12 `requests` (Legacy Table)

**Policy:** DENY ALL until migrated or removed.

| Operation | All Users |
|-----------|-----------|
| SELECT | ❌ |
| INSERT | ❌ |
| UPDATE | ❌ |
| DELETE | ❌ |

---

## 3. Storage Buckets

### 3.1 `items-public`

| Operation | anon | auth (other) | auth (item owner) |
|-----------|------|--------------|-------------------|
| READ | ✅ | ✅ | ✅ |
| UPLOAD | ❌ | ❌ | ✅ (to own item paths) |
| DELETE | ❌ | ❌ | ✅ (own item paths) |

**Path Structure:** `items/{item_id}/{image_id}-{variant}.webp`

**Policy Validation:**
```sql
-- Extract item_id from path and verify ownership
is_item_owner(
  (storage.foldername(name))[1]::uuid,  -- item_id from path
  auth.uid()
)
```

---

### 3.2 `booking-proof-private`

| Operation | anon | auth (other) | auth (participant) |
|-----------|------|--------------|-------------------|
| READ | ❌ | ❌ | ✅ |
| UPLOAD | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ (own uploads) |

**Path Structure:** `rentals/{rental_id}/{handoff|return}/{file_id}.webp`

**Policy Validation:**
```sql
is_rental_participant(
  (storage.foldername(name))[1]::uuid,  -- rental_id from path
  auth.uid()
)
```

---

### 3.3 `chat-attachments` (To Be Created)

| Operation | anon | auth (other) | auth (participant) |
|-----------|------|--------------|-------------------|
| READ | ❌ | ❌ | ✅ |
| UPLOAD | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ (own uploads) |

**Path Structure:** `conversations/{conversation_id}/{message_id}/{file_id}.ext`

---

## 4. Helper Functions (SQL)

### 4.1 `is_item_owner(item_id, user_id)`
```sql
CREATE OR REPLACE FUNCTION is_item_owner(p_item_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM items 
    WHERE id = p_item_id AND owner_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 4.2 `is_rental_participant(rental_id, user_id)`
```sql
CREATE OR REPLACE FUNCTION is_rental_participant(p_rental_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rentals 
    WHERE id = p_rental_id 
    AND (owner_id = p_user_id OR renter_id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 4.3 `is_rental_request_participant(request_id, user_id)`
```sql
CREATE OR REPLACE FUNCTION is_rental_request_participant(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rental_requests 
    WHERE id = p_request_id 
    AND (owner_id = p_user_id OR renter_id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 4.4 `is_conversation_participant(conversation_id, user_id)`

**Note:** Uses TEXT comparison with email until migration to UUID.

```sql
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conv_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get user's email from auth
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = p_conv_id 
    AND (owner_id = v_user_email OR renter_id = v_user_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 4.5 `safe_uuid(text)` - Safe Text-to-UUID Cast
```sql
CREATE OR REPLACE FUNCTION safe_uuid(p_text TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN p_text::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 5. Rate Limits (Target)

| Action | Limit | Window |
|--------|-------|--------|
| Send message | 20 | per minute |
| Create rental request | 10 | per hour |
| Upload image | 30 | per hour |
| Create item | 10 | per day |

**Implementation:** Supabase Edge Functions or Vercel Edge Middleware with Upstash Redis.

---

## 6. Security Headers (Vercel)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { 
          "key": "Content-Security-Policy", 
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co https://images.unsplash.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
        }
      ]
    }
  ]
}
```

---

## 7. Audit Events

| Event | Logged Data |
|-------|-------------|
| `item.created` | item_id, owner_id, title |
| `item.updated` | item_id, owner_id, changed_fields |
| `item.deleted` | item_id, owner_id |
| `rental_request.created` | request_id, item_id, renter_id |
| `rental_request.accepted` | request_id, owner_id, rental_id |
| `rental_request.rejected` | request_id, owner_id |
| `rental_request.cancelled` | request_id, renter_id |
| `rental.completed` | rental_id, owner_id |
| `message.sent` | conversation_id, sender_id |
| `image.uploaded` | item_id/rental_id, user_id, bucket |
| `image.deleted` | item_id/rental_id, user_id |

---

**Next Step:** FASE 2 - Implement RLS Migrations
