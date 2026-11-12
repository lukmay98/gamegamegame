"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function TopBar({ title, back, right }: { title: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
      style={{ background: "var(--color-ink)", color: "white" }}
    >
      {back ? (
        <Link href={back} aria-label="Zurück" className="-ml-1 p-1 rounded-lg hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : (
        <Logo />
      )}
      <div className="flex-1 min-w-0 font-display font-bold text-[15px] tracking-tight truncate">{title}</div>
      {right}
    </header>
  );
}

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="11" height="15" rx="2" transform="rotate(-10 8 11)" fill="#c63d32" />
      <rect x="9" y="5" width="11" height="15" rx="2" transform="rotate(8 14 12)" fill="white" />
      <circle cx="14.6" cy="12.6" r="1.6" fill="#1c2540" />
    </svg>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="flex-1 w-full max-w-lg mx-auto px-4 py-5 pb-28">{children}</main>;
}

export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  forbidden,
  disabled,
}: {
  value: number | null;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  forbidden?: number | null;
  disabled?: boolean;
}) {
  const current = value ?? null;
  const step = (dir: 1 | -1) => {
    let next = current == null ? min : current + dir;
    if (next === forbidden) next += dir;
    if (next < min || next > max) return;
    onChange(next);
  };
  const isForbidden = current != null && current === forbidden;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="btn btn-soft !p-0 w-10 h-10 text-lg"
        onClick={() => step(-1)}
        disabled={disabled || current == null || current <= min}
        aria-label="weniger"
      >
        −
      </button>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg tabular"
        style={{
          background: isForbidden ? "var(--color-accent-soft)" : current == null ? "transparent" : "var(--color-surface-soft)",
          border: current == null ? "1.5px dashed var(--color-border)" : "none",
          color: isForbidden ? "var(--color-accent)" : "var(--color-ink)",
        }}
      >
        {current ?? "–"}
      </div>
      <button
        type="button"
        className="btn btn-soft !p-0 w-10 h-10 text-lg"
        onClick={() => step(1)}
        disabled={disabled || (current != null && current >= max)}
        aria-label="mehr"
      >
        +
      </button>
    </div>
  );
}

export function Spinner({ label = "Lädt …" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm" style={{ color: "var(--color-text-muted)" }}>
      <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
      {children}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="mt-0.5 shrink-0 w-11 h-6 rounded-full relative transition-colors"
        style={{ background: checked ? "var(--color-ink)" : "var(--color-border)" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: checked ? "1.375rem" : "0.125rem" }}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{hint}</span>}
      </span>
    </label>
  );
}
