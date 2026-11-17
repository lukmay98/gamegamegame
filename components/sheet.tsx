"use client";

import { useEffect, type ReactNode } from "react";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/40" aria-label="Schließen" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 pb-8"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-[17px]">{title}</h2>
          <button className="text-[17px] font-semibold" onClick={onClose}>Fertig</button>
        </div>
        {children}
      </div>
    </div>
  );
}
