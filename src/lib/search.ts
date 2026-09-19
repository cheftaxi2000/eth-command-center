import MiniSearch from 'minisearch';
import type { AdminLink, Course, Exam, Note, Task } from '../types';
import { KIND_LABEL } from './schedule';
import { DAY_LONG, DAY_SHORT, fmtDateShort, fmtTime, parseLocal } from './time';

export type SearchType =
  | 'course'
  | 'deadline'
  | 'exam'
  | 'session'
  | 'note'
  | 'topic'
  | 'instructor'
  | 'link'
  | 'action';

export type Target =
  | { kind: 'route'; to: string }
  | { kind: 'external'; url: string }
  | { kind: 'action'; action: 'add-exam' | 'add-task' };

export interface SearchDoc {
  id: string;
  type: SearchType;
  title: string;
  subtitle: string;
  /** Extra searchable text (aliases, synonyms, note contents …) */
  text: string;
  courseId?: string;
  target: Target;
}

export interface SearchInput {
  courses: Course[];
  tasks: Task[];
  notes: Note[];
  adminLinks: AdminLink[];
  exams: Exam[];
}

export const TYPE_LABEL: Record<SearchType, string> = {
  course: 'Kurse',
  deadline: 'Aufgaben & Deadlines',
  exam: 'Prüfungen',
  session: 'Termine',
  note: 'Notizen',
  topic: 'Themen',
  instructor: 'Dozenten',
  link: 'Links',
  action: 'Aktionen',
};

const TYPE_ORDER: SearchType[] = ['course', 'deadline', 'exam', 'session', 'note', 'topic', 'instructor', 'link', 'action'];

const TYPE_BOOST: Partial<Record<SearchType, number>> = { course: 1.8, action: 0.7, session: 0.9 };

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const instructorNames = (s: string) =>
  s
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^u\.\s*a\.$/i.test(p));

export function buildDocs(input: SearchInput): SearchDoc[] {
  const { courses, tasks, notes, adminLinks, exams } = input;
  const course = (id: string) => courses.find((c) => c.id === id);
  const docs: SearchDoc[] = [];

  for (const c of courses) {
    const aliases = c.aliases.join(' ');
    docs.push({
      id: `course:${c.id}`,
      type: 'course',
      title: c.name,
      subtitle: `${c.code} · ${c.instructor}`,
      text: [c.code, c.shortName, aliases, c.instructor, c.semester].join(' '),
      courseId: c.id,
      target: { kind: 'route', to: `/courses/${c.id}` },
    });

    for (const name of instructorNames(c.instructor)) {
      docs.push({
        id: `inst:${c.id}:${name}`,
        type: 'instructor',
        title: name,
        subtitle: `Dozent · ${c.name}`,
        text: `Dozent Dozentin Professor Instructor Lecturer ${c.name} ${aliases}`,
        courseId: c.id,
        target: { kind: 'route', to: `/courses/${c.id}` },
      });
    }

    for (const s of c.sessions) {
      docs.push({
        id: `sess:${s.id}`,
        type: 'session',
        title: `${KIND_LABEL[s.kind]} · ${c.shortName}`,
        subtitle: `${DAY_SHORT[s.day]} ${s.start}–${s.end} · ${s.room}`,
        text: [
          DAY_LONG[s.day],
          DAY_SHORT[s.day],
          s.room,
          ...(s.altRooms ?? []),
          s.kind === 'lecture' ? 'Vorlesung Lecture' : 'Übung Exercise Recitation',
          c.name,
          aliases,
        ].join(' '),
        courseId: c.id,
        target: { kind: 'route', to: `/courses/${c.id}` },
      });
    }

    for (const l of c.links) {
      docs.push({
        id: `link:${c.id}:${l.url}`,
        type: 'link',
        title: l.label,
        subtitle: `${c.name} · ${host(l.url)}`,
        text: `${l.url} ${l.kind} ${c.name} ${aliases}`,
        courseId: c.id,
        target: { kind: 'external', url: l.url },
      });
    }
  }

  for (const t of tasks) {
    const c = course(t.courseId);
    docs.push({
      id: `task:${t.id}`,
      type: 'deadline',
      title: t.title,
      subtitle: `${c?.name ?? ''} · fällig ${fmtDateShort(parseLocal(t.due))}`,
      text: `Aufgabe Abgabe Deadline Task Hausaufgabe ${c?.name ?? ''} ${c?.aliases.join(' ') ?? ''}`,
      courseId: t.courseId,
      target: { kind: 'route', to: '/tasks' },
    });
  }

  for (const e of exams) {
    const c = course(e.courseId);
    const d = parseLocal(e.when);
    docs.push({
      id: `exam:${e.id}`,
      type: 'exam',
      title: e.title,
      subtitle: `${c?.name ?? ''} · ${fmtDateShort(d)}, ${fmtTime(d)}`,
      text: `Prüfung Klausur Exam Assessment ${e.location ?? ''} ${c?.name ?? ''} ${c?.aliases.join(' ') ?? ''}`,
      courseId: e.courseId,
      target: { kind: 'route', to: '/tasks' },
    });
  }

  for (const n of notes) {
    const c = course(n.courseId);
    docs.push({
      id: `note:${n.id}`,
      type: 'note',
      title: n.title,
      subtitle: `Notiz · ${c?.name ?? ''}`,
      text: `${n.blocks.map((b) => b.text).join(' ')} ${c?.name ?? ''} ${c?.aliases.join(' ') ?? ''}`,
      courseId: n.courseId,
      target: { kind: 'route', to: `/notes/${n.id}` },
    });
    for (const b of n.blocks) {
      if (b.type !== 'h2' && b.type !== 'h3') continue;
      docs.push({
        id: `topic:${n.id}:${slug(b.text)}`,
        type: 'topic',
        title: b.text,
        subtitle: `${n.title} · ${c?.name ?? ''}`,
        text: `${c?.name ?? ''} ${c?.aliases.join(' ') ?? ''}`,
        courseId: n.courseId,
        target: { kind: 'route', to: `/notes/${n.id}?h=${slug(b.text)}` },
      });
    }
  }

  for (const l of adminLinks) {
    docs.push({
      id: `admin:${l.url}`,
      type: 'link',
      title: l.label,
      subtitle: l.description ?? host(l.url),
      text: `${l.url} Admin Administratives Studium Curriculum MAVT ${l.description ?? ''}`,
      target: { kind: 'external', url: l.url },
    });
  }

  docs.push(
    {
      id: 'action:add-exam',
      type: 'action',
      title: 'Prüfungstermin eintragen',
      subtitle: 'Wird nur in dieser App gespeichert',
      text: 'Prüfung Prüfungen Klausur Exam Termin hinzufügen Assessment Session',
      target: { kind: 'action', action: 'add-exam' },
    },
    {
      id: 'action:add-task',
      type: 'action',
      title: 'Aufgabe hinzufügen',
      subtitle: 'Wird nur in dieser App gespeichert',
      text: 'Aufgabe Deadline Abgabe Task neu hinzufügen',
      target: { kind: 'action', action: 'add-task' },
    },
  );

  return docs;
}

export interface SearchHit {
  id: string;
  type: SearchType;
  title: string;
  subtitle: string;
  courseId?: string;
  target: Target;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  items: SearchHit[];
}

export function createSearch(input: SearchInput) {
  const docs = buildDocs(input);
  const mini = new MiniSearch<SearchDoc>({
    fields: ['title', 'subtitle', 'text'],
    storeFields: ['type', 'title', 'subtitle', 'courseId', 'target'],
    processTerm: (t) => normalize(t) || null,
    searchOptions: {
      boost: { title: 3, subtitle: 1.5 },
      prefix: (term) => !/^\d+$/.test(term),
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
      // A course is almost always what "Analysis 1" or "Mechanik" is meant to find.
      boostDocument: (_id, _term, stored) => TYPE_BOOST[(stored?.type as SearchType) ?? 'course'] ?? 1,
    },
  });
  mini.addAll(docs);

  const asHit = (r: { id: string } & Record<string, unknown>): SearchHit => ({
    id: r.id,
    type: r.type as SearchType,
    title: r.title as string,
    subtitle: r.subtitle as string,
    courseId: r.courseId as string | undefined,
    target: r.target as Target,
  });

  return {
    search(query: string): SearchHit[] {
      const q = query.trim();
      if (!q) return [];
      return mini.search(q).map(asHit);
    },
    /** What to show for an empty query: the courses and the quick actions. */
    browse(): SearchHit[] {
      return docs
        .filter((d) => d.type === 'course' || d.type === 'action')
        .map((d) => ({ id: d.id, type: d.type, title: d.title, subtitle: d.subtitle, courseId: d.courseId, target: d.target }));
    },
  };
}

export function groupHits(hits: SearchHit[], perGroup = 5): SearchGroup[] {
  return TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABEL[type],
    items: hits.filter((h) => h.type === type).slice(0, perGroup),
  })).filter((g) => g.items.length > 0);
}
