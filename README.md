# ETH Study Command Center

Persönliche Studienübersicht für Windows-Browser und iPad (installierbare PWA).
Beim Öffnen beantwortet sie **„Was muss ich gerade wissen?“** – nicht „Wo finde ich das?“.

- **Heute** – Termine des Tages, Fälliges, Wochenleiste, Kurse, Schnellzugriff
- **Woche** – Stundenplan Mo–Fr mit Jetzt-Linie und Deadlines
- **Aufgaben** – Überfällig / nächste 7 Tage / später, Abhaken, eigene Aufgaben & Prüfungen
- **Kurse** – je Kurs: Aktuell, Zeiten & Räume, Aufgaben, Prüfung, Ressourcen, Notizen
- **Globale Suche** (Strg/⌘ + K, auf iPad der Tab „Suche“) über Kurse, Termine, Aufgaben, Notizen samt Themen, Dozenten, Links

## Notion ist read-only

Der Notion **„UNI“** ist die Datenquelle und wird von dieser App **nie** verändert.

- Die App enthält keinen einzigen Netzwerkaufruf (`fetch`/XHR/WebSocket) – sie *kann* nicht in Notion schreiben.
- Die Notion-Daten liegen als einmaliger, lesend gezogener Snapshot in [`src/data/seed.ts`](src/data/seed.ts).
- Eigene Einträge (abgehakte Aufgaben, Prüfungen, Wochen-/Gruppenwahl, Theme) liegen getrennt im `localStorage` dieses Geräts.
- Nicht in Notion und deshalb **nicht erfunden**: Prüfungstermine, Credits, Noten, Vorlesungsthemen, in welchen Wochen die 2-wöchentliche Analysis-Vorlesung stattfindet, welche Mechanik-Übungsgruppe du besuchst. Die App fragt das ab bzw. lässt es dich eintragen.

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Logik-Tests (Stundenplan, Deadlines, Suche)
npm run build      # Typecheck + Produktions-Build + Service Worker
npm run preview    # Build lokal ansehen (http://localhost:4173)
npm run icons      # PWA-Icons neu erzeugen (scripts/generate-icons.mjs)
```

Zum Testen einer anderen Uhrzeit: `http://localhost:5173/?now=2026-09-21T11:00`.

## Auf dem iPad installieren

PWAs brauchen HTTPS. Den Inhalt von `dist/` bei einem beliebigen statischen Host veröffentlichen
(GitHub Pages, Cloudflare Pages, Netlify …; `base: './'` + HashRouter funktionieren auch unter Unterpfaden).
Danach in Safari öffnen → Teilen → **Zum Home-Bildschirm**. Die App startet im Standalone-Modus und
funktioniert offline.

> Hinweis: Eine veröffentlichte Version enthält einen Snapshot deiner Kursdaten unter einer URL.
> Vor dem Deployen bewusst entscheiden, wo und mit welchem Zugriffsschutz.

## Notion-Daten aktualisieren

Aktuell manuell: Änderungen in Notion lesen und in `src/data/seed.ts` nachziehen (Stand: 2026-09-19).
Eine spätere Automatisierung müsste ebenfalls strikt lesend arbeiten (offizielle Notion-API mit
Integration nur mit Berechtigung „Read content“).

## Aufbau

```
src/
  data/seed.ts        Notion-Snapshot (read-only Quelle)
  types.ts            Datenmodell
  lib/
    schedule.ts       Termine je Tag/Woche inkl. Wochen-Parität und Gruppenwahl
    data.ts           Deadlines = Notion-Aufgaben + eigene Aufgaben + Prüfungen
    search.ts         MiniSearch-Index, Aliasse ("Analysis 1", "LinAlg" …)
    store.ts          eigener Zustand (localStorage)
    time.ts, now.ts   Datums-Helfer, "jetzt" (mit ?now= überschreibbar)
  components/         Navigation (Sidebar / Icon-Rail / Tab-Leiste), Suche, Zeilen, Sheet
  pages/              Heute, Woche, Aufgaben, Kurse, Kursseite, Notiz, Links, Einstellungen
  styles.css          Designsystem
```

Analyse und Entscheidungen: [docs/ANALYSIS.md](docs/ANALYSIS.md)
