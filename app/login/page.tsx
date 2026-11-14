"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LegalLink } from "@/components/legal-link";
import { ErrorBox, Page, TopBar } from "@/components/ui";
import { loginAccount } from "@/lib/account";
import { OWNER } from "@/lib/site";
import { ensureSignedIn, errorText } from "@/lib/supabase";

const REQUEST_MAIL = `mailto:${OWNER.email}?subject=${encodeURIComponent("Anfrage für einen eigenen Spiele Code")}`;

export default function Login() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn();
      const res = await loginAccount(code, password);
      if ("error" in res) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.replace(res.must_change ? "/konto/passwort" : "/");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Mit Spielecode anmelden" back="/" />
      <Page>
        <form
          className="card p-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label className="label" htmlFor="code">Spielecode</label>
            <input
              id="code"
              className="input font-display font-bold tracking-[0.15em] uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20))}
              autoCapitalize="characters"
              autoComplete="username"
              placeholder="z. B. FAM-MAYR"
            />
          </div>
          <div>
            <label className="label" htmlFor="pw">Passwort</label>
            <input
              id="pw"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy || code.length < 3 || !password}>
            {busy ? "Anmelden …" : "Anmelden"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          Noch keinen Code?{" "}
          <a href={REQUEST_MAIL} className="font-semibold underline" style={{ color: "var(--color-ink)" }}>
            Code beim Entwickler anfragen
          </a>
        </p>
        <LegalLink />
      </Page>
    </>
  );
}
