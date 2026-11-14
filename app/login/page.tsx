"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
        <Faq />
        <LegalLink />
      </Page>
    </>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Was ist ein Spielecode?",
    a: "Ein eigener Zugang für deine Spielrunde. Alle Spieltage, die du damit anlegst, bleiben gespeichert. Ein neuer Spieltag übernimmt automatisch Namen, Sitzreihenfolge und Regeln vom letzten.",
  },
  {
    q: "Wie bekomme ich einen Spielecode?",
    a: (
      <>
        Tippe oben auf „Code beim Entwickler anfragen“ – es öffnet sich deine Mail-App. Du bekommst Code und Startpasswort per Mail zurück.
        Beim ersten Login legst du dein eigenes Passwort fest.
      </>
    ),
  },
  {
    q: "Kostet das etwas?",
    a: "Nein. GameGameGame ist ein privates, kostenloses Projekt ohne Werbung.",
  },
  {
    q: "Brauche ich überhaupt einen Code?",
    a: "Nein. Mit „Einmal-Session ohne Login“ auf der Startseite kannst du sofort losspielen. Dann kann aber nur das Gerät eintragen, auf dem die Session erstellt wurde, und Namen und Regeln werden nicht für das nächste Mal gemerkt.",
  },
  {
    q: "Können meine Mitspieler auch eintragen?",
    a: "Mitspieler, die per QR-Code oder Session-Code beitreten, sehen alle Eingaben live, können aber nichts ändern. Eintragen kann, wer mit dem Spielecode angemeldet ist.",
  },
  {
    q: "Kann ich mich auf mehreren Geräten anmelden?",
    a: "Ja. Du kannst dich mit deinem Code auf mehreren Handys anmelden und überall eintragen – praktisch, wenn ein Akku leer wird.",
  },
  {
    q: "Ich habe mein Passwort vergessen.",
    a: (
      <>
        Schreib eine kurze Mail an <a className="underline" href={`mailto:${OWNER.email}`}>{OWNER.email}</a>. Du bekommst ein neues Startpasswort und
        legst danach wieder ein eigenes fest.
      </>
    ),
  },
  {
    q: "Kann der Entwickler mein Passwort sehen?",
    a: "Nein. Passwörter werden nur verschlüsselt gespeichert und können von niemandem gelesen werden – auch nicht vom Entwickler. Er kann es nur zurücksetzen.",
  },
  {
    q: "Wie lösche ich meine Daten?",
    a: "Einzelne Spieltage löschst du über den Papierkorb auf deiner Startseite. Soll der ganze Spielecode samt Daten gelöscht werden, genügt eine kurze Mail.",
  },
];

function Faq() {
  return (
    <section className="mt-10">
      <h2 className="font-display font-bold text-lg mb-3">Fragen &amp; Antworten</h2>
      <div className="flex flex-col gap-2">
        {FAQ.map((f) => (
          <details key={f.q} className="card px-4 py-3 group">
            <summary className="font-semibold cursor-pointer list-none flex items-center justify-between gap-3">
              {f.q}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 transition-transform group-open:rotate-180"
                style={{ color: "var(--color-text-muted)" }}
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
