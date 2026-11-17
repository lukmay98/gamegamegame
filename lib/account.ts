"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/** Mit Spielecode angemeldetes Konto dieses Geräts. */
export interface Account {
  id: string;
  code: string;
  must_change: boolean;
  /** Anzahl Geräte, die mit diesem Code angemeldet sind */
  devices?: number;
}

type State = { loading: boolean; account: Account | null };

let state: State = { loading: true, account: null };
let started = false;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export async function reloadAccount(): Promise<Account | null> {
  const { data, error } = await supabase().rpc("my_account");
  if (error) throw error;
  const account = (data as Account | null) ?? null;
  set({ loading: false, account });
  return account;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    reloadAccount().catch(() => set({ loading: false, account: null }));
  }
  return () => listeners.delete(cb);
}

const SERVER: State = { loading: true, account: null };

export function useAccount(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** Gibt einen Fehlertext zurück oder null bei Erfolg. */
export async function loginAccount(code: string, password: string): Promise<{ error: string } | Account> {
  const { data, error } = await supabase().rpc("account_login", { p_code: code, p_password: password });
  if (error) throw error;
  const res = data as { error?: string };
  if (res.error) return { error: res.error };
  const account = await reloadAccount();
  return account ?? { error: "Anmeldung fehlgeschlagen" };
}

export async function logoutAccount() {
  const { error } = await supabase().rpc("account_logout");
  if (error) throw error;
  set({ loading: false, account: null });
}

export async function changeAccountPassword(oldPassword: string | null, newPassword: string) {
  const { error } = await supabase().rpc("account_change_password", { p_old: oldPassword, p_new: newPassword });
  if (error) throw error;
  await reloadAccount();
}
