# Analyse & Entscheidungen (Stand 2026-09-19)

## A — Notion-Analyse
Workspace „UNI“ (read-only gelesen): Startseite mit Launchpad-Ankern, Kurs-Galerie, geteiltem `Todos`-Block,
verlinkter Tasks-Datenbank (5 Ansichten) und Notes-Datenbank.

| Datenbank | Felder | Inhalt |
|---|---|---|
| Courses | Instructor, Course Code, Semester, Credits, Course Description, Cover-Farbe, Icon | 6 Kurse + Pseudo-Kurs „Admin“; Credits/Beschreibung **leer** |
| Tasks | Course, Name, Date, Category, Status, Type, Session Type, Lecture Number | 4 Aufgaben, alle „Individual“ / „Task“ |
| Notes | Course, Session Type, Lecture Number, Seiteninhalt | 1 Notiz (C++ Basics), 1 Link-Notiz (Admin) |

Stundenplan (Zeiten, Räume, Haupt-/Nebenräume) steht als **Freitext** auf jeder Kursseite. Links: CodeExpert,
Kurswebsite, Videoportal (nur Informatik), Moodle (2 Kurse), MAVT-Curriculum/Administratives.
Nicht vorhanden: Prüfungen, Gewichtungen, Credits, Themen, Folien/PDFs.

## B — Was bleibt
Kurs-Identität (Icon, Farbe, Code), Trennung Kurse/Aufgaben/Notizen, Task-Felder, Notiz-Inhalt, alle Links.

## C — UX-Probleme
Kein „Was steht heute/diese Woche an?“ · Stundenplan nur als Text · flache Aufgabentabelle ohne Zeitbezug ·
eingebettete Datenbanken laden verzögert („Loading…“, langsam auf iPad) · gemischte Sprache.

## D — Entfernt / zurückgestellt
`todo1/todo2`-Platzhalter, `// infos // links`-Reste, 5 Task-Ansichten pro Seite (→ Filter), Task-Kategorie
„Individual“ (in jeder Zeile identisch), leere Felder (Credits, Beschreibung). Nebenräume → Accordion.
Nichts davon ist verloren: es steckt weiter im Snapshot.

## E — Neu (nur wenn ableitbar)
Heute-/Wochenansicht, Deadline-Countdown, globale Suche, Offline, Prüfungs-Eintrag (manuell, App-eigen).
Später: Prüfungs-Countdown, Lernfortschritt, iCal-Export, Geräte-Sync, Credits/Noten.

## F — Informationsarchitektur
Heute · Woche · Aufgaben · Kurse → Kursseite → Notiz · Links & Admin · Einstellungen · Suche (überall).

## G — Dashboard
Heute (groß) → Fällig (rechts) → Wochenleiste → Kurse (kompakt) → Schnellzugriff. Am Wochenende zeigt
die Leiste die nächste Woche und „Heute“ verweist auf den nächsten Termin.

## H — Kursseite
Header (Code, Name, Dozent, Semester) → Aktuell (nächster Termin, nächste Deadline, offene Aufgaben) →
Zeiten & Räume (+ Parität/Gruppenwahl, Nebenräume im Accordion) → Aufgaben → Prüfung & Bewertung →
Ressourcen (Links, Notizen) → Details.

## I — Navigation
≥ 1200 px: Sidebar · 900–1199 px (iPad quer): Icon-Rail · < 900 px (iPad hoch, Handy): Tab-Leiste.
Suche: Strg/⌘+K oder Tab „Suche“. Wochenplan wird auf dem Handy (< 640 px) zur Tages-Agenda.

## J — Plattform: PWA
Passt genau: iPad-Home-Screen + Standalone, Offline per Service Worker, ein Code für Windows-Browser und iPad,
kein Mac/Developer-Account nötig. Verifiziert in Chrome: Service Worker aktiv, App-Hülle vorab gecacht,
keine Manifest-/Installierbarkeitsfehler, Neuladen und Deep-Link offline funktionieren.
Voraussetzung: HTTPS-Hosting. **Auf einem echten iPad noch nicht getestet.**

## K — Designsystem
Ruhige, warmgraue Fläche, ein Akzent (gedecktes Blau), Kursfarbe nur als kleine Markierung.
Inter (variabel, selbst gehostet → offline) + JetBrains Mono für Code. 4/8-px-Raster, Touch-Ziele ≥ 44 px,
Listenzeilen statt Karten, Dark Mode (System/Hell/Dunkel), keine Hover-only-Funktionen, Safe-Area-Insets.

## L — Prioritäten
- **MUST (umgesetzt):** Snapshot, Dashboard, Wochenplan, Aufgaben/Deadlines, Kursseiten, Suche, PWA + iPad-Layout.
- **SHOULD (umgesetzt):** lokales Abhaken, eigene Aufgaben/Prüfungen, Notizen mit Code, Offline, Dark Mode,
  Wochen-Parität und Übungsgruppe.
- **NICE (offen):** Prüfungs-Countdown, Lernfortschritt, iCal-Export, Sync, Credits/Noten, automatischer
  (read-only) Notion-Sync, Konflikterkennung im Stundenplan.

## Offene Punkte
- Welche Wochen (gerade/ungerade KW) hat die 2-wöchentliche Analysis-Vorlesung? → in App wählbar.
- Welche Mechanik-Übungsgruppe besuchst du? → in App wählbar.
- Hosting fürs iPad (siehe README).
