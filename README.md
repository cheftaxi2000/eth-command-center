# ETH Study Command Center

Persönliche Studienübersicht für den Laptop-Browser und das iPad (installierbare PWA).
Beim Öffnen beantwortet sie **„Was muss ich gerade wissen?“** – nicht „Wo finde ich das?“.

- **Heute** – laufende/nächste Veranstaltung mit Countdown und Raum (Tipp → ETH-Raumplan), Fälliges der nächsten 7 Tage, To-dos pro Fach
- **To-dos pro Fach** – eintippen, Enter, fertig. Optional mit Frist („Heute“, „Morgen“, „Nächste Übung“, „Nächste Vorlesung“, Datum)
- **Woche** – Stundenplan mit Jetzt-Linie, Abgaben und datierten To-dos; wischen oder ← → für andere Wochen
- **Kurse** – je Kurs: Links (Moodle, CodeExpert …), nächster Termin, To-dos, Abgaben & Prüfungen, Zeiten & Räume, Notizen
- **Suche** (Strg/⌘ K, `/` oder Tab „Suche“) über Kurse, To-dos, Termine & Räume, Abgaben, Notizen, Dozenten, Links – und „… als To-do speichern“
- **Schnell wechseln** – Kurs-Chips oben (iPad), Wischen zwischen Kursen, Tasten `1`–`6`, `N` für neues To-do, `?` für alle Kürzel

## Notion bleibt unverändert (read-only)

- Die Notion-Daten liegen als lesend gezogener Snapshot in [`src/data/seed.ts`](src/data/seed.ts) (Stand 2026-09-19).
- Die App schreibt **nie** in Notion. Eine Content-Security-Policy erlaubt technisch nur Verbindungen
  zur App selbst und – für den optionalen Sync – zu `api.github.com`. Anfragen an Notion werden vom Browser blockiert.
- Eigene Daten (To-dos, Prüfungen, Häkchen, Stundenplan-Wahl) liegen im Browser und optional in deinem privaten GitHub-Repo.
- Nicht in Notion und deshalb **nicht erfunden**: Prüfungstermine, Credits, Noten, Vorlesungsthemen,
  Wochen der 2-wöchentlichen Analysis-Vorlesung, deine Mechanik-Übungsgruppe (in der App einstellbar).

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

In der App: **Einstellungen → Sync**. Einmal pro Gerät (auf dem iPad in der installierten App, nicht in Safari):

1. Privates Repo `studium-sync` anlegen.
2. [Fine-grained Token](https://github.com/settings/personal-access-tokens/new) erstellen:
   *Only select repositories* → `studium-sync`, Permission **Contents: Read and write**.
3. Token in der App einfügen → Verbinden.

Die App gleicht dann die Datei `studium.json` in diesem Repo ab (jede Änderung pro Eintrag, Löschungen inklusive,
offline Geändertes wird nachgeholt). Öffentliche Repos lehnt die App ab. Der Token bleibt nur auf dem jeweiligen Gerät.

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
  lib/sync.ts         optionaler GitHub-Sync (eine Datei in privatem Repo)
  lib/schedule.ts     Termine je Tag/Woche, laufend/als Nächstes, Fach-Vorschlag
  lib/data.ts         Fristen & To-dos als eine Liste
  lib/search.ts       Suche, Fach-Erkennung für Schnellerfassung
  lib/rooms.ts        ETH-Raumcode → offizieller Raumplan
  components/, pages/ Oberfläche
.github/workflows/    Deployment auf GitHub Pages
```

Analyse und Entscheidungen: [docs/ANALYSIS.md](docs/ANALYSIS.md)
