-- ============================================================================
-- BUYNT CHAT SYSTEM - Migration
-- Crea tablas, RPC functions, RLS policies y Storage bucket para chat
-- ============================================================================

-- Enable extensions
create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.items(id) on delete cascade,
  owner_id text not null,
  renter_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_last_read_at timestamptz,
  renter_last_read_at timestamptz,
  
  constraint conversations_owner_renter_diff check (owner_id <> renter_id),
  constraint conversations_unique_triplet unique (product_id, owner_id, renter_id)
);

create index if not exists conversations_owner_updated_idx on public.conversations(owner_id, updated_at desc);
create index if not exists conversations_renter_updated_idx on public.conversations(renter_id, updated_at desc);
create index if not exists conversations_product_idx on public.conversations(product_id);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at asc);
create index if not exists messages_sender_idx on public.messages(sender_id);

-- Message attachments table
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists attachments_message_idx on public.message_attachments(message_id);
create index if not exists attachments_conversation_idx on public.message_attachments(conversation_id);

-- User blocks table
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  
  constraint user_blocks_diff check (blocker_id <> blocked_id),
  constraint user_blocks_unique unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks(blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

-- Notifications table (in-app, unread messages badge)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null, -- 'message'
  conversation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_conversation_idx on public.notifications(conversation_id);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_conversations_touch on public.conversations;
create trigger trg_conversations_touch
before update on public.conversations
for each row execute function public.touch_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user A is blocked by or blocking user B
create or replace function public.is_blocked(a text, b text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- ============================================================================
-- RPC FUNCTIONS (Security Definer)
-- ============================================================================

-- Get or create conversation for a product
create or replace function public.get_or_create_conversation(p_product_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_owner text;
  v_renter text;
  v_id uuid;
begin
  -- Get current user email from auth.users table
  select email into v_renter
  from auth.users
  where id = auth.uid();
  
  if v_renter is null then
    raise exception 'User not authenticated';
  end if;

  -- Get owner email from items table
  select owner_contact into v_owner
  from public.items
  where id = p_product_id;

  if v_owner is null then
    raise exception 'Product not found';
  end if;

  if v_owner = v_renter then
    raise exception 'Owner cannot contact themselves';
  end if;

  if public.is_blocked(v_owner, v_renter) then
    raise exception 'Conversation not allowed (user blocked)';
  end if;

  select id into v_id
  from public.conversations
  where product_id = p_product_id
    and owner_id = v_owner
    and renter_id = v_renter;

  if v_id is null then
    insert into public.conversations(product_id, owner_id, renter_id, owner_last_read_at, renter_last_read_at)
    values (p_product_id, v_owner, v_renter, now(), now())
    returning id into v_id;
  end if;

  return v_id;
end $$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- Send a message
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_owner text;
  v_renter text;
  v_me text;
  v_msg_id uuid;
  v_other_user text;
begin
  -- Get current user email
  select email into v_me
  from auth.users
  where id = auth.uid();
  
  if v_me is null then
    raise exception 'User not authenticated';
  end if;

  select owner_id, renter_id into v_owner, v_renter
  from public.conversations
  where id = p_conversation_id;

  if v_owner is null then
    raise exception 'Conversation not found';
  end if;

  if v_me <> v_owner and v_me <> v_renter then
    raise exception 'Not a participant of this conversation';
  end if;

  if public.is_blocked(v_owner, v_renter) then
    raise exception 'Conversation not allowed (user blocked)';
  end if;

  if length(trim(coalesce(p_body,''))) = 0 then
    raise exception 'Message body cannot be empty';
  end if;

  -- Insert message
  insert into public.messages(conversation_id, sender_id, body)
  values (p_conversation_id, v_me, p_body)
  returning id into v_msg_id;

  -- Update conversation updated_at
  update public.conversations set updated_at = now() where id = p_conversation_id;

  -- Create notification for the other participant
  v_other_user := case when v_me = v_owner then v_renter else v_owner end;
  insert into public.notifications(user_id, type, conversation_id, payload)
  values (
    v_other_user,
    'message',
    p_conversation_id,
    jsonb_build_object('message_id', v_msg_id, 'sender_id', v_me)
  );

  return v_msg_id;
end $$;

grant execute on function public.send_message(uuid, text) to authenticated;

-- Mark conversation as read
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner text;
  v_renter text;
  v_me text;
begin
  -- Get current user email
  select email into v_me
  from auth.users
  where id = auth.uid();
  
  if v_me is null then
    raise exception 'User not authenticated';
  end if;

  select owner_id, renter_id into v_owner, v_renter
  from public.conversations
  where id = p_conversation_id;

  if v_owner is null then
    raise exception 'Conversation not found';
  end if;

  if v_me <> v_owner and v_me <> v_renter then
    raise exception 'Not a participant of this conversation';
  end if;

  if v_me = v_owner then
    update public.conversations 
    set owner_last_read_at = now() 
    where id = p_conversation_id;
  else
    update public.conversations 
    set renter_last_read_at = now() 
    where id = p_conversation_id;
  end if;

  -- Mark notifications as read
  update public.notifications
  set read_at = now()
  where conversation_id = p_conversation_id
    and user_id = v_me
    and read_at is null;
end $$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- List my conversations with unread count and last message
create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  product_id uuid,
  product_title text,
  product_image_url text,
  other_user_email text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id text,
  unread_count bigint,
  is_read boolean
)
language plpgsql
security definer
stable
as $$
declare
  v_me text;
begin
  -- Get current user email
  select email into v_me
  from auth.users
  where id = auth.uid();
  
  if v_me is null then
    raise exception 'User not authenticated';
  end if;

  return query
  with my_conversations as (
    select 
      c.id as conversation_id,
      c.product_id,
      c.owner_id,
      c.renter_id,
      c.updated_at,
      c.owner_last_read_at,
      c.renter_last_read_at,
      i.title as product_title,
      i.image_url as product_image_url
    from public.conversations c
    left join public.items i on c.product_id = i.id
    where c.owner_id = v_me or c.renter_id = v_me
  ),
  last_msgs as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.body,
      m.created_at,
      m.sender_id
    from public.messages m
    order by m.conversation_id, m.created_at desc
  ),
  unread_msgs as (
    select
      m.conversation_id,
      count(*) as unread_cnt
    from public.messages m
    join my_conversations c on m.conversation_id = c.conversation_id
    where m.sender_id <> v_me
      and (
        (v_me = c.owner_id and m.created_at > coalesce(c.owner_last_read_at, c.updated_at at time zone 'UTC' - interval '1 year'))
        or
        (v_me = c.renter_id and m.created_at > coalesce(c.renter_last_read_at, c.updated_at at time zone 'UTC' - interval '1 year'))
      )
    group by m.conversation_id
  )
  select
    c.conversation_id,
    c.product_id,
    c.product_title,
    c.product_image_url,
    case when c.owner_id = v_me then c.renter_id else c.owner_id end as other_user_email,
    lm.body,
    lm.created_at,
    lm.sender_id,
    coalesce(um.unread_cnt, 0) as unread_count,
    (lm.sender_id = v_me or lm.created_at <= case when v_me = c.owner_id then c.owner_last_read_at else c.renter_last_read_at end) as is_read
  from my_conversations c
  left join last_msgs lm on c.conversation_id = lm.conversation_id
  left join unread_msgs um on c.conversation_id = um.conversation_id
  order by c.updated_at desc;
end $$;

grant execute on function public.list_my_conversations() to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.conversations enable row level security;

create policy conversations_select
  on public.conversations for select
  using ((select email from auth.users where id = auth.uid()) = owner_id or (select email from auth.users where id = auth.uid()) = renter_id);

create policy conversations_update_owner
  on public.conversations for update
  using ((select email from auth.users where id = auth.uid()) = owner_id or (select email from auth.users where id = auth.uid()) = renter_id);

-- Messages RLS
alter table public.messages enable row level security;

create policy messages_select
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.owner_id = (select email from auth.users where id = auth.uid()) or c.renter_id = (select email from auth.users where id = auth.uid()))
    )
  );

create policy messages_insert
  on public.messages for insert
  with check (
    sender_id = (select email from auth.users where id = auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.owner_id = (select email from auth.users where id = auth.uid()) or c.renter_id = (select email from auth.users where id = auth.uid()))
    )
  );

-- Message attachments RLS
alter table public.message_attachments enable row level security;

create policy attachments_select
  on public.message_attachments for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.owner_id = (select email from auth.users where id = auth.uid()) or c.renter_id = (select email from auth.users where id = auth.uid()))
    )
  );

create policy attachments_insert
  on public.message_attachments for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.owner_id = (select email from auth.users where id = auth.uid()) or c.renter_id = (select email from auth.users where id = auth.uid()))
    )
  );

-- User blocks RLS
alter table public.user_blocks enable row level security;

create policy user_blocks_select
  on public.user_blocks for select
  using ((select email from auth.users where id = auth.uid()) = blocker_id or (select email from auth.users where id = auth.uid()) = blocked_id);

create policy user_blocks_insert
  on public.user_blocks for insert
  with check ((select email from auth.users where id = auth.uid()) = blocker_id);

create policy user_blocks_delete
  on public.user_blocks for delete
  using ((select email from auth.users where id = auth.uid()) = blocker_id);

-- Notifications RLS
alter table public.notifications enable row level security;

create policy notifications_select
  on public.notifications for select
  using ((select email from auth.users where id = auth.uid()) = user_id);

create policy notifications_update
  on public.notifications for update
  using ((select email from auth.users where id = auth.uid()) = user_id);

-- ============================================================================
-- STORAGE BUCKET & POLICIES
-- ============================================================================

-- Create storage bucket for chat attachments (if it doesn't exist)
-- NOTE: Este comando debe ejecutarse vía Supabase dashboard o CLI
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('chat-attachments', 'chat-attachments', false)
-- ON CONFLICT DO NOTHING;

-- Storage policies (create via dashboard):
-- 1. Allow authenticated users to upload to their conversations
-- 2. Allow download if user is participant

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Ensure tables are included in Realtime (enable via dashboard if needed):
-- - conversations
-- - messages
-- - notifications

