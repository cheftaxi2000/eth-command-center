# ETH Study Command Center

Persönliche Studienübersicht für den Laptop-Browser und das iPad (installierbare PWA).
Beim Öffnen beantwortet sie **„Was muss ich gerade wissen?“** – nicht „Wo finde ich das?“.

- **Heute** – laufende/nächste Veranstaltung mit Countdown und Raum (Tipp → ETH-Raumplan), Fälliges der nächsten 7 Tage, To-dos pro Fach
- **To-dos pro Fach** – eintippen, Enter, fertig. Optional mit Frist („Heute“, „Morgen“, „Nächste Übung“, „Nächste Vorlesung“, Datum). Erledigt = grüner Haken.
- **Notizen** – eigene, freie Notizen (nicht aus Notion), optional einem Fach zugeordnet – z. B. Passwörter, Ideen, Dinge zum Merken.
- **Woche** – Stundenplan mit Jetzt-Linie; offene Abgaben/Serien stehen direkt an der passenden Übung; wischen oder ← → für andere Wochen
- **Kurse** – je Kurs: Links (Moodle, CodeExpert …), nächster Termin, To-dos, Abgaben & Prüfungen, Zeiten & Räume, Notion-Notizen, eigene Notizen
- **Suche** (Strg/⌘ K, `/` oder Tab „Suche“) über Kurse, To-dos, eigene Notizen, Termine & Räume, Abgaben, Notion-Notizen, Dozenten, Links – und „… als To-do speichern“
- **Schnell wechseln** – Kurs-Chips oben (iPad), Wischen zwischen Kursen, Tasten `1`–`6`, `N` für neues To-do, `?` für alle Kürzel
- **Sync** – läuft automatisch im Hintergrund, ganz ohne Login oder Token (siehe unten)

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

## Sync zwischen Laptop und iPad

Läuft automatisch, ganz ohne Login oder Token: Beim allerersten Öffnen erzeugt die App selbst einen
zufälligen **Sync-Code** (über [kvdb.io](https://kvdb.io), einen kostenlosen, anonymen Key-Value-Speicher)
und synchronisiert sofort im Hintergrund.

Ein zweites Gerät koppeln: **Einstellungen → Sync** öffnen, den angezeigten Code kopieren, auf dem zweiten
Gerät (auf dem iPad in der installierten App, nicht in Safari) unter „Code eines anderen Geräts eingeben“
einfügen → Koppeln. Bereits vorhandene Daten auf beiden Geräten werden zusammengeführt, nichts geht verloren.

Wer den Code kennt, kann diese Daten lesen und ändern – nicht öffentlich teilen. Offline erfasste Änderungen
werden automatisch nachgeholt, sobald wieder eine Verbindung besteht.

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
  lib/store.ts        lokaler Zustand + Aktionen
  lib/sync.ts         automatischer Sync über kvdb.io (Sync-Code statt Token)
  lib/schedule.ts     Termine je Tag/Woche, laufend/als Nächstes, Fach-Vorschlag
  lib/data.ts         Fristen & To-dos als eine Liste
  lib/search.ts       Suche, Fach-Erkennung für Schnellerfassung
  lib/rooms.ts        ETH-Raumcode → offizieller Raumplan
  components/, pages/ Oberfläche
.github/workflows/    Deployment auf GitHub Pages
```

Analyse und Entscheidungen: [docs/ANALYSIS.md](docs/ANALYSIS.md)
