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

## v2 – Feedback umgesetzt (2026-09-19)
- **Zugriff Laptop + iPad:** GitHub Pages (Deployment per GitHub Actions), installierbar auf iPad und Windows.
- **Sync:** eigene Daten über eine Datei in einem *privaten* GitHub-Repo; Merge pro Eintrag (last-writer-wins,
  Löschmarken), offline-fähig, öffentliche Repos werden abgelehnt. CSP erlaubt nur `api.github.com`.
- **Startseite entschlackt:** Wochenleiste und Schnellzugriff entfernt (Links jetzt als Buttons auf der Kursseite,
  alles weiterhin unter „Links & Admin“). Neu: laufende/nächste Veranstaltung mit Countdown.
- **To-dos pro Fach** (+ „Allgemein“): Eingabezeile mit Fach-Vorschlag (laufende/gerade beendete Vorlesung),
  Fristen inkl. „Nächste Übung/Vorlesung“, Abhaken/Löschen mit Rückgängig, Suche + Schnellerfassung.
- **Schneller wechseln:** Kurs-Chips (iPad), Wischen zwischen Kursen und Wochen, Tastenkürzel, Plus-Knopf.
- **Lesbarkeit:** größere Schrift auf Touch (17 px), Kontrast ≥ 4.5:1, Überschriften in Normalschrift statt Kapitälchen,
  ruhigere Listen (Notion-Kategorie „Individual“ ausgeblendet), Räume als Tipp-Ziele zum ETH-Raumplan.
- **Fehler behoben:** u. a. Wochenansicht am Wochenende, iPad-quer ohne Kursliste, Sheets unter der Tastatur,
  „Strg K“-Hinweis auf dem iPad, Kontrast der Sekundärtexte, Automatik-Update konnte Eingaben verwerfen.

## v3 – Feedback umgesetzt (2026-09-20)
- **Sync ohne Token:** GitHub-PAT-Sync komplett ersetzt durch einen automatischen „Sync-Code“ über
  [kvdb.io](https://kvdb.io) (anonymer, kostenloser Key-Value-Speicher, kein Login). Beim ersten Start wird
  sofort ein Code erzeugt und synchronisiert im Hintergrund; ein zweites Gerät koppelt sich, indem derselbe
  Code einmal eingegeben wird – bestehende Daten beider Geräte werden zusammengeführt. Bestätigt per
  End-to-End-Test mit zwei isolierten Browser-Profilen (echtes Chrome, Produktions-Build): Laptop legt To-do an,
  iPad koppelt sich, sieht sofort beide Einträge, Laptop sieht nach dem nächsten Sync auch das iPad-To-do.
  CSP erlaubt jetzt `kvdb.io` statt `api.github.com`.
  *Bekannte Grenze:* kvdb verlangt bei Bucket-Erstellung eine E-Mail-Adresse und sperrt Schreibzugriffe für
  Adressen, die es als Wegwerf-Adressen einstuft; die RFC-2606-Platzhalteradresse „test@example.com“ blieb in
  ausführlichen Tests durchgehend nutzbar – dokumentiertes, aber nicht vertraglich zugesichertes Verhalten
  eines kostenlosen Drittanbieters.
- **Wochenplan:** Kursfarben klarer unterscheidbar (Informatik I: Türkis statt Amber, das zu nah an
  Eng.-Design-Orange lag), kräftigere Füllfarben. Offene Serie/Abgabe steht jetzt direkt am zugehörigen
  Übungsblock (nicht nur im Tages-Kopf), auch wenn die Frist an einem anderen Wochentag liegt.
- **Analysis-Vorlesung „diese Woche nicht, erst nächste“:** Standardwert der 2-wöchentlichen Parität von
  „offen“ auf „gerade Kalenderwochen“ gesetzt (bestätigter Fakt, kein Rätselraten mehr) – weiterhin in den
  Einstellungen änderbar.
- **Erledigt-Haken:** grün gefüllter Kreis mit weißem Haken statt Blau; ein gerade abgehakter Eintrag bleibt
  ~0,9 s sichtbar (mit Aufleucht-Effekt), bevor er ins eingeklappte „Erledigt“-Bündel wandert – vorher
  verschwand er ohne sichtbares Feedback.
- **Neue Rubrik „Notizen":** eigene, freie Notizen (Titel + Text), optional einem Fach zugeordnet, über den
  Sync-Code mitsynchronisiert, durchsuchbar, auch auf der jeweiligen Kursseite sichtbar.

## Offene Punkte
- Auf einem echten iPad noch nicht getestet (nur Chrome/Puppeteer + Browser-Vorschau).
- Neue Einträge in Notion (z. B. „Serie 2“) erscheinen erst nach einem Snapshot-Update. Nächster sinnvoller Schritt:
  automatischer, strikt lesender Abgleich per Notion-API (Integration nur mit „Read content“) in der GitHub Action.
- kvdb.io ist ein kleiner kostenloser Drittanbieter ohne SLA; sollte er dauerhaft ausfallen, bräuchte die App
  einen alternativen Sync-Transport (die Merge-Logik selbst ist transport-unabhängig, siehe `lib/state.ts`).
