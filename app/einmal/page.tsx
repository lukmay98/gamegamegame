"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LegalLink } from "@/components/legal-link";
import { ErrorBox, Page, TopBar } from "@/components/ui";
import { SessionList } from "@/components/session-list";
import type { Session } from "@/lib/games";
import { deleteSession, leaveSession } from "@/lib/actions";
import { ensureSignedIn, errorText, supabase } from "@/lib/supabase";

export default function SingleUse() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  async function remove(s: Session) {
    if (!me) return;
    const host = s.created_by === me;
    const ok = confirm(
      host
        ? `„${s.name}“ endgültig löschen? Der Spieltag verschwindet für alle Mitspieler und kann nicht wiederhergestellt werden.`
        : `„${s.name}“ aus deiner Liste entfernen? Mit dem Code ${s.code} kannst du jederzeit wieder beitreten.`,
    );
    if (!ok) return;
    try {
      if (host) await deleteSession(s.id);
      else await leaveSession(s.id, me);
      setSessions((all) => (all ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      setError(errorText(e));
    }
  }

  useEffect(() => {
    (async () => {
      setMe(await ensureSignedIn());
      const { data, error } = await supabase()
        .from("sessions")
        .select("*")
        .is("account_id", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setSessions((data ?? []) as Session[]);
    })().catch((e) => {
      setError(errorText(e));
      setSessions([]);
    });
  }, []);

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  return (
    <>
      <TopBar title="Ohne Login" back="/" />
      <Page>
        <section className="mb-6">
          <h1 className="font-display font-extrabold text-3xl tracking-tight leading-tight" style={{ color: "var(--color-ink)" }}>
            Der Spielblock,
            <br />
            den alle sehen.
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Spieltag starten, Code teilen – alle sehen live mit. Ganz ohne Konto.
          </p>
        </section>

        {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}

        <Link href="/new" className="btn btn-accent w-full !py-3.5 text-base mb-3">
          <span className="text-lg leading-none">＋</span> Neuer Spieltag
        </Link>

        <form
          className="card p-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode.length === 6) router.push(`/s/${cleanCode}`);
          }}
        >
          <input
            className="input font-display font-bold tracking-[0.3em] uppercase text-center"
            placeholder="CODE"
            value={cleanCode}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-label="Spieltag-Code"
          />
          <button className="btn btn-primary shrink-0" disabled={cleanCode.length !== 6}>
            Beitreten
          </button>
        </form>

        <h2 className="mt-8 mb-3 font-display font-bold text-lg">Meine Spieltage</h2>
        <SessionList
          sessions={sessions}
          empty="Noch keine. Spieltage, die du startest oder ansiehst, erscheinen hier."
          deleteLabel={(s) => (s.created_by === me ? "Für alle löschen" : "Aus meiner Liste entfernen")}
          onRemove={(s) => void remove(s)}
        />
        <LegalLink />
      </Page>
    </>
  );
}
