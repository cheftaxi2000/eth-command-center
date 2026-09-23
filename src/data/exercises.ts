import type { CourseExercises, OfficialExercise, SourceRef } from '../types';

/**
 * Official exercises and bonus rules of the HS 2026 courses – read-only, like the Notion snapshot.
 *
 * Everything here was read from the sources listed per course on 2026-09-23 (see
 * docs/EXERCISES-HS26.md for the full write-up with verbatim quotes). Two rules this file exists to
 * enforce:
 *
 *  1. NOTHING IS INVENTED. A date only appears here when a source states it literally. Where the
 *     dates live behind a login (Moodle, Code Expert), the entry carries `dateNote` instead, and the
 *     course lists what could not be verified in `unverified`.
 *  2. EVERY COURSE KEEPS ITS OWN SYSTEM. The five courses do NOT share a definition of "exercise" or
 *     "bonus": grade bonus for bonus tasks (Analysis, Lineare Algebra), bonus for quizzes plus handed-in
 *     series (Chemistry), bonus tasks unlocked with XP (Informatik), voluntary midterms counting 30 %
 *     (Mechanik), graded semester performance without any bonus (Engineering Design). Each course
 *     therefore defines its own types, labels and goals; the `role` field exists only so the UI can
 *     offer one global filter across those different systems.
 */

/** Monday of semester week 1 (first lectures Tue 15.09. / Wed 16.09.2026) */
export const SEMESTER_START = '2026-09-14';
export const SEMESTER = 'HS 2026';
/** When the sources below were last read */
export const VERIFIED_ON = '2026-09-23';

const vvz = (label: string, id: number, lang: 'de' | 'en' = 'de'): SourceRef => ({
  label,
  url: `https://vvz.ethz.ch/Vorlesungsverzeichnis/lerneinheit.view?ansicht=ALLE&lang=${lang}&lerneinheitId=${id}&semkez=2026W`,
  retrieved: VERIFIED_ON,
});

/** n entries of the same kind ("Bonusaufgabe 1 … 12") whose individual dates are not public. */
function numbered(courseId: string, typeId: string, count: number, title: (n: number) => string, dateNote: string): OfficialExercise[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${courseId}:${typeId}-${i + 1}`, courseId, typeId, title: title(i + 1), dateNote }));
}

const ANALYSIS_VVZ = vvz('VVZ 401-0261-00L (HS 2026)', 204435);
const LINALG_PAGE: SourceRef = { label: 'Kursseite Lineare Algebra I HS 2026', url: 'https://metaphor.ethz.ch/x/2026/hs/401-0171-00L/', retrieved: VERIFIED_ON };
const MECHANIK_VVZ = vvz('VVZ 151-0501-03L (HS 2026)', 203932);
const CHEMIE_VVZ = vvz('VVZ 151-0909-00L (HS 2026)', 204870, 'en');
const INFO_PAGE: SourceRef = { label: 'Kursseite Informatik I AS 26', url: 'https://lec.inf.ethz.ch/mavt/informatik1/2026/', retrieved: VERIFIED_ON };
const EDMS_VVZ = vvz('VVZ 151-0321-00L (HS 2026)', 204546, 'en');

export const COURSE_EXERCISES: Record<string, CourseExercises> = {
  'analysis-1': {
    courseId: 'analysis-1',
    semester: SEMESTER,
    types: [
      {
        id: 'bonus',
        label: 'Bonusaufgabe',
        short: 'Bonus',
        role: 'bonus',
        compulsory: false,
        bonusRelevant: true,
        where: 'Moodle',
        tracksCorrect: true,
        note: '12 Stück im Semester. 9 davon korrekt und rechtzeitig ergeben den vollen Notenbonus.',
      },
    ],
    exercises: numbered('analysis-1', 'bonus', 12, (n) => `Bonusaufgabe ${n}`, 'Termin steht im Moodle-Kurs'),
    bonus: {
      kind: 'grade-bonus',
      headline: 'Ja – bis 0.25 Notenpunkte für 9 von 12 Bonusaufgaben',
      max: '0.25 Notenpunkte',
      quote:
        'Das rechtzeitige Lösen und Abgeben von Bonusaufgaben wird mit einem Notenbonus von bis zu 0.25 Notenpunkten belohnt. Für den maximalen Notenbonus müssen 9 der 12 Bonusaufgaben korrekt bearbeitet und rechtzeitig abgegeben werden.',
      quoteSource: ANALYSIS_VVZ,
      facts: [
        { q: 'Wie viele?', a: '9 von 12 Bonusaufgaben.' },
        { q: 'Zählt Korrektheit?', a: 'Ja – die Aufgaben müssen „korrekt bearbeitet" sein.' },
        { q: 'Zählt die Frist?', a: 'Ja, „rechtzeitig" steht ausdrücklich in der Bedingung.' },
        { q: 'Wo abgeben?', a: 'Im Moodle-Kurs Analysis I.' },
        { q: 'Voraussetzungen?', a: 'Keine genannt.' },
        { q: 'Teilbonus unter 9?', a: 'Nicht öffentlich festgehalten – das VVZ nennt nur die Bedingung für den maximalen Bonus („bis zu 0.25").' },
      ],
      goals: [
        { id: 'analysis-bonus', label: 'Korrekt & rechtzeitig abgegeben', metric: 'correct', typeIds: ['bonus'], required: 9, of: 12 },
        { id: 'analysis-bonus-done', label: 'Überhaupt abgegeben', metric: 'done', typeIds: ['bonus'], of: 12 },
      ],
    },
    sources: [ANALYSIS_VVZ, { label: 'Moodle Analysis I (Login)', url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=28161', retrieved: VERIFIED_ON }],
    unverified: [
      'Termine der einzelnen 12 Bonusaufgaben (stehen im Moodle-Kurs)',
      'Zeitplan und Fristen der regulären Übungsserien',
      'Ob es unter 9 korrekten Aufgaben einen anteiligen Bonus gibt',
    ],
  },

  'lineare-algebra-1': {
    courseId: 'lineare-algebra-1',
    semester: SEMESTER,
    types: [
      {
        id: 'serie',
        label: 'Übungsserie',
        short: 'Serie',
        role: 'normal',
        compulsory: false,
        bonusRelevant: false,
        where: 'SAM-Upload Tool (MC-Aufgaben auf echo)',
        note: 'Serie n erscheint Freitag der Woche n, Abgabe Freitag der Woche n+2 um 14:00.',
      },
      {
        id: 'bonus',
        label: 'Bonusaufgabe',
        short: 'Bonus',
        role: 'bonus',
        compulsory: false,
        bonusRelevant: true,
        where: 'Online-Abgabelink (PDF: LegiNr_BAX.pdf)',
        note: 'Abgabe Freitag 10:00, eine Woche nach Veröffentlichung. Eine verspätete Abgabe ist nicht möglich.',
      },
      {
        id: 'lernkontrolle',
        label: 'Lernkontrolle',
        short: 'Lernkontrolle',
        role: 'assessment',
        compulsory: false,
        bonusRelevant: true,
        where: 'in der eigenen Übungsstunde, auf echo',
        note: 'Unbenotet, 55 Minuten, ohne Hilfsmittel – gibt den 6. Bonuspunkt des Semesters.',
      },
      { id: 'orga', label: 'Organisatorisches', short: 'Orga', role: 'admin', compulsory: true, bonusRelevant: false, where: 'echo / Übungsstunde' },
    ],
    exercises: [
      {
        id: 'lineare-algebra-1:serie-1',
        courseId: 'lineare-algebra-1',
        typeId: 'serie',
        title: 'Serie 1',
        week: 1,
        dueAt: '2026-10-02T14:00',
        url: 'https://metaphor.ethz.ch/x/2026/hs/401-0171-00L/ex/ex01.pdf',
      },
      {
        id: 'lineare-algebra-1:bonus-1',
        courseId: 'lineare-algebra-1',
        typeId: 'bonus',
        title: 'Bonusaufgabe 1',
        week: 1,
        dueAt: '2026-09-25T10:00',
        url: 'https://metaphor.ethz.ch/x/2026/hs/401-0171-00L/bonus/ba1.pdf',
        detail: 'Keine verspätete Abgabe möglich.',
      },
      {
        id: 'lineare-algebra-1:lernkontrolle',
        courseId: 'lineare-algebra-1',
        typeId: 'lernkontrolle',
        title: 'Lernkontrolle',
        dueAt: '2026-12-11',
        detail: '55 Minuten in deiner Übungsstunde, ohne Hilfsmittel, unbenotet. Gerät mit Internet mitbringen.',
      },
      {
        id: 'lineare-algebra-1:lernkontrolle-einteilung',
        courseId: 'lineare-algebra-1',
        typeId: 'orga',
        title: 'Einteilung für die Lernkontrolle',
        dueAt: '2026-12-10T12:00',
        detail: 'Stichtag, damit es in jeder Übungsstunde genug Plätze gibt.',
      },
    ],
    bonus: {
      kind: 'grade-bonus',
      headline: 'Ja – Punkte aus Bonusaufgaben, bis 0.25 Notenpunkte',
      max: '0.25 Notenpunkte: min(0.25, 0.25·P/9)',
      quote:
        'Während des ersten und zweiten Semesters wird die aktive Teilnahme an besonders gekennzeichneten Übungsteilen (fortan Bonusaufgaben genannt) durch Punkte belohnt. Jede Bonusaufgabe wird mit 0 oder 1 Punkt bewertet, wobei 1 Punkt vergeben wird, wenn die Bonusaufgabe sinnvoll und umfassend bearbeitet wurde. Pro Semester können je 6 Punkte (in 5 Bonusaufgaben und einer Lernkontrolle) gesammelt werden. Die erreichte Punktzahl P ergibt einen Notenzuschlag von min(0.25, 0.25·P/9) zur ungerundeten Endnote in der Basisprüfung.',
      quoteSource: LINALG_PAGE,
      facts: [
        { q: 'Wie viele Punkte?', a: 'Pro Semester 6: fünf Bonusaufgaben plus die Lernkontrolle, je 0 oder 1 Punkt.' },
        { q: 'Wie viel Bonus?', a: 'min(0.25, 0.25·P/9) auf die ungerundete Note der Basisprüfung – 9 Punkte über HS26 und FS27 ergeben das Maximum.' },
        { q: 'Zählt Korrektheit?', a: 'Nicht streng: 1 Punkt, „wenn die Bonusaufgabe sinnvoll und umfassend bearbeitet wurde".' },
        { q: 'Zählt die Frist?', a: 'Ja, hart: Freitag 10:00, eine Woche nach Veröffentlichung. „Eine verspätete Abgabe ist nicht möglich."' },
        { q: 'Wo abgeben?', a: 'Online als PDF mit dem Namen LegiNr_BAX.pdf (z. B. 26-123-456_BA1.pdf). Keine Musterlösungen, keine Korrektur zurück.' },
        { q: 'Lernkontrolle?', a: '11.12.2026, 55 Minuten in deiner Übungsstunde, unbenotet, ohne Hilfsmittel; Einteilung bis 10.12.2026 12:00. „Für eine sinnvolle Bearbeitung der Lernkontrolle erhalten Sie 1 Punkt."' },
        { q: 'Punkteverfall?', a: 'Kursseite wörtlich: „Falls Sie im Frühjahr (Januar/Februar 2027) die Prüfung wiederholen oder das erste Mal ablegen, werden Ihnen die Bonuspunkte aus dem Vorlesungsjahr HS25/FS26 angerechnet. Falls Sie jedoch im Sommer 2027 zur Prüfung antreten, müssen die Bonuspunkte in diesem Vorlesungsjahr HS26/FS27 erneut erworben werden." (Jahresangaben wie dort gedruckt.)' },
      ],
      goals: [{ id: 'linalg-points', label: 'Bonuspunkte dieses Semester', metric: 'done', typeIds: ['bonus', 'lernkontrolle'], required: 6, of: 6, hint: '9 Punkte über HS26 + FS27 ergeben den vollen Zuschlag' }],
      formula: { goalId: 'linalg-points', perUnit: 0.25 / 9, cap: 0.25, unit: 'Notenpunkte', note: 'min(0.25, 0.25·P/9)' },
    },
    rhythm: 'Serie n erscheint Freitag der Semesterwoche n, Besprechung in Woche n+1, Abgabe Freitag der Woche n+2 um 14:00. Bonusaufgaben erscheinen mit der Serie, Abgabe schon Freitag 10:00 eine Woche später.',
    sources: [LINALG_PAGE, vvz('VVZ 401-0171-00L (HS 2026)', 202768), { label: 'SAM-Upload Tool', url: 'https://sam-up.math.ethz.ch/?lecture=401-0171-00', retrieved: VERIFIED_ON }],
    unverified: [
      'Termine der Serien ab Serie 2 und der Bonusaufgaben 2–5 (werden laufend veröffentlicht)',
      'Gesamtzahl der Übungsserien im Semester',
    ],
  },

  'mechanik-1': {
    courseId: 'mechanik-1',
    semester: SEMESTER,
    types: [
      {
        id: 'zwischenpruefung',
        label: 'Freiwillige Zwischenprüfung',
        short: 'Zwischenprüfung',
        role: 'assessment',
        compulsory: false,
        bonusRelevant: true,
        where: 'wird im Semester bekanntgegeben',
        note: 'Der Durchschnitt der beiden zählt 30 % – aber nur, wenn er die Schlussnote verbessert.',
      },
    ],
    exercises: numbered('mechanik-1', 'zwischenpruefung', 2, (n) => `${n}. freiwillige Zwischenprüfung`, 'Termin wird im Semester bekanntgegeben'),
    bonus: {
      kind: 'midterm-credit',
      headline: 'Kein Übungsbonus – dafür zählen zwei freiwillige Zwischenprüfungen 30 %',
      max: '30 % der Schlussnote, nur wenn es besser ist',
      quote: 'Falls der Durchschnitt der zwei freiwilligen Zwischenprüfungen verbessernd wirkt, wird er zu 30% an die "Mechanik I" Schlussnote angerechnet.',
      quoteSource: MECHANIK_VVZ,
      facts: [
        { q: 'Gibt es einen Übungsbonus?', a: 'Nein. Für abgegebene Serien gibt es laut VVZ keinen Bonus.' },
        { q: 'Was zählt stattdessen?', a: 'Der Durchschnitt der zwei freiwilligen Zwischenprüfungen, zu 30 % – nur wenn er die Note verbessert.' },
        { q: 'Risiko?', a: 'Keines: Eine schlechtere Zwischenprüfung wird nicht angerechnet.' },
        { q: 'Zählt Korrektheit?', a: 'Ja, es sind Prüfungen mit Note.' },
        { q: 'Wo?', a: 'Vor Ort; Termine werden im Semester bekanntgegeben.' },
        { q: 'Schlussprüfung?', a: 'Sessionsprüfung, schriftlich 90 Minuten, ohne Hilfsmittel und ohne Taschenrechner.' },
      ],
      goals: [{ id: 'mechanik-zp', label: 'Zwischenprüfungen geschrieben', metric: 'done', typeIds: ['zwischenpruefung'], required: 2, of: 2 }],
    },
    sources: [MECHANIK_VVZ],
    unverified: [
      'Termine der beiden Zwischenprüfungen',
      'Ob und wie Übungsserien abgegeben werden (Kursmaterial liegt hinter dem Login)',
    ],
  },

  chemistry: {
    courseId: 'chemistry',
    semester: SEMESTER,
    types: [
      {
        id: 'quiz',
        label: 'Quiz (10 Minuten)',
        short: 'Quiz',
        role: 'quiz',
        compulsory: false,
        bonusRelevant: true,
        where: 'in der Übungsstunde',
        tracksCorrect: true,
        note: 'Drei Stück, pass/fail bewertet. 2 davon bestanden sind die eine Hälfte der Bonusbedingung.',
      },
      {
        id: 'serie',
        label: 'Weekly exercise series',
        short: 'Serie',
        role: 'normal',
        compulsory: false,
        bonusRelevant: true,
        where: 'Übungsstunde / Moodle',
        note: 'Werden eingesammelt, aber nicht benotet. 10 abgegebene Serien sind die andere Hälfte der Bonusbedingung.',
      },
    ],
    exercises: numbered('chemistry', 'quiz', 3, (n) => `Quiz ${n}`, 'Termin wird angekündigt („dates will be announced")'),
    bonus: {
      kind: 'grade-bonus',
      headline: 'Ja – 0.25 Notenpunkte für 2 von 3 Quiz und 10 abgegebene Serien',
      max: '0.25 Notenpunkte',
      quote:
        'In addition, during the semester, weekly exercise series (problem sets as learning tasks) will be assigned and collected. Based on these assignments, three 10-minute quizzes will be given during exercise (dates will be announced) and graded pass/fail. If a student passes 2 of these 3 graded quizzes and hands in 10 of the weekly exercise series (problem sets), they will receive a 0.25 bonus on their final grade.',
      quoteSource: CHEMIE_VVZ,
      facts: [
        { q: 'Beides nötig?', a: 'Ja, die beiden Bedingungen gelten zusammen: 2 von 3 Quiz bestanden UND 10 wöchentliche Serien abgegeben.' },
        { q: 'Zählt Korrektheit?', a: 'Bei den Quiz ja (pass/fail). Die Serien werden eingesammelt, aber nicht benotet.' },
        { q: 'Zählt die Frist?', a: 'Die Serien müssen wöchentlich abgegeben werden; die Quiz finden zu festen Terminen in der Übungsstunde statt.' },
        { q: 'Wann sind die Quiz?', a: 'Noch offen – „dates will be announced".' },
        { q: 'Wo?', a: 'In der Übungsstunde (Quiz) bzw. über die Übung/Moodle (Serien).' },
        { q: 'Und die Note selbst?', a: 'Die Schlussprüfung (120 Minuten, Englisch) macht 100 % der Note aus; der Bonus kommt obendrauf.' },
      ],
      goals: [
        { id: 'chemistry-quiz', label: 'Quiz bestanden', metric: 'correct', typeIds: ['quiz'], required: 2, of: 3 },
        { id: 'chemistry-series', label: 'Serien abgegeben', metric: 'count', tallyId: 'chemistry:series', required: 10, hint: 'Zähler – die einzelnen Serien stehen auf Moodle' },
      ],
    },
    sources: [CHEMIE_VVZ, { label: 'Moodle Chemistry (Login)', url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=28343', retrieved: VERIFIED_ON }],
    unverified: [
      'Termine der drei Quiz („dates will be announced")',
      'Gesamtzahl und Fristen der wöchentlichen Serien (stehen auf Moodle)',
    ],
  },

  'informatik-1': {
    courseId: 'informatik-1',
    semester: SEMESTER,
    types: [
      {
        id: 'bonus',
        label: 'Bonus exercise',
        short: 'Bonus',
        role: 'bonus',
        compulsory: false,
        bonusRelevant: true,
        where: 'Code Expert',
        note: 'Drei im Semester. Muss vorher in Code Expert mit XP aus den Wochenübungen freigeschaltet werden.',
      },
      {
        id: 'assignment',
        label: 'Weekly assignment',
        short: 'Übung',
        role: 'normal',
        compulsory: false,
        bonusRelevant: true,
        where: 'Code Expert',
        note: 'Nicht obligatorisch, aber sie geben die XP, die die Bonusübungen freischalten.',
      },
    ],
    exercises: numbered('informatik-1', 'bonus', 3, (n) => `Bonusübung ${n}`, 'Termin steht in Code Expert'),
    bonus: {
      kind: 'grade-bonus',
      headline: 'Ja – bis 0.25 Notenpunkte für 3 Bonusübungen, die du erst freischalten musst',
      max: '0.25 Notenpunkte',
      quote:
        'There will be 3 bonus exercises during the semester. By solving these exercises you will get up to 0.25 grade points added on top of your exam grade. In order to access the bonus exercises you need to unlock them in CodeExpert by solving assignments from previous weeks and earning sufficiently many experience points (XP).',
      quoteSource: INFO_PAGE,
      facts: [
        { q: 'Wie viele?', a: 'Drei Bonusübungen im Semester, zusammen bis 0.25 Notenpunkte.' },
        { q: 'Voraussetzung?', a: 'Ja – die Bonusübungen sind gesperrt, bis du mit den Wochenübungen genug XP gesammelt hast.' },
        { q: 'Zählt Korrektheit?', a: 'Ja, die Aufgaben müssen gelöst sein („by solving these exercises").' },
        { q: 'Zählt die Frist?', a: 'Die Fristen stehen in Code Expert; die Wochenübungen laufen wöchentlich mit.' },
        { q: 'Wo?', a: 'Code Expert (Anmeldung über die Übungsgruppe).' },
        { q: 'Sind die Wochenübungen Pflicht?', a: 'Nein. Sie sind aber der einzige Weg zu den XP und damit zum Bonus.' },
      ],
      goals: [
        { id: 'informatik-bonus', label: 'Bonusübungen gelöst', metric: 'done', typeIds: ['bonus'], required: 3, of: 3 },
        { id: 'informatik-weekly', label: 'Wochenübungen gelöst (XP)', metric: 'count', tallyId: 'informatik-1:weekly', hint: 'Zähler – die XP-Schwelle nennt der Kurs nicht öffentlich' },
      ],
    },
    sources: [INFO_PAGE, vvz('VVZ 252-0832-00L (HS 2026)', 202779), { label: 'Code Expert AS26 (Login)', url: 'https://expert.ethz.ch/enrolled/AS26/mavt/exercises', retrieved: VERIFIED_ON }],
    unverified: [
      'Fristen der Wochenübungen und der drei Bonusübungen (stehen in Code Expert)',
      'Die nötige XP-Schwelle zum Freischalten',
      'Wie sich die 0.25 Notenpunkte auf die drei Bonusübungen verteilen',
    ],
  },

  'engineering-design': {
    courseId: 'engineering-design',
    semester: SEMESTER,
    types: [
      {
        id: 'quiz',
        label: 'Quiz',
        short: 'Quiz',
        role: 'quiz',
        compulsory: true,
        bonusRelevant: true,
        where: 'in der Übungsstunde, am ETH-Rechner',
        note: 'Obligatorisch: die beiden Quiz ergeben die Note dieser Lerneinheit.',
      },
      { id: 'orga', label: 'Organisatorisches', short: 'Orga', role: 'admin', compulsory: true, bonusRelevant: false, where: 'myStudies' },
    ],
    exercises: [
      {
        id: 'engineering-design:quiz-1',
        courseId: 'engineering-design',
        typeId: 'quiz',
        title: 'Quiz 1',
        weekOf: '2026-11-09',
        detail: 'In deiner Übungsstunde (Mo–Do, je nach Slot). Laut Notion ist deine Übung am Mittwoch.',
      },
      {
        id: 'engineering-design:quiz-2',
        courseId: 'engineering-design',
        typeId: 'quiz',
        title: 'Quiz 2',
        weekOf: '2026-12-14',
        detail: 'In deiner Übungsstunde (Mo–Do, je nach Slot). Laut Notion ist deine Übung am Mittwoch.',
      },
      {
        id: 'engineering-design:mystudies',
        courseId: 'engineering-design',
        typeId: 'orga',
        title: 'Übungsgruppe in myStudies wählen',
        dueAt: '2026-10-10',
        detail: 'Registration for groups in myStudies is possible until 10.10.2026.',
      },
    ],
    bonus: {
      kind: 'graded-performance',
      headline: 'Kein Bonus – hier sind die beiden Quiz die Note',
      quote:
        'The mandatory quizzes are held in the regular exercise sessions from Monday to Thursday each week. After participation in the first quiz, the course will be graded and the subsequent quiz has to be taken. A maximum of one quiz can be missed and taken at another date for a valid reason, i.e. illness with a doctors certificate.',
      quoteSource: EDMS_VVZ,
      facts: [
        { q: 'Gibt es einen Bonus?', a: 'Nein. Die Lerneinheit ist eine „benotete Semesterleistung" – es gibt keine Sessionsprüfung.' },
        { q: 'Was zählt?', a: 'Die beiden obligatorischen Quiz in der Übungsstunde.' },
        { q: 'Wann?', a: 'Woche vom 09.11.2026 und Woche vom 14.12.2026, am Tag deines Übungsslots (Mo–Do).' },
        { q: 'Verpassen?', a: 'Höchstens eines, mit gutem Grund (Arztzeugnis), und es muss nachgeholt werden. Nach dem ersten Quiz ist der Kurs benotet.' },
        { q: 'Wo?', a: 'Am Computer, auf Geräten der ETH.' },
        { q: 'Frist ausserhalb?', a: 'Einschreibung in eine Übungsgruppe über myStudies bis 10.10.2026.' },
      ],
      goals: [{ id: 'edms-quiz', label: 'Quiz geschrieben', metric: 'done', typeIds: ['quiz'], required: 2, of: 2 }],
    },
    sources: [EDMS_VVZ, { label: 'Moodle Engineering Design (Login)', url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=28176', retrieved: VERIFIED_ON }],
    unverified: [
      'Der genaue Wochentag der beiden Quiz (hängt am eigenen Übungsslot)',
      'Gewichtung der beiden Quiz zueinander und ob weitere Leistungen einfliessen',
    ],
  },
};

/** Labels for the cross-course roles – the only place where all courses share wording. */
export const ROLE_LABEL: Record<string, string> = {
  normal: 'Übungen',
  bonus: 'Bonus',
  quiz: 'Quiz',
  assessment: 'Prüfungsleistung',
  project: 'Projekt',
  admin: 'Organisatorisches',
};
