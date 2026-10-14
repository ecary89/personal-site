-- Kamira: everything the Supabase project needs.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- It's safe to run again: it only adds what's missing.
--
-- What's here, in plain words:
--   books    each person's stories (private: only they can read or change them)
--   cutouts  each person's own cutouts, with the pictures in a private folder
--   posts    pages someone made public, for the feed
--   hearts   who hearted which page
--   reports  who reported which page; 2 reports hide the page until an admin looks
--   admins   who can see hidden pages and restore or delete them

-- ---------- Stories and cutouts (private) ----------
create table if not exists public.books (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  updated bigint not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);
create table if not exists public.cutouts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  meta jsonb not null,           -- name, brand, link, size... (not the picture)
  path text,                     -- where the picture is, in the private folder
  updated bigint not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);
alter table public.books enable row level security;
alter table public.cutouts enable row level security;
drop policy if exists "own books" on public.books;
create policy "own books" on public.books for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own cutouts" on public.cutouts;
create policy "own cutouts" on public.cutouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Admins ----------
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;  -- nobody reads this table directly
insert into public.admins (email) values ('erika.mi.cary@gmail.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- Public pages ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  author text,                   -- first name only
  page_key text not null,        -- which of their pages this is
  image text not null,           -- picture of the page, in the public folder
  w int, h int,
  page jsonb not null,           -- background, pieces and words, for "Use these pieces"
  pieces jsonb not null default '{}'::jsonb,  -- their own cutouts on the page, with public links
  hearts int not null default 0,
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, page_key)
);
create index if not exists posts_feed on public.posts (hidden, created_at desc);
alter table public.posts enable row level security;

drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to anon, authenticated
  using (not hidden or user_id = auth.uid() or public.is_admin());
drop policy if exists "add own post" on public.posts;
create policy "add own post" on public.posts for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "change own post" on public.posts;
create policy "change own post" on public.posts for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "delete own post" on public.posts;
create policy "delete own post" on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- People can change their own page, but never its hearts, reports or hidden state.
-- (Only an admin can un-hide a page, and only by setting hidden.)
create or replace function public.posts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('kamira.counting', true) = 'on' then return new; end if;  -- heart/report counters
  if tg_op = 'INSERT' then
    new.hearts := 0; new.reports := 0; new.hidden := false;
    new.created_at := now(); new.updated_at := now();
  else
    new.hearts := old.hearts; new.user_id := old.user_id; new.created_at := old.created_at;
    if public.is_admin() then
      if old.hidden and not new.hidden then new.reports := 0; else new.reports := old.reports; end if;
    else
      new.reports := old.reports; new.hidden := old.hidden;
      new.updated_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.posts_guard();

-- ---------- Hearts ----------
create table if not exists public.hearts (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (post_id, user_id)
);
alter table public.hearts enable row level security;
drop policy if exists "read own hearts" on public.hearts;
create policy "read own hearts" on public.hearts for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own heart" on public.hearts;
create policy "add own heart" on public.hearts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "remove own heart" on public.hearts;
create policy "remove own heart" on public.hearts for delete to authenticated using (user_id = auth.uid());

create or replace function public.count_hearts() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  perform set_config('kamira.counting', 'on', true);
  update public.posts set hearts = (select count(*) from public.hearts where post_id = pid) where id = pid;
  perform set_config('kamira.counting', 'off', true);
  return null;
end $$;
drop trigger if exists count_hearts on public.hearts;
create trigger count_hearts after insert or delete on public.hearts for each row execute function public.count_hearts();

-- ---------- Reports ----------
create table if not exists public.reports (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.reports enable row level security;
drop policy if exists "add own report" on public.reports;
create policy "add own report" on public.reports for insert to authenticated
  with check (user_id = auth.uid() and not exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));
drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
drop policy if exists "admins clear reports" on public.reports;
create policy "admins clear reports" on public.reports for delete to authenticated using (public.is_admin());

-- 2 reports from different people hide the page
create or replace function public.count_reports() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.reports where post_id = new.post_id;
  perform set_config('kamira.counting', 'on', true);
  update public.posts set reports = n, hidden = (hidden or n >= 2) where id = new.post_id;
  perform set_config('kamira.counting', 'off', true);
  return null;
end $$;
drop trigger if exists count_reports on public.reports;
create trigger count_reports after insert on public.reports for each row execute function public.count_reports();

-- Restoring a hidden page clears its reports, so the same 2 reports can't hide it again
create or replace function public.clear_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.hidden and not new.hidden then delete from public.reports where post_id = new.id; end if;
  return null;
end $$;
drop trigger if exists clear_reports on public.posts;
create trigger clear_reports after update of hidden on public.posts for each row execute function public.clear_reports();

-- ---------- Who can reach which table (the rules above still apply on top) ----------
grant select, insert, update, delete on public.books, public.cutouts, public.posts, public.hearts, public.reports to authenticated;
grant select on public.posts to anon;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Picture folders ----------
-- "private": each person's own cutouts. Only they can see them.
-- "public": pictures of public pages, and the cutouts on them. Anyone can see these.
-- Each person can only add or remove files inside their own folder (named with their id).
insert into storage.buckets (id, name, public) values ('private', 'private', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('public', 'public', true) on conflict (id) do nothing;

drop policy if exists "kamira own private files" on storage.objects;
create policy "kamira own private files" on storage.objects for all to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kamira add public files" on storage.objects;
create policy "kamira add public files" on storage.objects for insert to authenticated
  with check (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kamira change public files" on storage.objects;
create policy "kamira change public files" on storage.objects for update to authenticated
  using (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kamira remove public files" on storage.objects;
create policy "kamira remove public files" on storage.objects for delete to authenticated
  using (bucket_id = 'public' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "kamira list own public files" on storage.objects;
create policy "kamira list own public files" on storage.objects for select to authenticated
  using (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);
