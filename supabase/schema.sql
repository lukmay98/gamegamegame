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
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
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
  cards int check (cards between 1 and 60),          -- nur FTN: Karten pro Spieler          -- nur FTN: Karten pro Spieler
  dealer_player_id uuid references players(id) on delete set null,
  phase text not null default 'bidding' check (phase in ('bidding', 'playing', 'done')),
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

create table if not exists entries (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  bid int check (bid between 0 and 60),              -- FTN: angesagte Stiche
  tricks int check (tricks between 0 and 60),        -- FTN: gemachte Stiche (nur bei "daneben", wenn die Wertung sie braucht)
  hit boolean,                                        -- FTN: true = getroffen, false = daneben, null = offen
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
revoke all on function is_member(uuid) from public, anon;
grant execute on function is_member(uuid) to authenticated;

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

-- ═════════════════════════════════════════════════════════════
-- PARTIEN (seit Paket 4): Eine Session ist ein Spieltag mit
-- mehreren Partien. Jede Partie hat ihre eigenen, festen Regeln.
-- ═════════════════════════════════════════════════════════════
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  number int not null check (number >= 1),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (session_id, number)
);
create index if not exists games_session_idx on games (session_id);
alter table games replica identity full;
alter table games enable row level security;
drop policy if exists "members manage games" on games;
create policy "members manage games" on games
  for all to authenticated using (is_member(session_id)) with check (is_member(session_id));

alter table rounds add column if not exists game_id uuid references games(id) on delete cascade;

-- Altbestand: je Session eine Partie 1
insert into games (session_id, number, config, status, created_at, finished_at)
select s.id, 1, s.config, s.status, s.created_at, s.finished_at
from sessions s
where not exists (select 1 from games g where g.session_id = s.id);
update rounds r set game_id = g.id
from games g
where g.session_id = r.session_id and g.number = 1 and r.game_id is null;

-- Rundennummern gelten pro Partie
alter table rounds drop constraint if exists rounds_session_id_round_number_key;
do $$ begin
  alter table rounds add constraint rounds_game_id_round_number_key unique (game_id, round_number);
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists rounds_game_idx on rounds (game_id);

-- Runde ohne Partie → neueste Partie der Session
create or replace function rounds_default_game()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.game_id is null then
    select id into new.game_id from games where session_id = new.session_id order by number desc limit 1;
  end if;
  if new.game_id is null then
    raise exception 'Keine Partie für diese Session';
  end if;
  if not exists (select 1 from games g where g.id = new.game_id and g.session_id = new.session_id) then
    raise exception 'Partie gehört nicht zu dieser Session';
  end if;
  return new;
end $$;
drop trigger if exists rounds_default_game on rounds;
create trigger rounds_default_game before insert or update of game_id on rounds
  for each row execute function rounds_default_game();
revoke all on function rounds_default_game() from public, anon, authenticated;
alter table rounds alter column game_id set not null;

-- Session anlegen legt zusätzlich Partie 1 an
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
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
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
  insert into games (session_id, number, config) values (v_id, 1, coalesce(p_config, '{}'::jsonb));
  insert into session_members (session_id, user_id) values (v_id, auth.uid());
  foreach v_name in array p_players loop
    if length(trim(v_name)) > 0 then
      v_seat := v_seat + 1;
      insert into players (session_id, name, seat, user_id)
      values (v_id, trim(v_name), v_seat, case when v_seat = 1 then auth.uid() else null end);
    end if;
  end loop;
  return v_code;
end;
$$;
revoke all on function create_session(text, text, jsonb, text[]) from public, anon;
grant execute on function create_session(text, text, jsonb, text[]) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table games; exception when duplicate_object then null; end;
end $$;

-- ═════════════════════════════════════════════════════════════
-- PAKET 5: Spielecodes (Konten), Admin-Portal, Zuschauer-Rolle
-- Passwörter liegen nur als bcrypt-Hash vor (pgcrypto).
-- Die Tabellen sind per RLS komplett gesperrt; Zugriff nur über
-- die security-definer-Funktionen unten.
-- Admin anlegen (einmalig, nicht im Repo):
--   insert into admins (username, password_hash)
--   values ('name', extensions.crypt('passwort', extensions.gen_salt('bf', 10)));
-- ═════════════════════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,20}$'),
  password_hash text not null,
  must_change boolean not null default true,
  note text not null default '',
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create table if not exists account_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists account_devices_account_idx on account_devices (account_id);

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz
);
create table if not exists admin_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_id uuid not null references admins(id) on delete cascade,
  expires_at timestamptz not null
);

alter table accounts enable row level security;
alter table account_devices enable row level security;
alter table admins enable row level security;
alter table admin_devices enable row level security;
revoke all on accounts, account_devices, admins, admin_devices from anon, authenticated;

alter table sessions add column if not exists account_id uuid references accounts(id) on delete set null;
create index if not exists sessions_account_idx on sessions (account_id);
-- Bestehende Mitgliedschaften bleiben Bearbeiter; neu Beigetretene sind Zuschauer.
alter table session_members add column if not exists role text not null default 'editor'
  check (role in ('editor', 'viewer'));

-- ─── Hilfsfunktionen ──────────────────────────────────────────
create or replace function my_account_id()
returns uuid language sql stable security definer set search_path = public as $$
  select account_id from account_devices where user_id = auth.uid();
$$;

create or replace function is_member(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_members where session_id = p_session and user_id = auth.uid())
      or exists (select 1 from sessions s join account_devices d on d.account_id = s.account_id
                 where s.id = p_session and d.user_id = auth.uid());
$$;

create or replace function is_editor(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_members where session_id = p_session and user_id = auth.uid() and role = 'editor')
      or exists (select 1 from sessions s join account_devices d on d.account_id = s.account_id
                 where s.id = p_session and d.user_id = auth.uid());
$$;

create or replace function can_edit(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_editor(p_session);
$$;

-- ─── RLS: lesen alle Mitglieder, schreiben nur Bearbeiter ─────
drop policy if exists "members update sessions" on sessions;
drop policy if exists "editors update sessions" on sessions;
create policy "editors update sessions" on sessions
  for update to authenticated using (is_editor(id)) with check (is_editor(id));
drop policy if exists "host deletes sessions" on sessions;
create policy "host deletes sessions" on sessions
  for delete to authenticated
  using (created_by = auth.uid() or (account_id is not null and account_id = my_account_id()));

do $$
declare t text;
begin
  foreach t in array array['players', 'rounds', 'games'] loop
    execute format('drop policy if exists "members manage %1$s" on %1$I', t);
    execute format('drop policy if exists "members read %1$s" on %1$I', t);
    execute format('drop policy if exists "editors write %1$s" on %1$I', t);
    execute format('create policy "members read %1$s" on %1$I for select to authenticated using (is_member(session_id))', t);
    execute format('create policy "editors write %1$s" on %1$I for all to authenticated using (is_editor(session_id)) with check (is_editor(session_id))', t);
  end loop;
end $$;

drop policy if exists "members manage entries" on entries;
drop policy if exists "members read entries" on entries;
drop policy if exists "editors write entries" on entries;
create policy "members read entries" on entries
  for select to authenticated using (is_member(session_id));
create policy "editors write entries" on entries
  for all to authenticated
  using (is_editor(session_id))
  with check (
    is_editor(session_id)
    and exists (select 1 from rounds r where r.id = round_id and r.session_id = entries.session_id)
    and exists (select 1 from players p where p.id = player_id and p.session_id = entries.session_id)
  );

-- ─── Session anlegen: gehört dem angemeldeten Spielecode ──────
create or replace function create_session(p_name text, p_game text, p_config jsonb, p_players text[])
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_name text;
  v_seat int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(array_length(p_players, 1), 0) < 1 then raise exception 'Mindestens ein Spieler nötig'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from sessions where code = v_code);
  end loop;
  insert into sessions (code, name, game, config, created_by, account_id)
  values (v_code, coalesce(nullif(trim(p_name), ''), 'Spielabend'), p_game, coalesce(p_config, '{}'::jsonb), auth.uid(), my_account_id())
  returning id into v_id;
  insert into games (session_id, number, config) values (v_id, 1, coalesce(p_config, '{}'::jsonb));
  insert into session_members (session_id, user_id, role) values (v_id, auth.uid(), 'editor');
  foreach v_name in array p_players loop
    if length(trim(v_name)) > 0 then
      v_seat := v_seat + 1;
      insert into players (session_id, name, seat, user_id)
      values (v_id, trim(v_name), v_seat, case when v_seat = 1 then auth.uid() else null end);
    end if;
  end loop;
  return v_code;
end $$;

-- ─── Beitreten = zusehen ──────────────────────────────────────
create or replace function join_session(p_code text, p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into v_id from sessions where code = upper(trim(p_code));
  if v_id is null then raise exception 'Keine Session mit diesem Code gefunden'; end if;
  insert into session_members (session_id, user_id, role) values (v_id, auth.uid(), 'viewer')
  on conflict do nothing;
  return v_id;
end $$;

create or replace function session_preview(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', s.name,
    'game', s.game,
    'status', s.status,
    'is_member', is_member(s.id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'claimed', p.user_id is not null) order by p.seat)
      from players p where p.session_id = s.id
    ), '[]'::jsonb)
  )
  from sessions s where s.code = upper(trim(p_code));
$$;

-- ─── Spielecode-Login ─────────────────────────────────────────
create or replace function account_login(p_code text, p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a accounts%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into a from accounts where code = upper(trim(p_code));
  if not found then
    perform pg_sleep(0.3);
    return jsonb_build_object('error', 'Code oder Passwort falsch');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    raise exception 'Zu viele Fehlversuche – bitte in 15 Minuten nochmal probieren';
  end if;
  if a.password_hash <> extensions.crypt(coalesce(p_password, ''), a.password_hash) then
    update accounts set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
    where id = a.id;
    return jsonb_build_object('error', 'Code oder Passwort falsch');
  end if;
  update accounts set failed_attempts = 0, locked_until = null, last_login_at = now() where id = a.id;
  insert into account_devices (user_id, account_id) values (auth.uid(), a.id)
  on conflict (user_id) do update set account_id = excluded.account_id, created_at = now();
  return jsonb_build_object('code', a.code, 'must_change', a.must_change);
end $$;

create or replace function account_logout()
returns void language sql security definer set search_path = public as $$
  delete from account_devices where user_id = auth.uid();
$$;

create or replace function my_account()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'code', a.code, 'must_change', a.must_change)
  from account_devices d join accounts a on a.id = d.account_id
  where d.user_id = auth.uid();
$$;

create or replace function account_change_password(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare a accounts%rowtype;
begin
  select a2.* into a from accounts a2 join account_devices d on d.account_id = a2.id where d.user_id = auth.uid();
  if not found then raise exception 'Nicht angemeldet'; end if;
  if not a.must_change and a.password_hash <> extensions.crypt(coalesce(p_old, ''), a.password_hash) then
    raise exception 'Aktuelles Passwort ist falsch';
  end if;
  if length(coalesce(p_new, '')) < 6 then raise exception 'Das Passwort braucht mindestens 6 Zeichen'; end if;
  update accounts set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), must_change = false
  where id = a.id;
  -- andere Geräte abmelden
  delete from account_devices where account_id = a.id and user_id <> auth.uid();
end $$;

-- ─── Admin ────────────────────────────────────────────────────
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_devices where user_id = auth.uid() and expires_at > now());
$$;

create or replace function admin_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admins%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into a from admins where lower(username) = lower(trim(p_username));
  if not found then
    perform pg_sleep(0.3);
    return jsonb_build_object('error', 'Benutzername oder Passwort falsch');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    raise exception 'Zu viele Fehlversuche – bitte in 15 Minuten nochmal probieren';
  end if;
  if a.password_hash <> extensions.crypt(coalesce(p_password, ''), a.password_hash) then
    update admins set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
    where id = a.id;
    return jsonb_build_object('error', 'Benutzername oder Passwort falsch');
  end if;
  update admins set failed_attempts = 0, locked_until = null where id = a.id;
  insert into admin_devices (user_id, admin_id, expires_at) values (auth.uid(), a.id, now() + interval '30 days')
  on conflict (user_id) do update set admin_id = excluded.admin_id, expires_at = excluded.expires_at;
  return jsonb_build_object('username', a.username);
end $$;

create or replace function admin_logout()
returns void language sql security definer set search_path = public as $$
  delete from admin_devices where user_id = auth.uid();
$$;

create or replace function admin_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('username', a.username)
  from admin_devices d join admins a on a.id = d.admin_id
  where d.user_id = auth.uid() and d.expires_at > now();
$$;

create or replace function admin_list_accounts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Kein Admin-Zugang'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'code', a.code, 'note', a.note, 'must_change', a.must_change,
      'created_at', a.created_at, 'last_login_at', a.last_login_at,
      'locked', a.locked_until is not null and a.locked_until > now(),
      'sessions', (select count(*) from sessions s where s.account_id = a.id),
      'devices', (select count(*) from account_devices d where d.account_id = a.id)
    ) order by a.created_at desc)
    from accounts a
  ), '[]'::jsonb);
end $$;

create or replace function admin_create_account(p_code text, p_password text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code, ''))); v_id uuid;
begin
  if not is_admin() then raise exception 'Kein Admin-Zugang'; end if;
  if v_code !~ '^[A-Z0-9-]{3,20}$' then raise exception 'Code: 3–20 Zeichen, nur Buchstaben, Ziffern und -'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Das Passwort braucht mindestens 6 Zeichen'; end if;
  if exists (select 1 from accounts where code = v_code) then raise exception 'Diesen Code gibt es schon'; end if;
  insert into accounts (code, password_hash, note)
  values (v_code, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), coalesce(p_note, ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function admin_update_note(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Kein Admin-Zugang'; end if;
  update accounts set note = coalesce(p_note, '') where id = p_id;
end $$;

create or replace function admin_reset_password(p_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Kein Admin-Zugang'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Das Passwort braucht mindestens 6 Zeichen'; end if;
  update accounts set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    must_change = true, failed_attempts = 0, locked_until = null
  where id = p_id;
  delete from account_devices where account_id = p_id;
end $$;

create or replace function admin_delete_account(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Kein Admin-Zugang'; end if;
  delete from accounts where id = p_id;
end $$;

create or replace function admin_change_password(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare a admins%rowtype;
begin
  select a2.* into a from admins a2 join admin_devices d on d.admin_id = a2.id
  where d.user_id = auth.uid() and d.expires_at > now();
  if not found then raise exception 'Kein Admin-Zugang'; end if;
  if a.password_hash <> extensions.crypt(coalesce(p_old, ''), a.password_hash) then raise exception 'Aktuelles Passwort ist falsch'; end if;
  if length(coalesce(p_new, '')) < 8 then raise exception 'Das Admin-Passwort braucht mindestens 8 Zeichen'; end if;
  update admins set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = a.id;
end $$;

-- ─── Rechte ───────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'my_account_id()', 'is_member(uuid)', 'is_editor(uuid)', 'can_edit(uuid)',
    'create_session(text, text, jsonb, text[])', 'join_session(text, text)', 'session_preview(text)',
    'account_login(text, text)', 'account_logout()', 'my_account()', 'account_change_password(text, text)',
    'is_admin()', 'admin_login(text, text)', 'admin_logout()', 'admin_me()', 'admin_list_accounts()',
    'admin_create_account(text, text, text)', 'admin_update_note(uuid, text)',
    'admin_reset_password(uuid, text)', 'admin_delete_account(uuid)', 'admin_change_password(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
