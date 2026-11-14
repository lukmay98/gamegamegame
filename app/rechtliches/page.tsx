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
          <li>
            Die Nutzung ist kostenlos. Man kann ohne Konto spielen („Ohne Login spielen“) oder mit einem Spielecode, den man per E-Mail beim Betreiber
            anfragt. Es besteht kein Anspruch auf Verfügbarkeit; Daten können jederzeit verloren gehen.
          </li>
          <li>Punkteberechnungen erfolgen ohne Gewähr – maßgeblich sind die Regeln eurer Runde.</li>
          <li>Bitte für Spieler- und Spieltag-Namen nur Vornamen oder Spitznamen verwenden und keine sensiblen Daten eintragen.</li>
          <li>
            Wer den Spieltag-Code oder QR-Code kennt, kann dem Spieltag beitreten und alle Einträge live sehen, aber nichts ändern. Eintragen kann nur das
            Gerät, das den Spieltag angelegt hat, bzw. wer mit dem zugehörigen Spielecode angemeldet ist. Gebt Codes nur an Mitspieler weiter.
          </li>
          <li>Spielecode und Passwort sind persönlich. Gib dein Passwort nicht weiter; der Betreiber fragt nie danach.</li>
        </ul>

        <H>Datenschutzerklärung</H>
        <p>Stand: {LEGAL_UPDATED}</p>

        <H2>Verantwortlicher</H2>
        <p>{OWNER.name}, {OWNER.city}, Österreich · <a className="underline" href={`mailto:${OWNER.email}`}>{OWNER.email}</a></p>

        <H2>Welche Daten verarbeitet werden</H2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Spieldaten:</b> Name des Spieltags, Spieltag-Code, Spielernamen, Sitzreihenfolge, Geber, Ansagen, Stiche, Treffer und Punkte sowie die
            Regeln jedes Spiels – also das, was ihr selbst eintragt.
          </li>
          <li>
            <b>Anonyme Geräte-Kennung:</b> Beim ersten Öffnen erhält dein Browser eine zufällige, anonyme Nutzer-ID (ohne E-Mail oder Namen). Damit wird
            gespeichert, welche Spieltage dieses Gerät angelegt hat oder ansieht, ob es dort eintragen darf oder nur zusieht, und ob es mit einem
            Spielecode angemeldet ist.
          </li>
          <li>
            <b>Spielecode (optional):</b> der Code, das Passwort – ausschließlich als nicht umkehrbarer Hash (bcrypt) gespeichert, niemand kann es
            einsehen –, Zeitpunkt von Anlage und letzter Anmeldung, Anzahl der Fehlversuche und eine eventuelle Sperre, die angemeldeten Geräte sowie
            eine interne Notiz des Betreibers zur Zuordnung (z. B. wer den Code angefragt hat). Alle mit dem Code angelegten Spieltage werden ihm
            zugeordnet.
          </li>
          <li>
            <b>Code-Anfrage per E-Mail:</b> Fragst du einen Spielecode an, erhält der Betreiber deine E-Mail-Adresse, deinen Namen (falls angegeben) und
            den Inhalt deiner Nachricht. Die Antwort mit Code und Startpasswort geht an diese Adresse.
          </li>
          <li>
            <b>Technische Zugriffsdaten:</b> Beim Aufruf der Website und bei Datenbankanfragen verarbeiten die Hosting-Dienstleister technisch notwendige
            Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browser-Kennung (Server-Logfiles).
          </li>
        </ul>

        <H2>Zweck und Rechtsgrundlage</H2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Bereitstellung der App (Spieltage anlegen, beitreten, Spielstände live anzeigen) und – bei Spielecodes – das Speichern deiner Spieltage und
            Vorlagen: Erfüllung des von dir angefragten Dienstes (Art. 6 Abs. 1 lit. b DSGVO).
          </li>
          <li>
            Schutz vor Missbrauch (Passwort-Hashes, Sperre nach Fehlversuchen, Server-Logfiles) und die interne Notiz zur Verwaltung der Codes:
            berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
          </li>
          <li>Bearbeitung deiner E-Mail-Anfrage: Art. 6 Abs. 1 lit. b DSGVO (Anbahnung der Nutzung) bzw. lit. f DSGVO.</li>
        </ul>

        <H2>Speicherung im Browser</H2>
        <p>
          Die anonyme Anmeldung und dein zuletzt verwendeter Spielername werden im lokalen Speicher deines Browsers (Local Storage) abgelegt. Das ist für
          die Funktion technisch notwendig (§ 165 Abs. 3 TKG 2021). Dein Spielecode-Passwort wird nicht im Browser gespeichert. Es gibt keine Analyse-,
          Tracking- oder Werbe-Cookies. Schriftarten werden von dieser Website selbst ausgeliefert, nicht von Google.
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
          <li>
            <b>Google (Gmail)</b> – E-Mails an die oben genannte Adresse werden über Gmail empfangen und beantwortet. Google ist unter dem EU-US Data
            Privacy Framework zertifiziert.
          </li>
        </ul>
        <p className="mt-2">Eine Weitergabe an sonstige Dritte findet nicht statt. Mitspieler sehen die Spieldaten der Spieltage, denen sie beitreten.</p>

        <H2>Speicherdauer</H2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Spieldaten bleiben gespeichert, bis sie gelöscht werden: über den Papierkorb auf der Startseite oder „Spieltag für alle löschen“ (durch das
            anlegende Gerät bzw. den Spielecode). Zuschauer können einen Spieltag jederzeit aus ihrer Liste entfernen.
          </li>
          <li>
            Spielecodes bleiben bestehen, bis du um Löschung bittest oder der Betreiber sie löscht. Wird ein Code gelöscht, werden Passwort-Hash, Notiz
            und Geräte-Zuordnung entfernt; die Spieltage bleiben nur noch auf den Geräten sichtbar, die sie angelegt haben, und können dort gelöscht
            werden – auf Wunsch löschen wir sie mit.
          </li>
          <li>Eine Abmeldung auf einem Gerät entfernt dessen Zuordnung zum Spielecode sofort.</li>
          <li>E-Mails zur Code-Anfrage werden gelöscht, wenn sie für die Verwaltung des Codes nicht mehr gebraucht werden.</li>
          <li>Server-Logfiles werden von den Hosting-Anbietern nach deren Fristen automatisch gelöscht.</li>
        </ul>

        <H2>Deine Rechte</H2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich dafür an
          die oben genannte E-Mail-Adresse und nenne uns den Spieltag-Code oder deinen Spielecode, damit wir die Daten zuordnen können. Außerdem kannst du
          dich bei der österreichischen Datenschutzbehörde beschweren (
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
