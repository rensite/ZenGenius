-- LyricLens initial schema: per-user library with RLS.
-- IDs are TEXT to match existing client-generated identifiers (e.g. "t-1700000000").

create extension if not exists "pgcrypto";

create table public.tracks (
  id          text primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  artist      text not null default '',
  album       text,
  about       text,
  characters  text[],
  sections    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.annotations (
  id          text primary key,
  track_id    text not null references public.tracks(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  ranges      jsonb not null default '[]'::jsonb,
  body        text not null default '',
  tags        text[] not null default '{}',
  contributor text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table public.rhyme_groups (
  id        text primary key,
  track_id  text not null references public.tracks(id) on delete cascade,
  owner_id  uuid not null references auth.users(id) on delete cascade,
  color     text not null,
  marks     jsonb not null default '[]'::jsonb,
  note      text
);

create table public.dictionary_entries (
  id         text primary key,
  track_id   text not null references public.tracks(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  term       text not null,
  definition text not null default ''
);

-- Indexes: RLS adds (owner_id = auth.uid()) to every query, so owner_id MUST be
-- in a leading index position to avoid sequential scans as the table grows.
create index tracks_owner_updated_idx       on public.tracks (owner_id, updated_at desc);
create index annotations_owner_track_idx    on public.annotations (owner_id, track_id);
create index rhyme_groups_owner_track_idx   on public.rhyme_groups (owner_id, track_id);
create index dictionary_owner_track_idx     on public.dictionary_entries (owner_id, track_id);

-- owner_id is set server-side from the JWT, never trusted from the client.
create or replace function public.set_owner_id()
returns trigger language plpgsql security definer as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

create or replace function public.bump_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tracks_set_owner       before insert on public.tracks       for each row execute function public.set_owner_id();
create trigger annotations_set_owner  before insert on public.annotations  for each row execute function public.set_owner_id();
create trigger rhymes_set_owner       before insert on public.rhyme_groups for each row execute function public.set_owner_id();
create trigger dict_set_owner         before insert on public.dictionary_entries for each row execute function public.set_owner_id();

create trigger tracks_bump_updated      before update on public.tracks      for each row execute function public.bump_updated_at();
create trigger annotations_bump_updated before update on public.annotations for each row execute function public.bump_updated_at();

alter table public.tracks             enable row level security;
alter table public.annotations        enable row level security;
alter table public.rhyme_groups       enable row level security;
alter table public.dictionary_entries enable row level security;

-- Single policy per (table, action). USING gates reads/updates/deletes; WITH CHECK
-- gates writes. Both compare to auth.uid() so a forged owner_id from the client is
-- rejected even before the BEFORE-INSERT trigger overwrites it.
create policy tracks_select on public.tracks for select using (owner_id = auth.uid());
create policy tracks_insert on public.tracks for insert with check (owner_id = auth.uid());
create policy tracks_update on public.tracks for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy tracks_delete on public.tracks for delete using (owner_id = auth.uid());

create policy annotations_select on public.annotations for select using (owner_id = auth.uid());
create policy annotations_insert on public.annotations for insert with check (owner_id = auth.uid());
create policy annotations_update on public.annotations for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy annotations_delete on public.annotations for delete using (owner_id = auth.uid());

create policy rhymes_select on public.rhyme_groups for select using (owner_id = auth.uid());
create policy rhymes_insert on public.rhyme_groups for insert with check (owner_id = auth.uid());
create policy rhymes_update on public.rhyme_groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy rhymes_delete on public.rhyme_groups for delete using (owner_id = auth.uid());

create policy dict_select on public.dictionary_entries for select using (owner_id = auth.uid());
create policy dict_insert on public.dictionary_entries for insert with check (owner_id = auth.uid());
create policy dict_update on public.dictionary_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dict_delete on public.dictionary_entries for delete using (owner_id = auth.uid());
