"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { ErrorBox, Page, Spinner, TopBar } from "@/components/ui";
import { ensureSignedIn, errorText, supabase } from "@/lib/supabase";

interface AdminAccount {
  id: string;
  code: string;
  note: string;
  must_change: boolean;
  created_at: string;
  last_login_at: string | null;
  locked: boolean;
  sessions: number;
  devices: number;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  await ensureSignedIn();
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

/** Leicht lesbares Startpasswort ohne verwechselbare Zeichen. */
function randomPassword() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => a[b % a.length]).join("");
}

export default function Admin() {
  const [me, setMe] = useState<{ username: string } | null | undefined>(undefined);

  useEffect(() => {
    rpc<{ username: string } | null>("admin_me").then(setMe, () => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <>
        <TopBar title="Admin" back="/" />
        <Spinner />
      </>
    );
  }
  return me ? <Portal username={me.username} onLogout={() => setMe(null)} /> : <AdminLogin onLogin={setMe} />;
}

function AdminLogin({ onLogin }: { onLogin: (me: { username: string }) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await rpc<{ username?: string; error?: string }>("admin_login", { p_username: username, p_password: password });
      if (res.error || !res.username) {
        setError(res.error ?? "Anmeldung fehlgeschlagen");
        setBusy(false);
        return;
      }
      onLogin({ username: res.username });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Admin-Portal" back="/" />
      <Page>
        <form
          className="card p-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label className="label" htmlFor="u">Benutzername</label>
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" />
          </div>
          <div>
            <label className="label" htmlFor="p">Passwort</label>
            <input id="p" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn btn-primary w-full !py-3" disabled={busy || !username || !password}>
            {busy ? "Anmelden …" : "Anmelden"}
          </button>
        </form>
      </Page>
    </>
  );
}

function Portal({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setAccounts(await rpc<AdminAccount[]>("admin_list_accounts"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    rpc<AdminAccount[]>("admin_list_accounts").then(setAccounts, (e) => setError(errorText(e)));
  }, []);

  async function logout() {
    await rpc("admin_logout").catch(() => undefined);
    onLogout();
  }

  const q = filter.trim().toLowerCase();
  const shown = (accounts ?? []).filter((a) => !q || a.code.toLowerCase().includes(q) || a.note.toLowerCase().includes(q));

  return (
    <>
      <TopBar
        title="Admin-Portal"
        back="/"
        right={<span className="text-xs opacity-80">{username}</span>}
      />
      <Page>
        {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}

        <button className="btn btn-accent w-full !py-3.5 text-base mb-4" onClick={() => setCreating(true)}>
          ＋ Spielecode anlegen
        </button>

        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="font-display font-bold text-lg">Spielecodes {accounts && <span className="text-sm font-normal" style={{ color: "var(--color-text-muted)" }}>· {accounts.length}</span>}</h2>
        </div>
        {accounts && accounts.length > 4 && (
          <input className="input mb-3" placeholder="Suchen (Code oder Notiz)" value={filter} onChange={(e) => setFilter(e.target.value)} />
        )}

        {accounts == null ? (
          <Spinner />
        ) : accounts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Noch keine Spielecodes angelegt.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((a) => (
              <li key={a.id}>
                <button className="card w-full text-left px-4 py-3 hover:border-[var(--color-ink)]" onClick={() => setSelected(a)}>
                  <span className="flex items-center gap-2">
                    <span className="font-display font-bold tracking-wider">{a.code}</span>
                    {a.must_change && <span className="chip !text-[11px]" style={{ background: "var(--color-surface-soft)" }}>Startpasswort</span>}
                    {a.locked && <span className="chip !text-[11px]" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>gesperrt</span>}
                    <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>{a.sessions} Spieltage</span>
                  </span>
                  {a.note && <span className="block text-sm mt-1 line-clamp-2 whitespace-pre-line" style={{ color: "var(--color-ink-soft)" }}>{a.note}</span>}
                  <span className="block text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                    angelegt {fmt(a.created_at)} · zuletzt angemeldet {a.last_login_at ? fmt(a.last_login_at) : "nie"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 mt-8">
          <button className="btn btn-ghost flex-1" onClick={() => setPwOpen(true)}>Admin-Passwort ändern</button>
          <button className="btn btn-ghost flex-1" onClick={() => void logout()}>Abmelden</button>
        </div>
      </Page>

      {creating && (
        <CreateSheet
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
      {selected && (
        <AccountSheet
          key={selected.id}
          account={accounts?.find((a) => a.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
          onDeleted={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
      {pwOpen && <AdminPasswordSheet onClose={() => setPwOpen(false)} />}
    </>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function CreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; password: string } | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await rpc("admin_create_account", { p_code: code, p_password: password, p_note: note });
      setDone({ code: code.toUpperCase(), password });
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  if (done) {
    return (
      <Sheet open onClose={onCreated} title="Spielecode angelegt">
        <Credentials code={done.code} password={done.password} />
        <button className="btn btn-primary w-full mt-4" onClick={onCreated}>Fertig</button>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Spielecode anlegen">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label className="label" htmlFor="c">Spielecode</label>
          <input
            id="c"
            className="input font-display font-bold tracking-[0.15em] uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20))}
            placeholder="z. B. FAM-MAYR"
            autoCapitalize="characters"
          />
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>3–20 Zeichen: Buchstaben, Ziffern, Bindestrich.</p>
        </div>
        <div>
          <label className="label" htmlFor="pw">Startpasswort</label>
          <div className="flex gap-2">
            <input id="pw" className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
            <button type="button" className="btn btn-ghost shrink-0" onClick={() => setPassword(randomPassword())}>Neu</button>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Muss beim ersten Login durch ein eigenes ersetzt werden.</p>
        </div>
        <div>
          <label className="label" htmlFor="n">Notiz (nur für dich)</label>
          <textarea id="n" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wer, wann angefragt, …" />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button className="btn btn-accent w-full !py-3" disabled={busy || code.length < 3 || password.length < 6}>
          {busy ? "Legt an …" : "Anlegen"}
        </button>
      </form>
    </Sheet>
  );
}

function Credentials({ code, password }: { code: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Dein GameGameGame-Spielecode\n\nCode: ${code}\nPasswort: ${password}\n\nAnmelden: ${typeof window !== "undefined" ? window.location.origin : ""}/login\nBeim ersten Login legst du ein eigenes Passwort fest.`;
  return (
    <div className="card p-4" style={{ background: "var(--color-surface-soft)" }}>
      <p className="text-sm">Code: <b className="font-display tracking-wider">{code}</b></p>
      <p className="text-sm">Passwort: <b className="font-mono">{password}</b></p>
      <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
        Das Passwort wird nur jetzt angezeigt. Gib beides an den Anfragenden weiter.
      </p>
      <button
        className="btn btn-ghost w-full mt-3"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
      >
        {copied ? "✓ Kopiert" : "Text zum Weitergeben kopieren"}
      </button>
    </div>
  );
}

function AccountSheet({
  account,
  onClose,
  onChanged,
  onDeleted,
}: {
  account: AdminAccount;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [note, setNote] = useState(account.note);
  const [saved, setSaved] = useState(false);
  const [reset, setReset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  return (
    <Sheet open onClose={onClose} title={account.code}>
      <div className="flex flex-col gap-4">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {account.sessions} Spieltage · {account.devices} angemeldete Geräte · angelegt {fmt(account.created_at)} · zuletzt angemeldet{" "}
          {account.last_login_at ? fmt(account.last_login_at) : "nie"}
          {account.must_change && " · Startpasswort noch nicht geändert"}
        </p>

        <div>
          <label className="label" htmlFor="note">Notiz (nur für dich)</label>
          <textarea id="note" className="input min-h-24" value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
          <button
            className="btn btn-primary w-full mt-2"
            disabled={busy || note === account.note && !saved}
            onClick={() => void act(async () => { await rpc("admin_update_note", { p_id: account.id, p_note: note }); setSaved(true); })}
          >
            {saved ? "✓ Gespeichert" : "Notiz speichern"}
          </button>
        </div>

        <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
          <h3 className="font-semibold mb-1">Passwort zurücksetzen</h3>
          <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
            Vergibt ein neues Startpasswort und meldet alle Geräte ab. Beim nächsten Login muss wieder ein eigenes Passwort gesetzt werden.
          </p>
          {reset ? (
            <Credentials code={account.code} password={reset} />
          ) : (
            <button
              className="btn btn-ghost w-full"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Passwort von ${account.code} zurücksetzen?`)) return;
                const pw = randomPassword();
                void act(async () => { await rpc("admin_reset_password", { p_id: account.id, p_password: pw }); setReset(pw); });
              }}
            >
              Neues Startpasswort vergeben
            </button>
          )}
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button
          className="btn btn-ghost w-full"
          style={{ color: "var(--color-accent)" }}
          disabled={busy}
          onClick={() => {
            if (!confirm(`Spielecode ${account.code} löschen? Er kann sich danach nicht mehr anmelden. Seine Spieltage bleiben auf den Geräten erhalten, auf denen sie erstellt wurden.`)) return;
            setBusy(true);
            rpc("admin_delete_account", { p_id: account.id }).then(onDeleted, (e) => { setError(errorText(e)); setBusy(false); });
          }}
        >
          🗑️ Spielecode löschen
        </button>
      </div>
    </Sheet>
  );
}

function AdminPasswordSheet({ onClose }: { onClose: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <Sheet open onClose={onClose} title="Admin-Passwort ändern">
      {done ? (
        <p className="text-sm">✓ Passwort geändert.</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            rpc("admin_change_password", { p_old: oldPw, p_new: pw }).then(
              () => setDone(true),
              (err) => { setError(errorText(err)); setBusy(false); },
            );
          }}
        >
          <div>
            <label className="label" htmlFor="o">Aktuelles Passwort</label>
            <input id="o" type="password" className="input" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className="label" htmlFor="np">Neues Passwort</label>
            <input id="np" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Mindestens 8 Zeichen.</p>
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn btn-primary w-full" disabled={busy || !oldPw || pw.length < 8}>Speichern</button>
        </form>
      )}
    </Sheet>
  );
}
