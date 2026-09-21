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

## v4 – Feedback umgesetzt (2026-09-21)

**Sync über Browsergrenzen (der eigentliche Fehler).** Gemeldet: „Notiz in Edge angelegt, in Chrome nicht
da." Ursache: `initSync()` erzeugte beim ersten Start *pro Install* einen eigenen kvdb-Bucket. Edge und
Chrome legten also je einen eigenen Datenspeicher an, die sich nie trafen – die gekoppelten Geräte aus v3
funktionierten, ein zweiter Browser nie. Behoben durch einen **fest eingebauten, geteilten Sync-Code**
(`SHARED_BUCKET`, über `VITE_SYNC_BUCKET` überschreibbar): jeder Install landet ohne Zutun im selben
Speicher. Zusätzlich: Abgleich alle 15 s statt 2 min, sofort bei `focus`/`online`/Tab-Wechsel,
`BroadcastChannel` + `storage`-Event für andere Tabs desselben Browsers. Bestätigt per End-to-End-Test mit
zwei isolierten Browser-Kontexten gegen den Produktions-Build: Notiz aus „Edge" erscheint nach ~6 s in
„Chrome", To-do umgekehrt nach ~8 s, Löschung nach ~8 s – **ohne Neuladen**, nur In-App-Routenwechsel.
*Bewusster Kompromiss:* der Code steckt im öffentlichen Bundle, ist also für jeden lesbar, der die
Seiten-URL kennt. Vom Nutzer so entschieden, im UI und im README offen benannt; „Eigenen Code erzeugen"
bleibt als privater Ausweg. Alte, pro Browser erzeugte Buckets werden beim ersten Start einmalig
ausgelesen und eingemischt (`migrateLegacy`), damit nichts verloren geht.

**Zähler.** Das Badge an „Aufgaben" zählte `dueWithin(…, 7)` – also nur datierte Einträge der nächsten
7 Tage. Bei 4 offenen Aufgaben stand deshalb 3 da (die vierte war 8 Tage entfernt). Jetzt: alle offenen
Einträge, direkt aus `useItems()` abgeleitet, damit Abhaken im selben Render durchschlägt. Notizen haben
denselben Mechanismus (ruhigeres Badge, da keine Bringschuld). Kopfzeilen sagen es zusätzlich im Klartext.

**Aufgaben-Kacheln.** `.filters` war ein Scroll-Streifen; die letzte Kachel war abgeschnitten. Ab
Container-Breite 460 px bricht die Reihe jetzt um (`flex-wrap`), Kacheln behalten ihre volle Beschriftung.
Unter 460 px bleibt der Streifen, weil Umbruch dort den halben Bildschirm fressen würde.

**Wochenplan.** Blöcke sind jetzt schlichte Rechtecke: keine Radien, keine dicke linke Kante, `left/right: 0`
und volle Slot-Höhe – ein Raster statt schwebender Karten. Vorlesung/Übung unterscheiden sich **nicht** mehr
über die Farbe, sondern über ein Kapitälchen-Label („VORLESUNG"/„ÜBUNG") und eine feine Diagonalschraffur
bei Übungen; die Fachfarbe bleibt dem Fach vorbehalten.

**Farben.** Alle sechs aus einer Rampe auf derselben Stufe (600er-Niveau), damit sie als Familie wirken:
Mechanik Blau `#2563eb`, Analysis Rot `#d92d20`, Chemie Grün `#16a34a`, Informatik Gelb `#ca8a04`,
Eng. Design Violett `#7c3aed` (die Kontrastfarbe), Lin. Algebra dunkles Schiefergrau `#475569`.

**„Übungsgruppe festlegen".** Die Aufforderung erschien, weil `prefs.choices` leer war. Vom Nutzer erfragt
(Do 08:15, LEE D 105) und als `DEFAULT_CHOICES` hinterlegt – auch für bereits gespeicherte Daten
(`normalizeSynced` füllt fehlende Defaults auf, eine abweichende Wahl gewinnt weiterhin). `GroupChoice`
kann eine Auswahl nicht mehr abwählen; genau das hatte den Hinweis zurückgebracht.

**Tastenkürzel.** Erweitert statt parallel gebaut: `Z` Notizen, `M` neue Notiz, `P` neue Prüfung,
`S` synchronisieren; Sheet gruppiert nach Öffnen/Erfassen/Sonst. Alles blanke Buchstaben – Browser und OS
belegen nur Kombinationen mit Modifier, daher keine Konflikte. Für „Aufgabe abhaken" bewusst *kein* Kürzel:
die Kästchen sind Buttons, Tab + Leertaste tut es schon; ein globales Kürzel bräuchte ein Fokus-Konzept.

**AI-Vorbereitung (`src/lib/ai/`).** Context-Projektion, validierte Action-Schicht, anbieterunabhängige
Provider-Schnittstelle und ein regelbasierter Mock; 17 Tests. Kein zweites Datenmodell: gelesen wird aus
`lib/store.ts`, geschrieben ausschliesslich über dieselben `actions.*`, die auch die Oberfläche benutzt.
*Bewusst nicht gebaut:* Schreiben in den Stundenplan. Vorlesungen und Übungen kommen aus dem read-only
Notion-Snapshot; für frei gesetzte Termine bräuchte es einen eigenen `events`-Typ im Datenmodell. Bis dahin
bilden datierte To-dos und `create_exam` das ab, und `constraints` im Context sagt es dem Modell explizit.

## v5 – Assistent angeschlossen (2026-09-21)
- **Gemini direkt aus dem Browser, ohne Server:** Der Nutzer wollte keinen Cloudflare-Worker. Google erlaubt
  CORS für diese Seite (per Preflight geprüft), also ruft die App Gemini direkt auf. Der Schlüssel wird in den
  Einstellungen einmal pro Browser eingetragen und liegt nur in dessen localStorage (`lib/ai/key.ts`), bewusst
  getrennt vom synchronisierten Zustand, weil der Sync-Speicher öffentlich lesbar ist. Fest in den Code war
  keine Option: Das Bundle ist öffentlich.
- **Chatfenster** (`AssistantSheet`): `C`, Seitenleiste, iPad unter *Kurse → Mehr*. Zeigt, was tatsächlich
  geändert wurde, und fragt vor jedem Löschen. Ohne Schlüssel antwortet der Regel-Modus.
- **Zweite Runde für Fragen:** Ruft das Modell nur `get_…` auf und sagt nichts, bekommt es die Ergebnisse
  einmal zurück, ohne Werkzeuge, und kann damit nur antworten, nicht erneut handeln.
- **Gefundener Fehler:** Die Bestätigung eines Löschens lief in einem React-State-Updater; StrictMode ruft den
  doppelt auf → gelöscht wurde einmal, aber eine falsche Fehlermeldung erschien. Aktion läuft jetzt außerhalb.
- Geprüft: 47 Tests (u. a. Gemini-Anfrage mit simuliertem Google-Server, Modellwechsel bei abgeschaltetem
  Modell, 400/429 verständlich gemeldet); im Browser Anlegen, Löschen mit Bestätigung, Zähler live; ein
  absichtlich falscher Schlüssel gegen den echten Google-Endpunkt → „Gemini lehnt den Schlüssel ab".
  Mit einem gültigen Schlüssel konnte ich nicht testen, der liegt nur beim Nutzer.

## Offene Punkte
- Auf einem echten iPad noch nicht getestet (nur Chrome/Puppeteer + Browser-Vorschau).
- Neue Einträge in Notion (z. B. „Serie 2“) erscheinen erst nach einem Snapshot-Update. Nächster sinnvoller Schritt:
  automatischer, strikt lesender Abgleich per Notion-API (Integration nur mit „Read content“) in der GitHub Action.
- kvdb.io ist ein kleiner kostenloser Drittanbieter ohne SLA; sollte er dauerhaft ausfallen, bräuchte die App
  einen alternativen Sync-Transport (die Merge-Logik selbst ist transport-unabhängig, siehe `lib/state.ts`).
  (Beim Aufräumen von Testdaten fiel auf, dass gelöschte Werte „zurückkamen" – Ursache war kein kvdb-Problem,
  sondern ein noch offener Tab, der seinen Stand brav wieder hochlud. Also korrektes Verhalten.)
- Der geteilte Sync-Code ist öffentlich lesbar (siehe v4). Echter Schutz bräuchte entweder ein Backend mit
  Login oder clientseitige Verschlüsselung mit einer Passphrase pro Gerät – beides widerspricht dem
  ausdrücklichen Wunsch „ohne jegliche Tokens oder sonst etwas".
- AI: Stundenplan-Schreibzugriff fehlt mangels eigenem `events`-Typ (einmalige Termine → datierte To-dos).
  Gesprächsverlauf lebt nur, solange die App offen ist.
