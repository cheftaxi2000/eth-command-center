import MiniSearch from 'minisearch';
import { COURSE_EXERCISES } from '../data/exercises';
import type { AdminLink, Course, Note, Task } from '../types';
import { hostOf as host } from './links';
import { KIND_LABEL } from './schedule';
import { GENERAL_ID, type Exam, type Memo, type OwnLink, type Todo } from './state';
import { DAY_LONG, DAY_SHORT, dueMoment, fmtDateShort, fmtTime, isAllDay, parseLocal } from './time';

export type SearchType = 'course' | 'todo' | 'deadline' | 'exam' | 'exercise' | 'session' | 'note' | 'memo' | 'topic' | 'instructor' | 'link' | 'action';

export type Target =
  | { kind: 'route'; to: string }
  | { kind: 'external'; url: string }
  | { kind: 'todo'; id: string }
  | { kind: 'exam'; id: string }
  | { kind: 'memo'; id: string }
  | { kind: 'action'; action: 'add-todo' | 'add-exam' | 'add-link' };

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
  todos: Todo[];
  exams: Exam[];
  memos: Memo[];
  links: OwnLink[];
}

export const TYPE_LABEL: Record<SearchType, string> = {
  course: 'Kurse',
  todo: 'Meine To-dos',
  deadline: 'Abgaben',
  exam: 'Prüfungen',
  exercise: 'Übungen & Bonus',
  session: 'Termine',
  note: 'Notizen',
  memo: 'Meine Notizen',
  topic: 'Themen',
  instructor: 'Dozenten',
  link: 'Links',
  action: 'Aktionen',
};

const TYPE_ORDER: SearchType[] = ['course', 'todo', 'memo', 'deadline', 'exercise', 'exam', 'session', 'note', 'topic', 'instructor', 'link', 'action'];
const TYPE_BOOST: Partial<Record<SearchType, number>> = { course: 1.8, todo: 1.2, memo: 1.1, action: 0.7, session: 0.9 };

export const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slug = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const instructorNames = (s: string) =>
  s.split(',').map((p) => p.trim()).filter((p) => p && !/^u\.\s*a\.$/i.test(p));

/** Course mentioned in free text ("Mechanik Übung 3 nachrechnen" -> mechanik-1), for quick capture */
export function detectCourse(text: string, courses: Course[]): string | null {
  const hay = ` ${normalize(text).replace(/[^a-z0-9+]+/g, ' ')} `;
  let best: { id: string; len: number } | null = null;
  for (const c of courses) {
    for (const name of [c.name, c.shortName, ...c.aliases]) {
      const full = normalize(name).replace(/[^a-z0-9+]+/g, ' ').trim();
      // "Mechanik I" should also match plain "Mechanik"
      for (const needle of [full, full.replace(/ (i{1,3}|[1-3])$/, '')]) {
        if (needle.length >= 3 && hay.includes(` ${needle} `) && (!best || needle.length > best.len)) {
          best = { id: c.id, len: needle.length };
        }
      }
    }
  }
  return best?.id ?? null;
}

export function buildDocs(input: SearchInput): SearchDoc[] {
  const { courses, tasks, notes, adminLinks, todos, exams, memos, links } = input;
  const course = (id: string) => courses.find((c) => c.id === id);
  const about = (id: string) => {
    const c = course(id);
    return c ? `${c.name} ${c.aliases.join(' ')}` : 'Allgemein Admin';
  };
  const docs: SearchDoc[] = [];

  for (const c of courses) {
    docs.push({
      id: `course:${c.id}`,
      type: 'course',
      title: c.name,
      subtitle: `${c.code} · ${c.instructor}`,
      text: [c.code, c.shortName, c.aliases.join(' '), c.instructor, c.semester].join(' '),
      courseId: c.id,
      target: { kind: 'route', to: `/courses/${c.id}` },
    });
    for (const name of instructorNames(c.instructor)) {
      docs.push({
        id: `inst:${c.id}:${name}`,
        type: 'instructor',
        title: name,
        subtitle: `Dozent · ${c.name}`,
        text: `Dozent Dozentin Professor Instructor Lecturer ${about(c.id)}`,
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
        text: [DAY_LONG[s.day], DAY_SHORT[s.day], s.room, ...(s.altRooms ?? []), s.kind === 'lecture' ? 'Vorlesung Lecture' : 'Übung Exercise Recitation', about(c.id)].join(' '),
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
        text: `${l.url} ${l.kind} ${about(c.id)}`,
        courseId: c.id,
        target: { kind: 'external', url: l.url },
      });
    }
  }

  // Official course exercises and each course's bonus rule – read-only course data, like the seed
  for (const cfg of Object.values(COURSE_EXERCISES)) {
    const c = course(cfg.courseId);
    for (const e of cfg.exercises) {
      const type = cfg.types.find((x) => x.id === e.typeId);
      docs.push({
        id: `exercise:${e.id}`,
        type: 'exercise',
        title: e.title,
        subtitle: `${c?.name ?? ''} · ${type?.label ?? ''}`,
        text: [type?.label, type?.role, type?.where, e.detail, e.dateNote, 'Übung Übungen Aufgabe', about(cfg.courseId)].filter(Boolean).join(' '),
        courseId: cfg.courseId,
        target: { kind: 'route', to: `/courses/${cfg.courseId}` },
      });
    }
    docs.push({
      id: `bonus:${cfg.courseId}`,
      type: 'exercise',
      title: `Bonus: ${c?.name ?? cfg.courseId}`,
      subtitle: cfg.bonus.headline,
      text: [cfg.bonus.max, cfg.bonus.quote, cfg.bonus.facts.map((f) => `${f.q} ${f.a}`).join(' '), 'Bonus Notenbonus Regel Leistung Prüfungsleistung', about(cfg.courseId)].filter(Boolean).join(' '),
      courseId: cfg.courseId,
      target: { kind: 'route', to: `/bonus#${cfg.courseId}` },
    });
  }

  for (const t of todos) {
    const due = t.due ? ` · ${isAllDay(t.due) ? fmtDateShort(dueMoment(t.due)) : `${fmtDateShort(parseLocal(t.due))}, ${t.due.slice(11)}`}` : '';
    docs.push({
      id: `todo:${t.id}`,
      type: 'todo',
      title: t.text,
      subtitle: `${course(t.courseId)?.shortName ?? 'Allgemein'}${due}${t.done ? ' · erledigt' : ''}`,
      text: `To-do Todo Notiz Aufgabe ${about(t.courseId)}`,
      courseId: t.courseId === GENERAL_ID ? undefined : t.courseId,
      target: { kind: 'todo', id: t.id },
    });
  }

  for (const m of memos) {
    docs.push({
      id: `memo:${m.id}`,
      type: 'memo',
      title: m.title,
      subtitle: course(m.courseId)?.shortName ?? 'Allgemein',
      text: `Notiz ${m.body} ${about(m.courseId)}`,
      courseId: m.courseId === GENERAL_ID ? undefined : m.courseId,
      target: { kind: 'memo', id: m.id },
    });
  }

  for (const l of links) {
    docs.push({
      id: `ownlink:${l.id}`,
      type: 'link',
      title: l.label,
      subtitle: `${course(l.courseId)?.name ?? 'Allgemein'} · ${host(l.url)}`,
      text: `${l.url} Link Ressource ${about(l.courseId)}`,
      courseId: l.courseId === GENERAL_ID ? undefined : l.courseId,
      target: { kind: 'external', url: l.url },
    });
  }

  for (const t of tasks) {
    docs.push({
      id: `task:${t.id}`,
      type: 'deadline',
      title: t.title,
      subtitle: `${course(t.courseId)?.name ?? ''} · fällig ${fmtDateShort(parseLocal(t.due))}`,
      text: `Aufgabe Abgabe Deadline Task Hausaufgabe ${about(t.courseId)}`,
      courseId: t.courseId,
      target: { kind: 'route', to: '/tasks' },
    });
  }

  for (const e of exams) {
    const d = parseLocal(e.when);
    docs.push({
      id: `exam:${e.id}`,
      type: 'exam',
      title: e.title,
      subtitle: `${course(e.courseId)?.name ?? ''} · ${fmtDateShort(d)}, ${fmtTime(d)}`,
      text: `Prüfung Klausur Exam Assessment ${e.location ?? ''} ${about(e.courseId)}`,
      courseId: e.courseId,
      target: { kind: 'exam', id: e.id },
    });
  }

  for (const n of notes) {
    docs.push({
      id: `note:${n.id}`,
      type: 'note',
      title: n.title,
      subtitle: `Notiz · ${course(n.courseId)?.name ?? ''}`,
      text: `${n.blocks.map((b) => b.text).join(' ')} ${about(n.courseId)}`,
      courseId: n.courseId,
      target: { kind: 'route', to: `/notes/${n.id}` },
    });
    for (const b of n.blocks) {
      if (b.type !== 'h2' && b.type !== 'h3') continue;
      docs.push({
        id: `topic:${n.id}:${slug(b.text)}`,
        type: 'topic',
        title: b.text,
        subtitle: `${n.title} · ${course(n.courseId)?.name ?? ''}`,
        text: about(n.courseId),
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
      id: 'action:add-todo',
      type: 'action',
      title: 'To-do hinzufügen',
      subtitle: 'Für ein Fach oder allgemein',
      text: 'To-do Todo Notiz Aufgabe neu hinzufügen erstellen',
      target: { kind: 'action', action: 'add-todo' },
    },
    {
      id: 'action:add-exam',
      type: 'action',
      title: 'Prüfungstermin eintragen',
      subtitle: 'Steht nicht in Notion – wird nur in dieser App gespeichert',
      text: 'Prüfung Prüfungen Klausur Exam Termin hinzufügen Assessment Session',
      target: { kind: 'action', action: 'add-exam' },
    },
    {
      id: 'action:add-link',
      type: 'action',
      title: 'Link hinzufügen',
      subtitle: 'Unter Ressourcen – Moodle, Skript, Aufzeichnungen …',
      text: 'Link Links URL Adresse Ressource Ressourcen Webseite Lesezeichen Bookmark hinzufügen speichern',
      target: { kind: 'action', action: 'add-link' },
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
      boostDocument: (_id, _term, stored) => TYPE_BOOST[(stored?.type as SearchType) ?? 'course'] ?? 1,
    },
  });
  mini.addAll(docs);

  const asHit = (d: { id: string } & Record<string, unknown>): SearchHit => ({
    id: d.id,
    type: d.type as SearchType,
    title: d.title as string,
    subtitle: d.subtitle as string,
    courseId: d.courseId as string | undefined,
    target: d.target as Target,
  });

  return {
    search: (query: string): SearchHit[] => (query.trim() ? mini.search(query.trim()).map(asHit) : []),
    /** Empty query: courses and quick actions */
    browse: (): SearchHit[] =>
      docs
        .filter((d) => d.type === 'course' || d.type === 'action')
        .map(({ id, type, title, subtitle, courseId, target }) => ({ id, type, title, subtitle, courseId, target })),
  };
}

export function groupHits(hits: SearchHit[], perGroup = 5): SearchGroup[] {
  return TYPE_ORDER.map((type) => ({ type, label: TYPE_LABEL[type], items: hits.filter((h) => h.type === type).slice(0, perGroup) })).filter(
    (g) => g.items.length > 0,
  );
}
