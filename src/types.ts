/* Types of the read-only Notion snapshot (src/data/seed.ts). Personal data types live in lib/state.ts. */

export type SessionKind = 'lecture' | 'exercise';

export interface Session {
  id: string;
  kind: SessionKind;
  /** 1 = Monday … 5 = Friday (matches Date#getDay) */
  day: 1 | 2 | 3 | 4 | 5;
  start: string; // "HH:mm"
  end: string;
  /** Main room ("Haupt") */
  room: string;
  /** Overflow rooms ("Neben"), usually video transmission */
  altRooms?: string[];
  /** Notion: "2-wöchentlich" – which weeks is not part of the Notion data */
  biweekly?: boolean;
  /** Sessions sharing a group are alternatives – the student attends one of them */
  choiceGroup?: string;
}

export interface CourseLink {
  label: string;
  url: string;
  kind: 'moodle' | 'exercise' | 'course' | 'video' | 'other';
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  code: string;
  semester: string;
  instructor: string;
  /** Notion cover colour of the course – used only as a small accent */
  color: string;
  icon: string;
  /** App-side search aliases (not from Notion) */
  aliases: string[];
  sessions: Session[];
  links: CourseLink[];
}

export type TaskStatus = 'not-started' | 'in-progress' | 'done';

/** A task from the Notion "Tasks" database */
export interface Task {
  id: string;
  courseId: string;
  title: string;
  /** Local time, "YYYY-MM-DDTHH:mm" (Europe/Zurich) */
  due: string;
  category: string;
  status: TaskStatus;
}

export type NoteBlock =
  | { type: 'h2' | 'h3' | 'p'; text: string }
  | { type: 'code'; text: string };

export interface Note {
  id: string;
  courseId: string;
  title: string;
  sessionType: string;
  blocks: NoteBlock[];
}

export interface AdminLink {
  label: string;
  url: string;
  description?: string;
}

export interface Seed {
  meta: { source: string; snapshotAt: string; semester: string };
  courses: Course[];
  tasks: Task[];
  notes: Note[];
  adminLinks: AdminLink[];
}

/* ==========================================================================
   Official course exercises and bonus rules (src/data/exercises.ts).
   Read-only like the Notion snapshot: the app never edits these, it only
   remembers what the student ticked off (lib/state.ts → SyncedState.exercises).
   ========================================================================== */

/** Where a piece of information comes from – shown in the app, so every rule stays checkable. */
export interface SourceRef {
  label: string;
  url: string;
  /** "YYYY-MM-DD" – when the text was last read from that source */
  retrieved: string;
}

/**
 * Cross-course role, used ONLY for filtering (week view, tasks page). What a course actually calls
 * the thing lives in `ExerciseType.label` – the courses genuinely use different systems.
 */
export type ExerciseRole = 'normal' | 'bonus' | 'quiz' | 'assessment' | 'project' | 'admin';

export interface ExerciseType {
  id: string;
  /** The course's own wording: "Bonusaufgabe", "Lernkontrolle", "Freiwillige Zwischenprüfung" … */
  label: string;
  /** Short form for a chip */
  short: string;
  role: ExerciseRole;
  compulsory: boolean;
  /** Counts towards this course's bonus / graded performance */
  bonusRelevant: boolean;
  /** Where it is submitted or held: "Code Expert", "SAM-Upload Tool", "in der Übungsstunde" … */
  where?: string;
  /** Whether the app tracks "correct/passed" separately from "handed in" */
  tracksCorrect?: boolean;
  note?: string;
}

export interface OfficialExercise {
  id: string;
  courseId: string;
  typeId: string;
  title: string;
  detail?: string;
  /** Semester week (1 = week of 2026-09-14) when a source names one */
  week?: number;
  /** "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" – ONLY when a source states it literally */
  dueAt?: string;
  /** Monday "YYYY-MM-DD" when the source names a week but not a day */
  weekOf?: string;
  /** What the source says about the date when there is none yet */
  dateNote?: string;
  /** Link to the exercise sheet itself, if public */
  url?: string;
}

export type BonusKind = 'grade-bonus' | 'midterm-credit' | 'graded-performance' | 'none';

/** One measurable requirement, e.g. "9 of 12 correct" or "10 series handed in". */
export interface BonusGoal {
  id: string;
  label: string;
  /** done = handed in / attended, correct = correct or passed, count = a plain counter */
  metric: 'done' | 'correct' | 'count';
  /** Exercises of these types count towards the goal */
  typeIds?: string[];
  /** …or exactly these exercises */
  exerciseIds?: string[];
  /** For metric 'count': the id of the counter the student sets by hand */
  tallyId?: string;
  /** How many are needed; absent when the source does not name a number */
  required?: number;
  /** How many exist in total, when the source names it */
  of?: number;
  hint?: string;
}

export interface BonusInfo {
  kind: BonusKind;
  /** The one-line answer to "Gibt es einen Bonus?" */
  headline: string;
  /** Maximum, in the course's own words */
  max?: string;
  /** Verbatim rule text – never paraphrased */
  quote?: string;
  quoteSource?: SourceRef;
  /** Question → answer, the concrete rules of THIS course */
  facts: { q: string; a: string }[];
  goals: BonusGoal[];
  /** Points → resulting bonus, where the source gives a formula */
  formula?: { goalId: string; perUnit: number; cap: number; unit: string; note?: string };
}

export interface CourseExercises {
  courseId: string;
  semester: string;
  types: ExerciseType[];
  exercises: OfficialExercise[];
  bonus: BonusInfo;
  /** How this course publishes its exercises, in its own words */
  rhythm?: string;
  sources: SourceRef[];
  /** What could NOT be verified from public sources – shown as such, never guessed */
  unverified: string[];
}
