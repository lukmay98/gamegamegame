"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Speicher für die Anmeldung: localStorage, wenn möglich, sonst Arbeitsspeicher.
// (iOS Safari kann localStorage blockieren oder leeren, z. B. bei strengen
// Datenschutz-Einstellungen oder in eingebetteten Browsern.)
const memory = new Map<string, string>();
const safeStorage = {
  getItem(key: string) {
    try {
      const v = window.localStorage.getItem(key);
      if (v != null) return v;
    } catch {
      /* blockiert */
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* blockiert → nur Arbeitsspeicher */
    }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* egal */
    }
  },
};

let authClient: SupabaseClient | null = null;
let dataClient: SupabaseClient | null = null;

/** Nur für die Anmeldung (anonyme Session, Token-Erneuerung). */
function auth(): SupabaseClient {
  if (!authClient) {
    authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window === "undefined" ? undefined : safeStorage,
      },
    });
  }
  return authClient;
}

/**
 * Client für alle Daten-Anfragen und Realtime. Holt sich vor JEDER Anfrage
 * über ensureSignedIn() ein gültiges Token. Ist die Anmeldung unterwegs
 * verloren gegangen (passiert v. a. in iOS Safari), wird neu angemeldet,
 * statt die Anfrage still ohne Anmeldung zu schicken.
 */
export function supabase(): SupabaseClient {
  if (!dataClient) {
    dataClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      accessToken: async () => (await signIn()).token,
    });
  }
  return dataClient;
}

let inFlight: Promise<{ userId: string; token: string }> | null = null;

function signIn(): Promise<{ userId: string; token: string }> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const sb = auth();
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (session && (session.expires_at ?? 0) * 1000 > Date.now() + 30_000) {
      return { userId: session.user.id, token: session.access_token };
    }
    if (session) {
      const { data: refreshed } = await sb.auth.refreshSession();
      if (refreshed.session) return { userId: refreshed.session.user.id, token: refreshed.session.access_token };
    }
    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error || !anon.session) {
      throw new Error(
        error?.message.includes("Anonymous sign-ins are disabled")
          ? "Anonyme Anmeldung ist in Supabase deaktiviert (siehe README, Schritt 1)."
          : (error?.message ?? "Anmeldung fehlgeschlagen"),
      );
    }
    return { userId: anon.session.user.id, token: anon.session.access_token };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Stellt sicher, dass dieses Gerät angemeldet ist (anonym), und gibt die User-ID zurück. */
export async function ensureSignedIn(): Promise<string> {
  return (await signIn()).userId;
}

/** Kompatibilität: Daten-Client (meldet sich bei Bedarf selbst an). */
export async function db(): Promise<SupabaseClient> {
  return supabase();
}

/** Fehlermeldung aus Supabase/Postgres lesbar machen. */
export function errorText(err: unknown): string {
  if (!err) return "Unbekannter Fehler";
  if (typeof err === "string") return err;
  const e = err as { message?: string; code?: string };
  if (e.code === "23505") return "Das gibt es schon (doppelter Eintrag).";
  if (e.code === "42501") return "Anmeldung verloren. Bitte nochmal versuchen oder die Seite neu laden.";
  return e.message ?? "Unbekannter Fehler";
}
