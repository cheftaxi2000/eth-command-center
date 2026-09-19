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
