# ETH Study Command Center

Persönliche Studienübersicht für den Laptop-Browser und das iPad (installierbare PWA).
Beim Öffnen beantwortet sie **„Was muss ich gerade wissen?“** – nicht „Wo finde ich das?“.

- **Heute** – laufende/nächste Veranstaltung mit Countdown und Raum (Tipp → ETH-Raumplan), Fälliges der nächsten 7 Tage, To-dos pro Fach
- **To-dos pro Fach** – eintippen, Enter, fertig. Optional mit Frist („Heute“, „Morgen“, „Nächste Übung“, „Nächste Vorlesung“, Datum). Erledigt = grüner Haken.
- **Notizen** – eigene, freie Notizen (nicht aus Notion), optional einem Fach zugeordnet – Formeln, Ideen, Dinge zum Merken
- **Woche** – Stundenplan als klares Raster: ein Rechteck pro Termin, Fachfarbe fürs Fach, Schraffur + Label für Übung vs. Vorlesung; offene Abgaben/Serien stehen direkt an der passenden Übung; wischen oder ← → für andere Wochen
- **Kurse** – je Kurs: Links (Moodle, CodeExpert …), nächster Termin, To-dos, Abgaben & Prüfungen, Zeiten & Räume, Notion-Notizen, eigene Notizen
- **Zähler** – die Zahl an „Aufgaben“ ist *alles* Offene (nicht nur die nächsten 7 Tage) und aktualisiert sich beim Abhaken sofort; „Notizen“ zählt analog
- **Suche** (Strg/⌘ K, `/` oder Tab „Suche“) über Kurse, To-dos, eigene Notizen, Termine & Räume, Abgaben, Notion-Notizen, Dozenten, Links – und „… als To-do speichern“
- **Tastatur** – `H W A K Z L E` öffnen Heute/Woche/Aufgaben/Kurse/Notizen/Links/Einstellungen, `1`–`6` die Kurse, `N` To-do, `M` Notiz, `P` Prüfung, `S` synchronisieren, `?` zeigt alles
- **Sync** – läuft automatisch im Hintergrund über alle Browser und Geräte, ganz ohne Login oder Token (siehe unten)

## Notion bleibt unverändert (read-only)

- Die Notion-Daten liegen als lesend gezogener Snapshot in [`src/data/seed.ts`](src/data/seed.ts) (Stand 2026-09-19).
- Die App schreibt **nie** in Notion. Eine Content-Security-Policy erlaubt technisch nur Verbindungen
  zur App selbst und – für den Sync – zu `kvdb.io`. Anfragen an Notion werden vom Browser blockiert.
- Eigene Daten (To-dos, Notizen, Prüfungen, Häkchen, Stundenplan-Wahl) liegen im Browser und werden automatisch
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

## AI-Assistent (vorbereitet, noch ohne Modell)

`src/lib/ai/` enthält die komplette Schicht, über die später eine (kostenlose) AI-API die App bedienen kann
– ohne eigenes Datenmodell und ohne direkten Zugriff auf den Speicher:

```
Satz → AIService → Provider (Modell) → strukturierte Action → Validierung → Store → UI + Sync
```

- `context.ts` – `buildAIContext()` projiziert den aktuellen Zustand (Fächer, Aufgaben, Notizen, Stundenplan,
  Einstellungen) als Daten; getrennt in *permanent* und *dynamisch*, damit nur das Nötige verschickt wird.
  Wird bei **jeder** Anfrage neu gebaut – die AI kann gar nicht mit veralteten Daten arbeiten.
- `actions.ts` – die einzigen erlaubten Operationen (`get_tasks`, `create_task`, `delete_note`, …) mit
  deklarierten Parametern, Validierung und Bestätigungspflicht für alles Löschende.
- `provider.ts` – anbieterunabhängige Schnittstelle. Der API-Key liegt **nie** im Frontend: konfiguriert
  wird nur die URL eines server-seitigen Proxys (`VITE_AI_PROXY_URL`), der den Schlüssel aus einer
  Environment-Variable nimmt.
- `mock.ts` – regelbasierter Ersatz-Provider ohne Netz, damit die ganze Kette schon heute testbar ist:
  `mockAI('Füge eine Analysis-Aufgabe für Freitag hinzu: Serie 2')`.

Getestet in `src/lib/ai/ai.test.ts` (u. a.: Löschen passiert nie ohne Bestätigung, erfundene Aktionen und
Parameter werden abgewiesen, ein neuer Eintrag steckt sofort im nächsten Context).

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
  lib/ai/             Context, Actions, Provider-Abstraktion und Mock für den späteren Assistenten
  lib/schedule.ts     Termine je Tag/Woche, laufend/als Nächstes, Fach-Vorschlag
  lib/data.ts         Fristen & To-dos als eine Liste
  lib/search.ts       Suche, Fach-Erkennung für Schnellerfassung
  lib/rooms.ts        ETH-Raumcode → offizieller Raumplan
  components/, pages/ Oberfläche
.github/workflows/    Deployment auf GitHub Pages
```

Analyse und Entscheidungen: [docs/ANALYSIS.md](docs/ANALYSIS.md)
