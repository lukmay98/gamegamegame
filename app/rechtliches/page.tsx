import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_UPDATED, OWNER } from "@/lib/site";

export const metadata: Metadata = { title: "Impressum & Datenschutz · GameGameGame" };

export default function Rechtliches() {
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: "var(--color-ink)", color: "white" }}>
        <Link href="/" aria-label="Zurück" className="-ml-1 p-1 rounded-lg hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div className="font-display font-bold text-[15px]">Impressum &amp; Datenschutz</div>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 pb-16 text-sm leading-relaxed">
        <H>Impressum</H>
        <p className="mb-1 font-semibold">Offenlegung gemäß § 25 Mediengesetz</p>
        <p>
          Medieninhaber und Betreiber: {OWNER.name}, {OWNER.city}, Österreich
          <br />
          Kontakt: <a className="underline" href={`mailto:${OWNER.email}`}>{OWNER.email}</a>
        </p>
        <p className="mt-2">
          GameGameGame ist eine private, nicht-kommerzielle Spielhilfe zum gemeinsamen Mitschreiben von Spielständen bei Karten- und Würfelspielen.
          Es gibt keine Werbung, keine Bezahlfunktionen und keine redaktionellen Inhalte.
        </p>

        <H>Nutzungshinweise</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Die Nutzung ist kostenlos und ohne Konto möglich; optional gibt es Spielecodes, die man per E-Mail beim Betreiber anfragen kann. Es besteht kein Anspruch auf Verfügbarkeit; Daten können jederzeit verloren gehen.</li>
          <li>Punkteberechnungen erfolgen ohne Gewähr – maßgeblich sind die Regeln eurer Runde.</li>
          <li>Bitte für Spieler- und Session-Namen nur Vornamen oder Spitznamen verwenden und keine sensiblen Daten eintragen.</li>
          <li>Wer den Session-Code kennt, kann der Session beitreten und alle Einträge darin live sehen (nicht ändern). Gebt den Code nur an Mitspieler weiter.</li>
        </ul>

        <H>Datenschutzerklärung</H>
        <p>Stand: {LEGAL_UPDATED}</p>

        <H2>Verantwortlicher</H2>
        <p>{OWNER.name}, {OWNER.city}, Österreich · <a className="underline" href={`mailto:${OWNER.email}`}>{OWNER.email}</a></p>

        <H2>Welche Daten verarbeitet werden</H2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Spieldaten:</b> Session-Name, Session-Code, Spielernamen, Sitzreihenfolge, Ansagen, Stiche und Punkte – also das, was ihr selbst eintragt.</li>
          <li><b>Anonyme Geräte-Kennung:</b> Beim ersten Öffnen erhält dein Browser eine zufällige, anonyme Nutzer-ID (ohne E-Mail, Name oder Passwort). Damit wird gespeichert, welchen Sessions dieses Gerät beigetreten ist und welche es angelegt hat.</li>
          <li><b>Spielecode (optional):</b> Code, Passwort (nur verschlüsselt als Hash gespeichert – niemand kann es einsehen), Zeitpunkt der letzten Anmeldung, Fehlversuche, sowie eine Notiz des Betreibers zur Zuordnung (z. B. wer den Code angefragt hat). Alle Spieltage eines Spielecodes werden diesem zugeordnet.</li>
          <li><b>Code-Anfrage per E-Mail:</b> Fragst du einen Spielecode an, erhält der Betreiber deine E-Mail-Adresse und den Inhalt deiner Nachricht. Diese werden nur zur Bearbeitung der Anfrage verwendet.</li>
          <li><b>Technische Zugriffsdaten:</b> Beim Aufruf der Website und bei Datenbankanfragen verarbeiten unsere Hosting-Dienstleister technisch notwendige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browser-Kennung (Server-Logfiles).</li>
        </ul>

        <H2>Zweck und Rechtsgrundlage</H2>
        <p>
          Die Daten werden ausschließlich verarbeitet, um die App bereitzustellen: Sessions anzulegen, beizutreten und Spielstände live auf allen Geräten der
          Mitspieler anzuzeigen. Rechtsgrundlage ist das berechtigte Interesse am Betrieb dieser von dir aktiv genutzten Funktion (Art. 6 Abs. 1 lit. f DSGVO)
          bzw. die Bereitstellung des von dir angefragten Dienstes (Art. 6 Abs. 1 lit. b DSGVO).
        </p>

        <H2>Speicherung im Browser</H2>
        <p>
          Die anonyme Anmeldung und dein zuletzt verwendeter Spielername werden im lokalen Speicher deines Browsers (Local Storage) abgelegt. Das ist für die
          Funktion technisch notwendig (§ 165 Abs. 3 TKG 2021). Es gibt keine Analyse-, Tracking- oder Werbe-Cookies. Schriftarten werden von dieser Website
          selbst ausgeliefert, nicht von Google.
        </p>

        <H2>Empfänger / Auftragsverarbeiter</H2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Vercel Inc.</b> (USA) – Hosting der Website. Vercel ist unter dem EU-US Data Privacy Framework zertifiziert.
          </li>
          <li>
            <b>Supabase Pte. Ltd.</b> (Singapur) – Datenbank, anonyme Anmeldung und Live-Updates. Die Datenbank liegt in der EU (Irland); soweit Supabase
            Daten in die USA oder nach Singapur übermittelt, geschieht das auf Grundlage der EU-Standardvertragsklauseln.
          </li>
        </ul>
        <p className="mt-2">Eine Weitergabe an sonstige Dritte findet nicht statt.</p>

        <H2>Speicherdauer</H2>
        <p>
          Spieldaten bleiben gespeichert, bis die Person, die die Session angelegt hat, sie löscht (Papierkorb auf der Startseite oder „Session für alle
          löschen“). Spielecodes bleiben bestehen, bis du um Löschung bittest oder der Betreiber sie löscht. Mitspieler können eine Session jederzeit aus ihrer Liste entfernen. Server-Logfiles werden von den Hosting-Anbietern nach deren
          Fristen automatisch gelöscht. Auf Anfrage löschen wir deine Daten auch manuell.
        </p>

        <H2>Deine Rechte</H2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich dafür an
          die oben genannte E-Mail-Adresse. Nenne uns bitte den Session-Code oder deinen Spielecode, damit wir die Daten zuordnen können.
          Außerdem kannst du dich bei der österreichischen Datenschutzbehörde beschweren (
          <a className="underline" href="https://www.dsb.gv.at" target="_blank" rel="noreferrer">dsb.gv.at</a>).
        </p>
      </main>
    </>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h1 className="font-display font-bold text-xl mt-6 mb-2 first:mt-0" style={{ color: "var(--color-ink)" }}>{children}</h1>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-semibold mt-4 mb-1">{children}</h2>;
}
