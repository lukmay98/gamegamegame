"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Sheet } from "./sheet";

export function ShareSheet({ open, onClose, code, name }: { open: boolean; onClose: () => void; code: string; name: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/s/${code}` : `${window.location.origin}/s/${code}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#1c2540", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Zwischenablage nicht erlaubt */
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Sheet open={open} onClose={onClose} title="Mitspieler einladen">
      <div className="card p-5 flex flex-col items-center gap-4">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Spieltag-Code</div>
        <div className="font-display font-extrabold text-4xl tracking-[0.25em] tabular" style={{ color: "var(--color-ink)" }}>{code}</div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR-Code für Spieltag ${code}`} className="w-52 h-52 rounded-xl" />
        )}
        <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          QR-Code scannen oder auf der Startseite den Code eingeben.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="btn btn-ghost" onClick={copy}>{copied ? "Kopiert ✓" : "Link kopieren"}</button>
        <button
          className="btn btn-primary"
          disabled={!canShare}
          onClick={() => void navigator.share({ title: name, text: `Spiel mit bei „${name}“ – Code ${code}`, url }).catch(() => {})}
        >
          Teilen …
        </button>
      </div>
    </Sheet>
  );
}
