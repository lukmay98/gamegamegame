import Link from "next/link";

export function LegalLink() {
  return (
    <p className="mt-10 text-center text-xs">
      <Link href="/rechtliches" className="underline" style={{ color: "var(--color-text-muted)" }}>
        Impressum &amp; Datenschutz
      </Link>
    </p>
  );
}
