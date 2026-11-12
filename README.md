# GameGameGame

Gemeinsamer Spielblock für Karten- und Würfelspiele. Die App schreibt nur mit,
gespielt wird am Tisch. Eine Person startet eine Session, die anderen treten mit einem
6-stelligen Code oder per QR-Code bei, und alle sehen den Spielstand live auf
ihrem Handy. **Niemand braucht ein Konto.**

**Live:** https://gamegamegame-ten.vercel.app

Stack wie beim Golf-Projekt: Next.js 16 + Tailwind 4 + Supabase (Postgres, Auth,
Realtime) auf Vercel.

## Spiele

- **Fuck the Neighbour** (Stiche ansagen): Kartenzahl pro Runde steigt und fällt
  (z. B. 1 → 10 → 1). Jede Runde sagt jeder an, wie viele Stiche er macht, danach
  werden die Stiche eingetragen. Der Geber rotiert automatisch, und die Geber-Regel
  (die Summe der Ansagen darf nicht gleich der Kartenzahl sein) ist abschaltbar.
  Für die Punkte gibt es drei Voreinstellungen oder eine eigene Regel.
- **Freie Punkteliste**: Für jedes andere Spiel. Pro Runde Punkte je Spieler
  (auch negativ), optional mit Zielpunktzahl und „wenigste Punkte gewinnen“.

Neue Spiele kommen in `lib/games/` dazu (Wertung) plus eine Board-Komponente in
`components/`.

## 1. Supabase einrichten

1. Auf https://supabase.com ein neues Projekt anlegen.
2. **Authentication → Sign In / Providers → „Allow anonymous sign-ins“
   einschalten.** (Ohne das funktioniert der Beitritt ohne Konto nicht.)
3. **SQL Editor → New query**, den Inhalt von `supabase/schema.sql` einfügen,
   **Run**. Das Skript kann man gefahrlos mehrmals ausführen.
4. **Project Settings → API**: *Project URL* und *anon public key* kopieren.

## 2. Lokal starten (optional)

```
cp .env.local.example .env.local   # Werte aus Schritt 1.4 eintragen
npm install
npm run dev
```

http://localhost:3000 öffnen. Zum Testen mit mehreren Spielern einfach ein
zweites Browserfenster im Inkognito-Modus nehmen, denn das zählt als eigenes Gerät.

`npm test` prüft die Wertungslogik.

## 3. GitHub + Vercel

1. Neues GitHub-Repo anlegen (z. B. `gamegamegame`) und diesen Ordner pushen:
   ```
   git remote add origin https://github.com/<dein-user>/gamegamegame.git
   git push -u origin main
   ```
2. Auf https://vercel.com: **Add New → Project**, das Repo importieren.
3. Unter **Environment Variables** `NEXT_PUBLIC_SUPABASE_URL` und
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` eintragen, optional `CRON_SECRET`.
4. **Deploy.** Den Link (z. B. `gamegamegame.vercel.app`) an die Runde schicken.

Ein täglicher Vercel-Cron (`vercel.json` → `/api/keepalive`) hält das
Supabase-Free-Tier wach, damit es nicht nach 7 Tagen pausiert.

## Wie es funktioniert

- Jedes Gerät meldet sich beim ersten Öffnen still als anonymer Supabase-User an.
  Die Anmeldung bleibt im Browser gespeichert. Mit einem anderen Browser oder
  nach dem Löschen der Website-Daten gilt es als neues Gerät. Mit dem Code
  kommt man aber jederzeit wieder rein und wählt seinen Namen erneut.
- **Mitglieder** sind Geräte, **Spieler** sind Namen am Tisch. Ein Handy kann
  also für mehrere Leute mitschreiben. Beim Beitritt wählt man einen freien
  Namen („Wer bist du?“), legt einen neuen an oder schaut nur zu.
- Row Level Security: Nur Mitglieder einer Session sehen und ändern deren Daten.
  Beitritt läuft ausschließlich über `join_session(code)`.
- Live-Updates über Supabase Realtime. Jede Änderung lädt die Session auf allen
  Geräten neu, auch nach Standby beim Zurückkehren in die App.
- Alle Mitglieder dürfen alles eintragen, bei gleichzeitigen Änderungen am selben
  Feld gilt die letzte.

## Struktur

```
app/page.tsx            Start: neue Session, Code eingeben, meine Sessions
app/new/page.tsx        Session anlegen (Spiel, Spieler, Regeln)
app/s/[code]/page.tsx   Beitreten + Live-Spielansicht
components/             Boards (FTN, Liste), Rangliste, Teilen/QR, Spieler
lib/games/              Wertungslogik (+ Tests)
lib/use-live-session.ts Laden + Realtime-Abo
supabase/schema.sql     Tabellen, RLS, RPCs, Realtime
```
