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

## v6 – Assistent als Chatbot, Mikrofon, drei neue Funktionen (2026-09-21)
- **„Antworten sehen hässlich aus“:** Gemini antwortet in Markdown, das Fenster zeigte `**…**` und `*`-Listen roh.
  Eigener kleiner Parser (`lib/markdown.ts`) → React-Elemente, nie `innerHTML`; Tests prüfen u. a., dass HTML Text
  bleibt und nur http(s)-Links klickbar werden.
- **Vollbild wie ein normaler Chatbot:** eigene Kopfzeile, Antworten ohne Blase mit Avatar, eigene Nachrichten als
  Blase, Vorschlagskarten, Kopieren, Eingabe-Pille, Verlauf lokal (nicht synchronisiert – der Sync-Speicher ist
  öffentlich). Die Karte „Neue Aufgabe …“ füllt nur das Feld, damit ein Fehltipp nichts anlegt.
- **Mikrofon** (Entscheidung Nutzer: Text ins Feld, selbst senden): Web Speech API mit Live-Text, `de-CH` mit
  Rückfall `de-DE`; ohne Web Speech Aufnahme → 16-kHz-WAV → Gemini-Transkription. Mit simulierter Spracherkennung
  getestet (Live-Text, Endtext, Stopp); mit echtem Mikrofon nicht testbar in der Automatisierung.
- **Freie Zeitfenster** (`freeSlots`): Lücken ≥ 45 min zwischen 08 und 18 Uhr, heute erst ab jetzt; gehen in den
  AI-Kontext, damit „Ich habe zwei Stunden – was soll ich lernen?“ echte Lücken und Fristen nutzt.
- **Kalender-Export (.ics):** 8 Wochen Stundenplan (mit Parität und Übungsgruppe) + offene Abgaben/Prüfungen,
  UTC-Zeiten, Faltung nach Bytes, stabile UIDs, Erinnerungen am Vortag (Prüfungen auch 7 Tage vorher) – echte
  Benachrichtigungen über den Kalender des Geräts, ganz ohne Server.
- **Lern-Timer:** 25/50 min pro Fach, laufender Timer nur lokal, fertige Blöcke als neuer synchronisierter Typ
  `study` (Merge + Löschmarken wie der Rest), unter 5 min wird nicht gezählt; Wochenbilanz auf „Heute“, Countdown im
  Tab-Titel, Ton am Ende; auch per Assistent und Taste `T`.
- **Nebenbei behoben:** Auf der Kursseite lief ein Hook erst nach einem frühen `return` – Wechsel von einem
  unbekannten zu einem echten Kurs hätte die Hook-Reihenfolge gebrochen.

## v7 – Eigene Links, Assistent kennt das Datum (2026-09-22)
- **„Ich kann bei Ressourcen keine Links hinzufügen“:** Links kamen nur aus dem Notion-Snapshot. Neu ist der
  synchronisierte Typ `links` (Merge + Löschmarken wie To-dos und Notizen). „+ Link“ bei *Ressourcen*, als
  gestrichelte Taste unter dem Kurstitel und auf *Links & Admin*; Taste `R`; Stift neben jedem eigenen Link zum
  Ändern oder Löschen (mit „Rückgängig“). Notion-Links bleiben unverändert.
- **Einfach einfügen:** Adresse ohne `https://` wird ergänzt; ohne Namen benennt die App den Link selbst (Moodle,
  Aufzeichnungen, CodeExpert, PDF nach Dateiname …); „Skript https://…“ in einem Rutsch eingefügt wird in Name und
  Adresse getrennt (nur beim Einfügen, nie beim Tippen). Dieselbe Adresse zweimal im selben Fach wird abgelehnt.
- **Sicherheit:** Nur http(s) wird gespeichert und als Link angezeigt – beim Eingeben *und* beim Lesen synchronisierter
  Daten. Der geteilte Sync-Speicher ist öffentlich beschreibbar; ohne diese Prüfung könnte jemand dort eine
  `javascript:`-Adresse ablegen, die beim Antippen Code in der App ausführt.
- **Überall eingebunden:** Suche (eigene Links + Aktion „Link hinzufügen“), Backup, „Alles löschen“, AI-Kontext
  (alle Links mit Adresse, damit der Assistent sie als klickbaren Link nennt) und neue Aktionen `create_link`,
  `update_link`, `delete_link` (nur mit Bestätigung), `get_links`; der Regel-Modus versteht „Speichere den Link …
  für Analysis als Skript“.
- **Kurse ohne Links** werden auf *Links & Admin* mit einem „+“-Knopf angeboten.
- **Assistent kannte das Datum nicht** („Um dir zu sagen, was du morgen hast, benötige ich das heutige Datum“):
  Die App schickte mehrere Systemnachrichten; Geminis OpenAI-kompatible Schnittstelle beachtet offenbar nur eine.
  Jetzt genau eine, die mit „Heute ist …, Morgen ist …“ beginnt; Nachschlage-Werkzeuge für Daten, die ohnehin im
  Kontext stehen, bekommt das Modell nicht mehr.
- Geprüft: 77 Tests; im Browser Anlegen, falsche Adresse, Doppelte, Einfügen mit Namen, Bearbeiten, Löschen +
  Rückgängig, Taste `R`, Suche, Handy-Breite ohne seitliches Scrollen, und ein zweites Gerät, das einen neuen Link
  nach ~13 s ohne Neuladen zeigt – alles gegen einen Wegwerf-Sync-Speicher, nie gegen die echten Daten.
- Hinweis: Eine noch nicht aktualisierte App-Version kennt `links` nicht und lässt sie beim Hochladen weg; ein
  aktualisiertes Gerät lädt sie beim nächsten Abgleich wieder hoch. Also auf allen Geräten „Aktualisieren“ tippen.

## v8 – Kursübungen und Bonus aus den echten HS26-Quellen (2026-09-23)
- **Recherche zuerst:** VVZ-Einträge aller sechs Lerneinheiten, die öffentliche Kursseite von Informatik I und
  die (einzige vollständig öffentliche) Kursseite von Lineare Algebra I. Moodle und Code Expert verlangen ein
  Login und waren nicht lesbar – das steht so in der App, statt es zu raten. Wortlaut und Quellen:
  [EXERCISES-HS26.md](EXERCISES-HS26.md).
- **Fünf Kurse, fünf Systeme.** Genau deshalb gibt es kein gemeinsames „Bonus“-Schema, sondern pro Kurs eigene
  Typen mit den Begriffen des Kurses (Bonusaufgabe, Lernkontrolle, Quiz, Freiwillige Zwischenprüfung) und
  eigene, messbare Ziele. Das kursübergreifende `role`-Feld dient nur den Filtern.
- **Datenmodell:** `data/exercises.ts` (read-only wie der Notion-Snapshot, mit `sources`, `unverified`,
  `dateNote`) + `SyncedState.exercises` für den Fortschritt (abgehakt, korrekt/bestanden, Zähler). Merge,
  Löschmarken und Sync wie bei allem anderen; alte Installationen bekommen einfach ein leeres Objekt.
- **Termine:** `dueAt` nur, wenn eine Quelle es wörtlich nennt; `weekOf`, wenn der Kurs nur eine Woche nennt
  (Engineering-Design-Quiz) – dafür gibt es im Wochenplan einen eigenen Streifen statt eines erfundenen Tags.
  Ohne Termin steht `dateNote` („Termin steht in Code Expert“) und der Eintrag zählt **nicht** in die
  Aufgaben-Zahl: „Bonusaufgabe 7“ ist Struktur, keine Arbeit für heute.
- **UI:** Kursseite zeigt die Übungen in den Gruppen des Kurses plus eine kompakte Bonuskarte; neue Seite
  `/bonus` (Taste `B`) beantwortet „Wie komme ich zum Bonus?“ pro Fach mit Fortschritt, Zitat, Quellen und
  „Nicht verifiziert“; Aufgabenseite filtert zusätzlich nach Art; Wochenplan bekommt „Übungen anzeigen“
  (Mehrfachauswahl, in den synchronisierten Einstellungen gespeichert – ein Filter, der nie Daten ändert).
- **Assistent:** Kontext enthält Übungen (Typ, Rolle, Termin, Status, Bonusrelevanz) und pro Fach die Regel mit
  Fortschritt und den offenen Punkten; neue Aktionen `get_exercises`, `get_bonus`, `complete_exercise`,
  `set_exercise_counter`, `set_week_exercise_filter` – alles über dieselbe Validierungsschicht wie bisher.
- Geprüft: 94 Tests (Konfiguration konsistent, Fortschritt je Kurssystem, Filter, Migration, Sync, Suche,
  AI-Kontext und -Aktionen); im Browser Kursseite, Bonusseite, Aufgaben, Wochenplan inkl. Quizwoche vom
  09.11., Handy-Breite ohne seitliches Scrollen und ein zweites Gerät, das den Fortschritt übernimmt.
- Nebenbefund: Die Informatik-Kursseite nennt HG E 7 als Vorlesungsraum (Übertragung HG E 5 / E 3), Notion
  sagt HG E3. Der Stundenplan bleibt wie in Notion – aber es ist einen Blick wert.

## v9 – Bonus/Quiz farblich hervorgehoben, eigene Links an Übungen, To-dos direkt löschbar (2026-09-23)
- **Feedback:** „nur relevant sind die Quizes / Bonusaufgaben in rot" – Rollen, die die Note bewegen (Bonus,
  Quiz, Zwischenprüfung: `isKeyRole()` in `lib/exercises.ts`), stechen jetzt konsequent rot heraus: Chip,
  linker Rand der Zeile, Wochenplan-Zeile und -Block, der Filter-Knopf selbst. Serien und Organisatorisches
  bleiben bewusst neutral. Auf der Kursseite stehen die roten Gruppen zuerst.
- **„Ich muss einen Link hinzufügen können, wenn ich möchte":** jede offizielle Übung bekommt ein eigenes
  Link-Symbol (`LinkSheet` im neuen Modus `'exercise'`) – dieselbe Adressprüfung wie bei den Ressourcen-Links
  (nur http/s), aber ohne eigenen Namen: der Übungstitel steht schon fest. Eigener Link ersetzt den
  Kurs-Link nur in der Anzeige; die offizielle Definition bleibt unverändert. Gespeichert in
  `SyncedState.exercises[id].url`, synchronisiert wie der Rest.
- **„Ich soll die To-dos löschen können":** Papierkorb-Symbol direkt an der Zeile (eigene To-dos und eigene
  Prüfungen), kein Umweg mehr über das Bearbeiten-Sheet nötig – mit Toast und „Rückgängig". Nutzt dieselben
  `deleteTodo`/`deleteExam`-Aktionen wie bisher, also keine neue Lösch-Logik.
- **Nachtrag „ich will alles löschen können":** Auf der echten Seite hatte der Nutzer noch keine eigenen
  To-dos – nur Notion-Aufgaben und Kursübungen, die absichtlich keinen Papierkorb hatten. Statt dessen jetzt:
  jede Zeile bekommt den Papierkorb, bei Notion/Kursübungen **blendet** er aus statt zu löschen (neuer
  synchronisierter Typ `SyncedState.hidden`, gemerged wie `taskDone` – neuere Schreibung gewinnt, nie ein
  Tombstone). Die Quelle (`seed.ts`, `data/exercises.ts`) bleibt unangetastet; `buildItems()` ist die einzige
  Stelle, die Ausgeblendetes herausfiltert, also gilt es überall gleich (Aufgaben, Woche, Kursseite, Suche,
  AI-Kontext). Toast mit „Rückgängig", zusätzlich eine dauerhafte Liste unter Einstellungen → „Ausgeblendet"
  zum Zurückholen. Die AI-Aktion `delete_task` blendet jetzt ebenfalls aus statt mit „kann ich nicht löschen"
  zu scheitern (die Rückfrage sagt ehrlich „ausblenden" statt „löschen"); neue Aktion `unhide_item`.
- Geprüft: 100 Tests; im Browser hidden/unhidden Rundlauf (Zähler, Einstellungen-Liste, Handy-Breite ohne
  Überlauf) und dass ein eigenes To-do weiterhin wirklich gelöscht wird (nicht nur ausgeblendet) – alles
  gegen den Wegwerf-Speicher.

## Offene Punkte
- Auf einem echten iPad noch nicht getestet (nur Chrome/Puppeteer + Browser-Vorschau).
- Übungstermine hinter dem Login (Moodle, Code Expert) fehlen. Mit einem angemeldeten Browser liessen sie sich
  einmalig auslesen und in `data/exercises.ts` ergänzen; automatisch geht es nur mit einem Server, der die
  Sitzung hält – das wäre ein eigener Schritt.
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
  Der Gesprächsverlauf bleibt bewusst auf dem jeweiligen Gerät (nicht synchronisiert).
