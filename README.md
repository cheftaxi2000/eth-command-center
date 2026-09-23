# ETH Study Command Center

Persönliche Studienübersicht für den Laptop-Browser und das iPad (installierbare PWA).
Beim Öffnen beantwortet sie **„Was muss ich gerade wissen?“** – nicht „Wo finde ich das?“.

- **Heute** – laufende/nächste Veranstaltung mit Countdown und Raum (Tipp → ETH-Raumplan), Fälliges der nächsten 7 Tage, To-dos pro Fach
- **To-dos pro Fach** – eintippen, Enter, fertig. Optional mit Frist („Heute“, „Morgen“, „Nächste Übung“, „Nächste Vorlesung“, Datum). Erledigt = grüner Haken, Papierkorb-Symbol an der Zeile löscht direkt (mit „Rückgängig“) – gilt auch für eigene Prüfungstermine.
- **Notizen** – eigene, freie Notizen (nicht aus Notion), optional einem Fach zugeordnet – Formeln, Ideen, Dinge zum Merken
- **Woche** – Stundenplan als klares Raster: ein Rechteck pro Termin, Fachfarbe fürs Fach, Schraffur + Label für Übung vs. Vorlesung; offene Abgaben/Serien stehen direkt an der passenden Übung; wischen oder ← → für andere Wochen
- **Kurse** – je Kurs: Links (Moodle, CodeExpert …), nächster Termin, To-dos, Abgaben & Prüfungen, Zeiten & Räume, Notion-Notizen, eigene Notizen
- **Eigene Links** – „+ Link“ bei *Ressourcen*, unter dem Kurstitel oder auf *Links & Admin* (Taste `R`): Adresse einfügen, fertig. `https://` und Name ergänzt die App selbst (Moodle, Aufzeichnungen, PDF-Name …); Stift daneben zum Ändern/Löschen; synchronisiert wie alles andere
- **Kursübungen** – die echten Serien, Bonusaufgaben, Quiz und Zwischenprüfungen des HS 26 pro Kurs, abhakbar (und „korrekt“/„bestanden“ separat), mit Termin, wo es einen gibt
- **Bonus & Leistung** (`B`) – eine Seite, die pro Fach beantwortet: Gibt es einen Bonus? Wie viel? Was genau zählt? Wie weit bin ich? – mit dem Wortlaut der Quelle und dem, was nicht öffentlich ist
- **Zähler** – die Zahl an „Aufgaben“ ist *alles* Offene mit Termin plus eigene To-dos ohne Termin und aktualisiert sich beim Abhaken sofort; „Notizen“ zählt analog
- **Suche** (Strg/⌘ K, `/` oder Tab „Suche“) über Kurse, To-dos, eigene Notizen, Termine & Räume, Abgaben, Notion-Notizen, Dozenten, Links – und „… als To-do speichern“
- **Assistent** – Vollbild-Chat (`C`), versteht Sätze wie „Mach mir eine Aufgabe für Analysis bis Freitag: Serie 2“ oder „Welche Bonusaufgaben habe ich noch?“, antwortet aus deinen echten Daten, **Mikrofon** zum Diktieren (siehe unten)
- **Lernzeit** – Fokus-Timer 25/50 min pro Fach (Kursseite, „Heute“, Taste `T` oder per Assistent), Wochenbilanz pro Fach auf „Heute“
- **Kalender-Export** – Stundenplan der nächsten 8 Wochen + alle offenen Abgaben als .ics, mit Erinnerungen am Vortag (Wochenplan → „In Kalender“)
- **Tastatur** – `H W A K Z L E` öffnen Heute/Woche/Aufgaben/Kurse/Notizen/Links/Einstellungen, `B` Bonus & Leistung, `1`–`6` die Kurse, `N` To-do, `M` Notiz, `R` Link, `P` Prüfung, `C` Assistent, `T` Lernblock, `S` synchronisieren, `?` zeigt alles
- **Sync** – läuft automatisch im Hintergrund über alle Browser und Geräte, ganz ohne Login oder Token (siehe unten)

## Übungen & Bonus im HS 26

Die offiziellen Übungen und Bonusregeln der fünf Kurse stehen in [`src/data/exercises.ts`](src/data/exercises.ts) –
read-only wie der Notion-Snapshot. Du hakst sie ab, die Definition selbst bleibt unverändert.

Jeder Kurs hat sein **eigenes** System, deshalb hat jeder Kurs seine eigenen Typen, Begriffe und Ziele:

| Fach | Was zählt | Maximum |
| --- | --- | --- |
| Analysis I | 9 von 12 Bonusaufgaben korrekt **und** rechtzeitig | 0.25 Notenpunkte |
| Lineare Algebra I | 5 Bonusaufgaben + Lernkontrolle, je 1 Punkt | min(0.25, 0.25·P/9) |
| Chemistry | 2 von 3 Quiz bestanden **und** 10 Serien abgegeben | 0.25 Notenpunkte |
| Informatik I | 3 Bonusübungen, vorher mit XP freischalten | 0.25 Notenpunkte |
| Mechanik I | kein Übungsbonus – 2 freiwillige Zwischenprüfungen zählen 30 %, wenn sie helfen | – |
| Engineering Design | kein Bonus – die 2 Quiz *sind* die Note (benotete Semesterleistung) | – |

**Es wird kein Termin erfunden.** In der App steht ein Datum nur, wenn eine Quelle es wörtlich nennt; sonst
steht dort, wo es zu finden ist (Moodle, Code Expert) – und die Bonusseite listet unter „Nicht verifiziert“
auf, was hinter einem Login liegt. Wortlaut, Quellen und Erhebungsdatum: [docs/EXERCISES-HS26.md](docs/EXERCISES-HS26.md).

Neue Termine trägst du nach, indem du sie in `src/data/exercises.ts` ergänzt (`dueAt` bzw. `weekOf`, plus
Quelle) – oder einfach als eigenes To-do erfasst.

## Notion bleibt unverändert (read-only)

- Die Notion-Daten liegen als lesend gezogener Snapshot in [`src/data/seed.ts`](src/data/seed.ts) (Stand 2026-09-19).
- Die App schreibt **nie** in Notion. Eine Content-Security-Policy erlaubt technisch nur Verbindungen
  zur App selbst und – für den Sync – zu `kvdb.io`. Anfragen an Notion werden vom Browser blockiert.
- Eigene Daten (To-dos, Notizen, Links, Prüfungen, Häkchen, Stundenplan-Wahl) liegen im Browser und werden automatisch
  über einen Sync-Code abgeglichen (siehe „Sync zwischen Laptop und iPad“).
- Nicht in Notion und deshalb **nicht erfunden**: Prüfungstermine, Credits, Noten, Vorlesungsthemen,
  deine Mechanik-Übungsgruppe (in der App einstellbar). Die Wochen der 2-wöchentlichen Analysis-Vorlesung
  sind als bestätigter Fakt hinterlegt (gerade Kalenderwochen) und in den Einstellungen änderbar.

## Veröffentlichen (einmalig)

1. **GitHub Desktop** → *File → Add local repository…* → diesen Ordner wählen → **Publish repository**
   (Häkchen „Keep this code private“ entfernen – GitHub Pages ist im Gratis-Konto nur für öffentliche Repos verfügbar;
   das Repo enthält nur, was dein Notion ohnehin öffentlich zeigt).
2. Auf github.com im Repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → „Deploy to GitHub Pages“ → Run workflow** (oder einfach den nächsten Push abwarten).
4. Die App läuft unter `https://<dein-benutzername>.github.io/eth-command-center/`.

Danach wird jede Änderung auf `main` automatisch gebaut, getestet und veröffentlicht.

## Installieren

- **iPad:** Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**. Startet ohne Browserleiste, funktioniert offline.
- **Windows:** in Edge/Chrome öffnen → Adressleiste → **App installieren** (oder einfach als Lesezeichen).
- Neue Versionen meldet die App mit „Neue Version verfügbar · Aktualisieren“.

## Sync über alle Browser und Geräte

Es gibt **eine** zentrale Datenquelle, und alle Ansichten (Heute, Woche, Aufgaben, Notizen, Zähler)
lesen aus ihr. Der Speicher im Browser ist nur ein Offline-Cache davon, nicht das Original:

```
Edge ─┐
Chrome┼─► kvdb.io/<Sync-Code>/studium  (Single Source of Truth)
iPad ─┘
```

Läuft ohne jede Einrichtung: Der **Sync-Code** ist fest in die App eingebaut, also benutzen alle Browser
und Geräte automatisch denselben Stand. Eine Notiz aus Edge ist in Chrome in ein paar Sekunden da – ohne
Neuladen (Abgleich alle 15 s, sofort bei jeder Änderung, beim Tab-Wechsel und sobald das Netz zurück ist;
weitere Tabs desselben Browsers erfahren es unmittelbar). Angelegtes, Geändertes und Gelöschtes wird pro
Eintrag zusammengeführt (last-writer-wins mit Löschmarken), nichts überschreibt blind etwas anderes.

**Der Preis dafür, ehrlich:** dieser Code steht im öffentlichen JavaScript der Seite. Wer die Adresse der
Seite kennt, könnte die Daten lesen oder ändern. Für Stundenplan, To-dos und Lernnotizen ist das in Ordnung
– **keine Passwörter oder sonst etwas Sensibles** in die Notizen. Wer das nicht will: **Einstellungen → Sync
→ „Eigenen Code erzeugen"**, dann gilt ein privater Code, der auf jedem weiteren Gerät einmal eingetragen
wird. Bestehende Daten werden dabei mitgenommen.

Offline erfasste Änderungen werden automatisch nachgeholt, sobald wieder eine Verbindung besteht.

## AI-Assistent

**Öffnen:** Taste `C`, „Assistent" in der Seitenleiste oder auf iPad/Handy der runde Funken-Knopf über dem „+".
Er übernimmt den ganzen Bildschirm, formatiert Antworten (Listen, fett, Code) und behält den Verlauf auf diesem
Gerät („Neuer Chat" leert ihn). Schreib z. B. „Mach mir eine Aufgabe für Analysis bis Freitag: Serie 2",
„Ich habe morgen zwei Stunden Zeit – was soll ich lernen?" (er kennt deine freien Lücken), „Starte 25 Minuten Analysis"
oder „Speichere den Link https://… für Analysis als Skript".

**Mikrofon:** Mikro-Knopf in der Eingabe → sprechen → der Text erscheint live im Feld, du prüfst und schickst ab.
Chrome, Edge und Safari erkennen die Sprache selbst (Schweizer Hochdeutsch, sonst Hochdeutsch). Wo der Browser das
nicht kann (z. B. Firefox), nimmt die App auf und lässt Gemini umschreiben – dafür braucht es den Schlüssel. Beim ersten
Mal fragt der Browser nach der Mikrofon-Erlaubnis.

**Gemini einschalten:** *Einstellungen → Assistent (Gemini)* → kostenlosen Schlüssel von
[Google AI Studio](https://aistudio.google.com/apikey) einfügen → Speichern (testet die Verbindung gleich mit).
Ohne Schlüssel läuft ein einfacher Regel-Modus, der Standardsätze versteht.

- Der Schlüssel liegt **nur im jeweiligen Browser**. Er wird nicht synchronisiert (der Sync-Speicher ist
  öffentlich lesbar), steht in keinem Backup und nirgends im Code, also einmal pro Gerät eintragen.
- Die App fragt Gemini direkt, ohne eigenen Server. Die CSP erlaubt dafür genau `generativelanguage.googleapis.com`.
- Gratis-Tarif: Google darf Eingaben zur Verbesserung seiner Dienste nutzen. Der Assistent sieht Aufgaben,
  Notizen und Stundenplan, also nichts Sensibles in Notizen.

So funktioniert es (`src/lib/ai/`):

```
Satz → AIService → Gemini → strukturierte Action → Validierung → Store → UI + Sync
```

- `context.ts`: `buildAIContext()` baut bei **jeder** Nachricht den aktuellen Stand neu (Fächer, Aufgaben,
  Notizen, Stundenplan); getrennt in *permanent* und *dynamisch*.
- `actions.ts`: die einzigen erlaubten Operationen (`create_task`, `delete_note`, …) mit Validierung;
  Löschen passiert nie ohne „Ja, löschen".
- `gemini.ts` / `key.ts`: Gemini-Anbindung und lokaler Schlüssel. Gemini-Modellnamen, die Google
  abschaltet, ersetzt die App selbständig durch ein aktuelles „flash"-Modell.
- `provider.ts`: anbieterunabhängige Schnittstelle. Ein anderer Anbieter = ein neuer Provider; optional
  auch ein eigener Server-Proxy über `VITE_AI_PROXY_URL`.
- `mock.ts`: der Regel-Modus, zugleich Grundlage der Tests in `ai.test.ts`.

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:5173  (Zeit simulieren: /?now=2026-09-21T11:00)
npm test           # Stundenplan, Fristen, Suche, Merge/Sync, Räume
npm run build      # Typecheck + Build + Service Worker + CSP
npm run preview    # Build lokal ansehen (http://localhost:4173)
npm run icons      # PWA-Icons neu erzeugen
```

## Aufbau

```
src/
  data/seed.ts        Notion-Snapshot (read-only Quelle)
  lib/state.ts        eigenes Datenmodell, Merge (last-writer-wins + Löschmarken), v1-Migration
  lib/store.ts        zentraler Zustand + Aktionen – die einzige Schreibstelle der App
  lib/sync.ts         automatischer Sync über kvdb.io (fest eingebauter Sync-Code, kein Token)
  lib/ai/             Assistent: Context, Actions, Gemini, lokaler Schlüssel, Regel-Modus, Chat-Verlauf
  lib/voice.ts        Diktieren (Web Speech API, sonst Aufnahme → WAV → Gemini)
  lib/markdown.ts     sicherer Markdown-Parser für Antworten (kein innerHTML)
  lib/links.ts        eigene Links: Adresse prüfen (nur http/s), Namen vorschlagen
  data/exercises.ts   offizielle Kursübungen + Bonusregeln HS 26 (read-only, mit Quellen)
  lib/exercises.ts    Übungen + eigener Fortschritt, Bonus-Ziele, Wochenfilter
  lib/timer.ts        Lern-Timer und Wochenbilanz
  lib/ics.ts          Kalender-Export mit Erinnerungen
  lib/schedule.ts     Termine je Tag/Woche, laufend/als Nächstes, Fach-Vorschlag
  lib/data.ts         Fristen & To-dos als eine Liste
  lib/search.ts       Suche, Fach-Erkennung für Schnellerfassung
  lib/rooms.ts        ETH-Raumcode → offizieller Raumplan
  components/, pages/ Oberfläche
.github/workflows/    Deployment auf GitHub Pages
```

Analyse und Entscheidungen: [docs/ANALYSIS.md](docs/ANALYSIS.md)
