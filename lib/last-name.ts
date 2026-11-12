"use client";

import { useSyncExternalStore } from "react";

// Merkt sich auf diesem Gerät den zuletzt verwendeten Spielernamen,
// damit man ihn nicht jedes Mal neu eintippen muss.
const KEY = "ggg:lastName";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function useLastName(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    read,
    () => "",
  );
}

export function saveLastName(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* localStorage nicht verfügbar */
  }
}
