"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Page, Spinner, TopBar } from "@/components/ui";
import { changeAccountPassword, useAccount } from "@/lib/account";
import { errorText } from "@/lib/supabase";

export default function SetPassword() {
  const router = useRouter();
  const { loading, account } = useAccount();
  const [oldPw, setOldPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <>
        <TopBar title="Passwort" back="/" />
        <Spinner />
      </>
    );
  }
  if (!account) {
    return (
      <>
        <TopBar title="Passwort" back="/" />
        <Page><ErrorBox>Du bist nicht angemeldet.</ErrorBox></Page>
      </>
    );
  }

  const first = account.must_change;
  const mismatch = pw2.length > 0 && pw !== pw2;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await changeAccountPassword(first ? null : oldPw, pw);
      router.replace("/");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title={first ? "Eigenes Passwort festlegen" : "Passwort ändern"} back={first ? undefined : "/"} />
      <Page>
        {first && (
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            Willkommen, <b style={{ color: "var(--color-ink)" }}>{account.code}</b>! Lege jetzt dein eigenes Passwort fest.
            Es ist verschlüsselt gespeichert – auch der Entwickler kann es nicht sehen.
          </p>
        )}
        <form
          className="card p-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input type="text" autoComplete="username" value={account.code} readOnly hidden />
          {!first && (
            <div>
              <label className="label" htmlFor="old">Aktuelles Passwort</label>
              <input id="old" type="password" className="input" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="pw">Neues Passwort</label>
            <input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Mindestens 6 Zeichen.</p>
          </div>
          <div>
            <label className="label" htmlFor="pw2">Neues Passwort wiederholen</label>
            <input id="pw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            {mismatch && <p className="text-xs mt-1" style={{ color: "var(--color-accent)" }}>Die Passwörter stimmen nicht überein.</p>}
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy || pw.length < 6 || pw !== pw2 || (!first && !oldPw)}>
            {busy ? "Speichert …" : "Passwort speichern"}
          </button>
        </form>
      </Page>
    </>
  );
}
