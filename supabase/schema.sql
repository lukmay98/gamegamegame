-- GameGameGame — Datenbankschema
-- Einmal im Supabase SQL Editor ausführen (Project > SQL Editor > New query > Run).
-- Voraussetzung: Authentication > Sign In / Providers > "Allow anonymous sign-ins" aktivieren.
--
-- Konzept
--   * Niemand braucht ein Konto: jedes Gerät meldet sich still als anonymer
--     Supabase-User an (auth.uid() ist pro Gerät/Browser stabil).
--   * Eine Session hat einen 6-stelligen Code. Wer den Code kennt, wird über
--     join_session() Mitglied und darf dann alles in dieser Session lesen und
--     schreiben. Nicht-Mitglieder sehen nichts (Row Level Security).
--   * "Mitglieder" sind Geräte, "Spieler" sind Namen am Tisch. Ein Gerät kann
--     also auch für Leute ohne Handy mitschreiben.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- TABELLEN
-- ─────────────────────────────────────────────────────────────
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  game text not null check (game in ('ftn', 'free')),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists session_members (
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists session_members_user_idx on session_members (user_id);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  seat int not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists players_name_unique on players (session_id, lower(trim(name)));
create index if not exists players_session_idx on players (session_id);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_number int not null check (round_number >= 1),
  cards int check (cards between 1 and 60),          -- nur FTN: Karten pro Spieler
  dealer_player_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

create table if not exists entries (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  bid int check (bid between 0 and 60),              -- FTN: angesagte Stiche
  tricks int check (tricks between 0 and 60),        -- FTN: gemachte Stiche
  points int,                                         -- Freie Liste: Punkte der Runde
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);
create index if not exists entries_session_idx on entries (session_id);

-- Damit DELETE-Events über Realtime vollständige Zeilen liefern
alter table rounds replica identity full;
alter table entries replica identity full;
alter table players replica identity full;

-- ─────────────────────────────────────────────────────────────
-- HILFSFUNKTION: ist der aktuelle User Mitglied der Session?
-- ─────────────────────────────────────────────────────────────
create or replace function is_member(p_session uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from session_members
    where session_id = p_session and user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
alter table sessions enable row level security;
alter table session_members enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table entries enable row level security;

-- Sessions: Mitglieder lesen/ändern; anlegen nur über create_session();
-- löschen darf nur, wer sie angelegt hat.
drop policy if exists "members read sessions" on sessions;
create policy "members read sessions" on sessions
  for select to authenticated using (is_member(id));
drop policy if exists "members update sessions" on sessions;
create policy "members update sessions" on sessions
  for update to authenticated using (is_member(id)) with check (is_member(id));
drop policy if exists "host deletes sessions" on sessions;
create policy "host deletes sessions" on sessions
  for delete to authenticated using (created_by = auth.uid());

-- Mitgliedschaften: sieht man nur für Sessions, in denen man selbst ist;
-- austreten darf man selbst.
drop policy if exists "members read members" on session_members;
create policy "members read members" on session_members
  for select to authenticated using (is_member(session_id));
drop policy if exists "leave session" on session_members;
create policy "leave session" on session_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members manage players" on players;
create policy "members manage players" on players
  for all to authenticated using (is_member(session_id)) with check (is_member(session_id));

drop policy if exists "members manage rounds" on rounds;
create policy "members manage rounds" on rounds
  for all to authenticated using (is_member(session_id)) with check (is_member(session_id));

drop policy if exists "members manage entries" on entries;
create policy "members manage entries" on entries
  for all to authenticated
  using (is_member(session_id))
  with check (
    is_member(session_id)
    and exists (select 1 from rounds r where r.id = round_id and r.session_id = entries.session_id)
    and exists (select 1 from players p where p.id = player_id and p.session_id = entries.session_id)
  );

-- ─────────────────────────────────────────────────────────────
-- RPC: Session anlegen (erzeugt Code, macht Ersteller zum Mitglied,
-- legt Spieler an). Gibt den Code zurück.
-- ─────────────────────────────────────────────────────────────
create or replace function create_session(
  p_name text,
  p_game text,
  p_config jsonb,
  p_players text[]
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_id uuid;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- ohne 0/O/1/I/L
  v_name text;
  v_seat int := 0;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if coalesce(array_length(p_players, 1), 0) < 1 then
    raise exception 'Mindestens ein Spieler nötig';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from sessions where code = v_code);
  end loop;

  insert into sessions (code, name, game, config, created_by)
  values (v_code, coalesce(nullif(trim(p_name), ''), 'Spielabend'), p_game, coalesce(p_config, '{}'::jsonb), auth.uid())
  returning id into v_id;

  insert into session_members (session_id, user_id) values (v_id, auth.uid());

  foreach v_name in array p_players loop
    if length(trim(v_name)) > 0 then
      v_seat := v_seat + 1;
      -- Der erste Name ist der Ersteller selbst → mit diesem Gerät verknüpfen
      insert into players (session_id, name, seat, user_id)
      values (v_id, trim(v_name), v_seat, case when v_seat = 1 then auth.uid() else null end);
    end if;
  end loop;

  return v_code;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: Vorschau einer Session per Code (für die Beitritts-Seite,
-- bevor man Mitglied ist). Gibt nur Name, Spiel, Status, Spielernamen.
-- ─────────────────────────────────────────────────────────────
create or replace function session_preview(p_code text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'name', s.name,
    'game', s.game,
    'status', s.status,
    'is_member', exists (select 1 from session_members m where m.session_id = s.id and m.user_id = auth.uid()),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'claimed', p.user_id is not null) order by p.seat)
      from players p where p.session_id = s.id
    ), '[]'::jsonb)
  )
  from sessions s
  where s.code = upper(trim(p_code));
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: Session beitreten. p_name optional:
--   * leer           → nur zuschauen / mitschreiben, ohne eigenen Spieler
--   * existiert frei → dieser Spieler wird mit dem Gerät verknüpft
--   * neu            → neuer Spieler wird angehängt
-- Gibt die Session-ID zurück.
-- ─────────────────────────────────────────────────────────────
create or replace function join_session(p_code text, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_session sessions%rowtype;
  v_player players%rowtype;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_session from sessions where code = upper(trim(p_code));
  if not found then
    raise exception 'Keine Session mit diesem Code gefunden';
  end if;

  insert into session_members (session_id, user_id)
  values (v_session.id, auth.uid())
  on conflict do nothing;

  if v_name is not null then
    select * into v_player from players
    where session_id = v_session.id and lower(trim(name)) = lower(v_name);

    if found then
      if v_player.user_id is null then
        update players set user_id = auth.uid() where id = v_player.id;
      elsif v_player.user_id <> auth.uid() then
        raise exception 'Der Name "%" ist schon vergeben', v_name;
      end if;
    else
      insert into players (session_id, name, seat, user_id)
      values (
        v_session.id, v_name,
        coalesce((select max(seat) from players where session_id = v_session.id), 0) + 1,
        auth.uid()
      );
    end if;
  end if;

  return v_session.id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: Keepalive (täglich von Vercel Cron aufgerufen, damit das
-- Free-Tier-Projekt nicht pausiert wird)
-- ─────────────────────────────────────────────────────────────
create or replace function ping()
returns timestamptz
language sql stable security definer set search_path = public
as $$ select now() from (select count(*) from sessions) s; $$;

revoke all on function create_session(text, text, jsonb, text[]) from public, anon;
revoke all on function join_session(text, text) from public, anon;
revoke all on function session_preview(text) from public, anon;
grant execute on function create_session(text, text, jsonb, text[]) to authenticated;
grant execute on function join_session(text, text) to authenticated;
grant execute on function session_preview(text) to authenticated;
grant execute on function ping() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- REALTIME: Änderungen live an alle Mitglieder schicken
-- ─────────────────────────────────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table players;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table rounds;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table entries;  exception when duplicate_object then null; end;
end $$;
