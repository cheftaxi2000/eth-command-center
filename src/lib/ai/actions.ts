import { COURSE_EXERCISES, ROLE_LABEL } from '../../data/exercises';
import { COURSES, buildItems, hiddenItems, targetOf } from '../data';
import { exerciseEntry } from '../exercises';
import { normalizeUrl } from '../links';
import { getNow } from '../now';
import { GENERAL_ID } from '../state';
import { actions as store, getPersonal } from '../store';
import { dueMoment, fmtDateShort, fmtTime, isAllDay, toLocalDate } from '../time';
import { endsAt, fmtMinutes, getTimer, startTimer, stopTimer, weekStats } from '../timer';
import { buildAIDynamicContext, buildAIPermanentContext } from './context';

/**
 * The ONLY way an AI may change anything in this app.
 *
 * A model never touches the store, localStorage or the sync directly. It emits a named call with
 * named parameters; this layer validates it against a declared schema and then runs the very same
 * store action the UI uses – so a to-do created by the assistant is indistinguishable from one
 * typed into the composer, syncs the same way and updates every counter in the same render.
 *
 * Anything destructive carries `confirm: true` and is NOT executed by executeAction(); the caller
 * gets it back as "pending" and has to ask the user first (see service.ts).
 */

export type ParamType = 'string' | 'text' | 'boolean' | 'integer' | 'date' | 'due' | 'datetime' | 'subject' | 'id' | 'enum' | 'url';

export interface ParamDef {
  type: ParamType;
  description: string;
  required?: boolean;
  /** only for type 'enum' */
  values?: readonly string[];
}

export interface ActionResult {
  ok: boolean;
  action: string;
  /** Short sentence in German, safe to show to the user as-is. */
  message: string;
  data?: unknown;
  errors?: string[];
}

export interface ActionDef {
  name: string;
  description: string;
  params: Record<string, ParamDef>;
  /** Reads only – can always run, never needs confirmation. */
  readOnly?: boolean;
  /** Destructive – requires an explicit yes from the user before it runs. */
  confirm?: boolean;
  run: (p: Record<string, unknown>) => ActionResult;
}

export interface ActionCall {
  action: string;
  params: Record<string, unknown>;
}

/* ---------- parameter validation ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Maps whatever the model wrote ("Analysis", "ana 1", "allgemein") onto a real course id. */
export function resolveSubject(raw: string): string | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  if (q === GENERAL_ID || q === 'allgemein' || q === 'general') return GENERAL_ID;
  for (const c of COURSES) {
    const names = [c.id, c.name, c.shortName, c.code, ...c.aliases].map((n) => n.toLowerCase());
    if (names.includes(q)) return c.id;
  }
  // Fall back to a containment match, longest alias first so "Analysis I" beats "Analysis"
  const scored = COURSES.flatMap((c) => [c.name, c.shortName, ...c.aliases].map((n) => ({ id: c.id, n: n.toLowerCase() })))
    .filter(({ n }) => q.includes(n) || n.includes(q))
    .sort((a, b) => b.n.length - a.n.length);
  return scored[0]?.id ?? null;
}

function coerce(name: string, def: ParamDef, raw: unknown, errors: string[]): unknown {
  if (raw === undefined || raw === null || raw === '') {
    if (def.required) errors.push(`"${name}" fehlt.`);
    return undefined;
  }
  switch (def.type) {
    case 'string':
    case 'text': {
      const s = String(raw).trim();
      if (!s && def.required) errors.push(`"${name}" ist leer.`);
      return s;
    }
    case 'id':
      return String(raw).trim();
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === 'false') return raw === 'true';
      errors.push(`"${name}" muss true oder false sein.`);
      return undefined;
    case 'integer': {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        errors.push(`"${name}" muss eine Zahl sein.`);
        return undefined;
      }
      return Math.round(n);
    }
    case 'date':
      if (!DATE_RE.test(String(raw))) {
        errors.push(`"${name}" muss ein Datum im Format JJJJ-MM-TT sein.`);
        return undefined;
      }
      return String(raw);
    case 'datetime':
      if (!DATETIME_RE.test(String(raw))) {
        errors.push(`"${name}" muss JJJJ-MM-TTTHH:MM sein.`);
        return undefined;
      }
      return String(raw);
    case 'due': {
      const s = String(raw);
      if (!DATE_RE.test(s) && !DATETIME_RE.test(s)) {
        errors.push(`"${name}" muss JJJJ-MM-TT oder JJJJ-MM-TTTHH:MM sein.`);
        return undefined;
      }
      return s;
    }
    case 'subject': {
      const id = resolveSubject(String(raw));
      if (!id) {
        errors.push(`Fach "${String(raw)}" gibt es nicht.`);
        return undefined;
      }
      return id;
    }
    case 'enum': {
      const s = String(raw);
      if (!def.values?.includes(s)) {
        errors.push(`"${name}" muss eins von ${def.values?.join(', ')} sein.`);
        return undefined;
      }
      return s;
    }
    case 'url': {
      // Same rule as the link sheet: http(s) only – "javascript:" & co. never reach the store
      const url = normalizeUrl(String(raw));
      if (!url) errors.push(`"${name}" muss eine Web-Adresse (http/https) sein.`);
      return url ?? undefined;
    }
  }
}

export type Validation =
  | { ok: true; def: ActionDef; params: Record<string, unknown> }
  | { ok: false; errors: string[] };

export function validateAction(call: ActionCall): Validation {
  const def = ACTIONS[call.action];
  if (!def) return { ok: false, errors: [`Unbekannte Aktion "${call.action}".`] };

  const errors: string[] = [];
  const params: Record<string, unknown> = {};
  for (const [name, pdef] of Object.entries(def.params)) {
    const value = coerce(name, pdef, (call.params ?? {})[name], errors);
    if (value !== undefined) params[name] = value;
  }
  // Anything the model invented that the action does not declare is dropped, not passed through.
  const unknown = Object.keys(call.params ?? {}).filter((k) => !(k in def.params));
  if (unknown.length > 0) errors.push(`Unbekannte Parameter: ${unknown.join(', ')}.`);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, def, params };
}

/* ---------- helpers shared by the write actions ---------- */

const item = (id: string) => buildItems(getPersonal().synced, getNow()).find((i) => i.id === id);
const fail = (action: string, message: string): ActionResult => ({ ok: false, action, message });
const subjectName = (id: string) => targetOf(id).name;
/** "2026-09-22T13:00" → "Di, 22. Sept., 13:00" – for messages the user reads. */
const human = (due: string) => (isAllDay(due) ? fmtDateShort(dueMoment(due)) : `${fmtDateShort(dueMoment(due))}, ${fmtTime(dueMoment(due))}`);

/* ---------- the registry ---------- */

export const ACTIONS: Record<string, ActionDef> = {
  get_subjects: {
    name: 'get_subjects',
    description: 'Alle Fächer mit Dozent, Zeiten und Räumen.',
    params: {},
    readOnly: true,
    run: () => ({ ok: true, action: 'get_subjects', message: 'Fächer gelesen.', data: buildAIPermanentContext().subjects }),
  },

  get_tasks: {
    name: 'get_tasks',
    description: 'Aufgaben und Fristen lesen, optional nach Status, Fach oder Zeitraum gefiltert.',
    params: {
      status: { type: 'enum', description: 'open | done | all (Standard: open)', values: ['open', 'done', 'all'] },
      subject: { type: 'subject', description: 'Fach, z. B. "Analysis"' },
      withinDays: { type: 'integer', description: 'Nur Aufgaben, die in so vielen Tagen fällig sind' },
    },
    readOnly: true,
    run: (p) => {
      let list = buildAIDynamicContext({ maxItems: 200 }).tasks;
      const status = (p.status as string) ?? 'open';
      if (status !== 'all') list = list.filter((t) => t.status === status);
      if (p.subject) list = list.filter((t) => t.subjectId === p.subject);
      if (typeof p.withinDays === 'number') list = list.filter((t) => t.daysLeft !== null && t.daysLeft <= (p.withinDays as number));
      return { ok: true, action: 'get_tasks', message: `${list.length} Aufgaben gefunden.`, data: list };
    },
  },

  get_notes: {
    name: 'get_notes',
    description: 'Eigene Notizen lesen, optional nach Fach oder Stichwort.',
    params: {
      subject: { type: 'subject', description: 'Fach' },
      query: { type: 'string', description: 'Stichwort in Titel oder Text' },
    },
    readOnly: true,
    run: (p) => {
      let list = buildAIDynamicContext({ maxItems: 200, includeNoteBodies: true }).notes;
      if (p.subject) list = list.filter((n) => n.subjectId === p.subject);
      if (p.query) {
        const q = String(p.query).toLowerCase();
        list = list.filter((n) => `${n.title} ${n.body ?? ''}`.toLowerCase().includes(q));
      }
      return { ok: true, action: 'get_notes', message: `${list.length} Notizen gefunden.`, data: list };
    },
  },

  get_schedule: {
    name: 'get_schedule',
    description: 'Stundenplan ab heute für die nächsten Tage (nur lesbar, kommt aus Notion).',
    params: { days: { type: 'integer', description: 'Wie viele Tage voraus (Standard 7)' } },
    readOnly: true,
    run: (p) => {
      const days = typeof p.days === 'number' ? Math.max(1, Math.min(60, p.days)) : 7;
      return { ok: true, action: 'get_schedule', message: `Stundenplan für ${days} Tage.`, data: buildAIDynamicContext({ horizonDays: days }).schedule };
    },
  },

  create_task: {
    name: 'create_task',
    description: 'Neues eigenes To-do anlegen. Für einen zeitgebundenen Termin die Frist mit Uhrzeit angeben.',
    params: {
      title: { type: 'string', description: 'Was zu tun ist', required: true },
      subject: { type: 'subject', description: 'Fach; ohne Angabe "Allgemein"' },
      deadline: { type: 'due', description: 'JJJJ-MM-TT oder JJJJ-MM-TTTHH:MM' },
    },
    run: (p) => {
      const courseId = (p.subject as string) ?? GENERAL_ID;
      const id = store.addTodo({ courseId, text: p.title as string, due: p.deadline as string | undefined });
      return {
        ok: true,
        action: 'create_task',
        message: `To-do „${p.title as string}" für ${subjectName(courseId)} angelegt${p.deadline ? `, fällig ${human(p.deadline as string)}` : ''}.`,
        data: { id },
      };
    },
  },

  update_task: {
    name: 'update_task',
    description: 'Ein eigenes To-do ändern: Text, Fach, Frist oder erledigt-Status.',
    params: {
      id: { type: 'id', description: 'Id der Aufgabe', required: true },
      title: { type: 'string', description: 'Neuer Text' },
      subject: { type: 'subject', description: 'Neues Fach' },
      deadline: { type: 'due', description: 'Neue Frist' },
      done: { type: 'boolean', description: 'Erledigt ja/nein' },
    },
    run: (p) => {
      const id = p.id as string;
      const found = item(id);
      if (!found) return fail('update_task', `Es gibt keine Aufgabe mit der Id "${id}".`);
      if (found.kind === 'notion') {
        if (p.title || p.subject || p.deadline) return fail('update_task', `„${found.title}" kommt aus Notion und lässt sich hier nur abhaken, nicht bearbeiten.`);
        if (typeof p.done !== 'boolean') return fail('update_task', 'Für eine Notion-Aufgabe ist nur "done" möglich.');
        store.setTaskDone(id, p.done);
        return { ok: true, action: 'update_task', message: `„${found.title}" als ${p.done ? 'erledigt' : 'offen'} markiert.`, data: { id } };
      }
      if (found.kind === 'exam') return fail('update_task', `„${found.title}" ist ein Prüfungstermin – bitte update_exam verwenden.`);
      store.updateTodo(id, {
        ...(p.title ? { text: p.title as string } : {}),
        ...(p.subject ? { courseId: p.subject as string } : {}),
        ...(p.deadline ? { due: p.deadline as string } : {}),
        ...(typeof p.done === 'boolean' ? { done: p.done } : {}),
      });
      const what = [p.deadline && `neue Frist ${human(p.deadline as string)}`, p.title && `neuer Text`, p.subject && `neues Fach ${subjectName(p.subject as string)}`, typeof p.done === 'boolean' && (p.done ? 'erledigt' : 'wieder offen')].filter(Boolean).join(', ');
      return { ok: true, action: 'update_task', message: `„${found.title}" geändert${what ? `: ${what}` : ''}.`, data: { id } };
    },
  },

  complete_task: {
    name: 'complete_task',
    description: 'Eine Aufgabe abhaken (funktioniert auch für Notion-Aufgaben).',
    params: { id: { type: 'id', description: 'Id der Aufgabe', required: true } },
    run: (p) => {
      const id = p.id as string;
      const found = item(id);
      if (!found) return fail('complete_task', `Es gibt keine Aufgabe mit der Id "${id}".`);
      if (found.kind === 'exam') return fail('complete_task', 'Ein Prüfungstermin lässt sich nicht abhaken.');
      if (found.kind === 'notion') store.setTaskDone(id, true);
      else store.setTodoDone(id, true);
      return { ok: true, action: 'complete_task', message: `„${found.title}" ist erledigt.`, data: { id } };
    },
  },

  delete_task: {
    name: 'delete_task',
    description: 'Ein eigenes To-do oder eine eigene Prüfung löschen. Eine Aufgabe aus Notion oder eine offizielle Kursübung wird stattdessen nur ausgeblendet – die Quelle bleibt unverändert. Braucht eine Bestätigung.',
    params: { id: { type: 'id', description: 'Id der Aufgabe', required: true } },
    confirm: true,
    run: (p) => {
      const id = p.id as string;
      const found = item(id);
      if (!found) return fail('delete_task', `Es gibt keine Aufgabe mit der Id "${id}".`);
      if (found.kind === 'notion' || found.kind === 'exercise') {
        store.hideItem(id);
        return {
          ok: true,
          action: 'delete_task',
          message: `„${found.title}" ausgeblendet – kommt aus ${found.kind === 'notion' ? 'Notion' : 'dem Kurs'} und bleibt dort unverändert, taucht hier aber nicht mehr auf.`,
          data: { id },
        };
      }
      const removed = found.kind === 'exam' ? store.deleteExam(id) : store.deleteTodo(id);
      return { ok: !!removed, action: 'delete_task', message: removed ? `„${found.title}" gelöscht.` : 'Nichts gelöscht.', data: { id } };
    },
  },

  unhide_item: {
    name: 'unhide_item',
    description: 'Eine zuvor ausgeblendete Notion-Aufgabe oder Kursübung wieder einblenden.',
    params: { id: { type: 'id', description: 'Id der Aufgabe oder Übung', required: true } },
    run: (p) => {
      const id = p.id as string;
      const found = hiddenItems(getPersonal().synced, getNow()).find((i) => i.id === id);
      if (!found) return fail('unhide_item', `„${id}" ist aktuell nicht ausgeblendet.`);
      store.unhideItem(id);
      return { ok: true, action: 'unhide_item', message: `„${found.title}" wieder eingeblendet.`, data: { id } };
    },
  },

  create_note: {
    name: 'create_note',
    description: 'Neue eigene Notiz anlegen.',
    params: {
      title: { type: 'string', description: 'Titel der Notiz', required: true },
      body: { type: 'text', description: 'Inhalt' },
      subject: { type: 'subject', description: 'Fach; ohne Angabe "Allgemein"' },
    },
    run: (p) => {
      const courseId = (p.subject as string) ?? GENERAL_ID;
      const id = store.addMemo({ courseId, title: p.title as string, body: (p.body as string) ?? '' });
      return { ok: true, action: 'create_note', message: `Notiz „${p.title as string}" unter ${subjectName(courseId)} gespeichert.`, data: { id } };
    },
  },

  update_note: {
    name: 'update_note',
    description: 'Eine eigene Notiz ändern.',
    params: {
      id: { type: 'id', description: 'Id der Notiz', required: true },
      title: { type: 'string', description: 'Neuer Titel' },
      body: { type: 'text', description: 'Neuer Inhalt' },
      subject: { type: 'subject', description: 'Neues Fach' },
    },
    run: (p) => {
      const id = p.id as string;
      const memo = getPersonal().synced.memos[id];
      if (!memo) return fail('update_note', `Es gibt keine Notiz mit der Id "${id}".`);
      store.updateMemo(id, {
        ...(p.title ? { title: p.title as string } : {}),
        ...(p.body !== undefined ? { body: p.body as string } : {}),
        ...(p.subject ? { courseId: p.subject as string } : {}),
      });
      return { ok: true, action: 'update_note', message: `Notiz „${memo.title}" geändert.`, data: { id } };
    },
  },

  delete_note: {
    name: 'delete_note',
    description: 'Eine eigene Notiz löschen. Braucht eine Bestätigung.',
    params: { id: { type: 'id', description: 'Id der Notiz', required: true } },
    confirm: true,
    run: (p) => {
      const id = p.id as string;
      const memo = getPersonal().synced.memos[id];
      if (!memo) return fail('delete_note', `Es gibt keine Notiz mit der Id "${id}".`);
      store.deleteMemo(id);
      return { ok: true, action: 'delete_note', message: `Notiz „${memo.title}" gelöscht.`, data: { id } };
    },
  },

  start_study_timer: {
    name: 'start_study_timer',
    description: 'Startet einen Lernblock (Fokus-Timer) für ein Fach. Ein laufender Block wird vorher beendet und gespeichert.',
    params: {
      subject: { type: 'subject', description: 'Fach', required: true },
      minutes: { type: 'integer', description: 'Dauer in Minuten (Standard 25, höchstens 180)' },
    },
    run: (p) => {
      const t = startTimer(p.subject as string, typeof p.minutes === 'number' ? p.minutes : 25);
      const until = new Date(endsAt(t));
      return { ok: true, action: 'start_study_timer', message: `Lernblock gestartet: ${fmtMinutes(t.minutes)} ${subjectName(t.courseId)}, bis ${fmtTime(until)}.` };
    },
  },

  stop_study_timer: {
    name: 'stop_study_timer',
    description: 'Beendet den laufenden Lernblock vorzeitig und speichert die gelernte Zeit (ab 5 Minuten).',
    params: {},
    run: () => {
      if (!getTimer()) return fail('stop_study_timer', 'Es läuft gerade kein Lernblock.');
      const m = stopTimer();
      return { ok: true, action: 'stop_study_timer', message: m ? `Lernblock beendet – ${fmtMinutes(m)} gespeichert.` : 'Lernblock beendet (unter 5 Minuten, nicht gezählt).' };
    },
  },

  get_study_stats: {
    name: 'get_study_stats',
    description: 'Wie viel diese Woche gelernt wurde, gesamt und pro Fach, und ob gerade ein Lernblock läuft.',
    params: {},
    readOnly: true,
    run: () => {
      const s = weekStats(Object.values(getPersonal().synced.study), getNow());
      const running = getTimer();
      return {
        ok: true,
        action: 'get_study_stats',
        message: `Diese Woche ${fmtMinutes(s.total)} gelernt.`,
        data: {
          weekTotal: fmtMinutes(s.total),
          bySubject: s.byCourse.map((c) => ({ subject: subjectName(c.courseId), minutes: c.minutes })),
          running: running ? { subject: subjectName(running.courseId), endsAt: fmtTime(new Date(endsAt(running))) } : null,
        },
      };
    },
  },

  get_links: {
    name: 'get_links',
    description: 'Links lesen (aus Notion und eigene), optional nach Fach.',
    params: { subject: { type: 'subject', description: 'Fach' } },
    readOnly: true,
    run: (p) => {
      let list = buildAIDynamicContext({ maxItems: 200 }).links;
      if (p.subject) list = list.filter((l) => l.subjectId === p.subject);
      return { ok: true, action: 'get_links', message: `${list.length} Links gefunden.`, data: list };
    },
  },

  create_link: {
    name: 'create_link',
    description: 'Eigenen Link unter "Ressourcen" speichern (Moodle, Skript, Aufzeichnungen …). Ohne Namen wird einer aus der Adresse abgeleitet.',
    params: {
      url: { type: 'url', description: 'Die Adresse', required: true },
      label: { type: 'string', description: 'Kurzer Name, z. B. "Skript"' },
      subject: { type: 'subject', description: 'Fach; ohne Angabe "Allgemein"' },
    },
    run: (p) => {
      const courseId = (p.subject as string) ?? GENERAL_ID;
      const url = p.url as string;
      const twin = Object.values(getPersonal().synced.links).find((l) => l.courseId === courseId && l.url === url);
      if (twin) return fail('create_link', `Den Link gibt es bei ${subjectName(courseId)} schon: „${twin.label}".`);
      const id = store.addLink({ courseId, url, label: p.label as string | undefined });
      const saved = id ? getPersonal().synced.links[id] : undefined;
      if (!saved) return fail('create_link', 'Das ist keine gültige Web-Adresse.');
      return { ok: true, action: 'create_link', message: `Link „${saved.label}" unter ${subjectName(courseId)} gespeichert.`, data: { id } };
    },
  },

  update_link: {
    name: 'update_link',
    description: 'Einen eigenen Link ändern: Name, Adresse oder Fach.',
    params: {
      id: { type: 'id', description: 'Id des Links', required: true },
      label: { type: 'string', description: 'Neuer Name' },
      url: { type: 'url', description: 'Neue Adresse' },
      subject: { type: 'subject', description: 'Neues Fach' },
    },
    run: (p) => {
      const id = p.id as string;
      const link = getPersonal().synced.links[id];
      if (!link) return fail('update_link', `Es gibt keinen eigenen Link mit der Id "${id}". Links aus Notion lassen sich nicht ändern.`);
      store.updateLink(id, {
        ...(p.label ? { label: p.label as string } : {}),
        ...(p.url ? { url: p.url as string } : {}),
        ...(p.subject ? { courseId: p.subject as string } : {}),
      });
      return { ok: true, action: 'update_link', message: `Link „${getPersonal().synced.links[id]?.label ?? link.label}" geändert.`, data: { id } };
    },
  },

  delete_link: {
    name: 'delete_link',
    description: 'Einen eigenen Link löschen. Braucht eine Bestätigung.',
    params: { id: { type: 'id', description: 'Id des Links', required: true } },
    confirm: true,
    run: (p) => {
      const id = p.id as string;
      const link = getPersonal().synced.links[id];
      if (!link) return fail('delete_link', `Es gibt keinen eigenen Link mit der Id "${id}". Links aus Notion lassen sich nicht löschen.`);
      store.deleteLink(id);
      return { ok: true, action: 'delete_link', message: `Link „${link.label}" gelöscht.`, data: { id } };
    },
  },

  get_exercises: {
    name: 'get_exercises',
    description: 'Offizielle Kursübungen lesen (Serien, Bonusaufgaben, Quiz, Zwischenprüfungen), optional nach Fach, Art oder Status.',
    params: {
      subject: { type: 'subject', description: 'Fach' },
      role: { type: 'enum', description: 'Art der Übung', values: ['normal', 'bonus', 'quiz', 'assessment', 'project', 'admin'] },
      status: { type: 'enum', description: 'open | done | all (Standard: open)', values: ['open', 'done', 'all'] },
      withinDays: { type: 'integer', description: 'Nur solche, die in so vielen Tagen fällig sind' },
    },
    readOnly: true,
    run: (p) => {
      let list = buildAIDynamicContext({ maxItems: 200 }).exercises;
      const status = (p.status as string) ?? 'open';
      if (status !== 'all') list = list.filter((e) => e.status === status);
      if (p.subject) list = list.filter((e) => e.subjectId === p.subject);
      if (p.role) list = list.filter((e) => e.role === p.role);
      if (typeof p.withinDays === 'number') list = list.filter((e) => e.daysLeft !== null && e.daysLeft <= (p.withinDays as number));
      return { ok: true, action: 'get_exercises', message: `${list.length} Übungen gefunden.`, data: list };
    },
  },

  get_bonus: {
    name: 'get_bonus',
    description: 'Die Bonus- bzw. Leistungsregel eines Fachs samt Fortschritt und dem, was nicht öffentlich bekannt ist.',
    params: { subject: { type: 'subject', description: 'Fach; ohne Angabe alle' } },
    readOnly: true,
    run: (p) => {
      let list = buildAIDynamicContext({ maxItems: 200 }).bonus;
      if (p.subject) list = list.filter((b) => b.subjectId === p.subject);
      return { ok: true, action: 'get_bonus', message: `Bonusregeln für ${list.length} Fächer.`, data: list };
    },
  },

  complete_exercise: {
    name: 'complete_exercise',
    description: 'Eine offizielle Kursübung abhaken (abgegeben). Mit "correct" zusätzlich als korrekt bzw. bestanden markieren.',
    params: {
      id: { type: 'id', description: 'Id der Übung aus dem Kontext', required: true },
      done: { type: 'boolean', description: 'false setzt sie wieder auf offen (Standard: true)' },
      correct: { type: 'boolean', description: 'Korrekt bzw. bestanden' },
    },
    run: (p) => {
      const id = p.id as string;
      const entry = exerciseEntry(id);
      if (!entry) return fail('complete_exercise', `Es gibt keine Kursübung mit der Id "${id}".`);
      const done = typeof p.done === 'boolean' ? p.done : true;
      store.setExerciseDone(id, done);
      if (typeof p.correct === 'boolean') store.setExerciseCorrect(id, p.correct);
      const what = !done ? 'wieder offen' : typeof p.correct === 'boolean' ? (p.correct ? 'erledigt und korrekt' : 'erledigt, nicht korrekt') : 'erledigt';
      return { ok: true, action: 'complete_exercise', message: `„${entry.exercise.title}" (${subjectName(entry.courseId)}) ist ${what}.`, data: { id } };
    },
  },

  set_exercise_counter: {
    name: 'set_exercise_counter',
    description: 'Einen Zähler setzen, den ein Kurs statt einzelner Einträge führt (z. B. abgegebene Chemie-Serien). Die Id steht im Kontext bei der Bonusregel.',
    params: {
      counter: { type: 'id', description: 'Id des Zählers, z. B. "chemistry:series"', required: true },
      count: { type: 'integer', description: 'Neuer Stand', required: true },
    },
    run: (p) => {
      const counter = p.counter as string;
      const known = Object.values(COURSE_EXERCISES).flatMap((c) => c.bonus.goals.map((g) => g.tallyId)).filter(Boolean) as string[];
      if (!known.includes(counter)) return fail('set_exercise_counter', `Unbekannter Zähler "${counter}". Möglich: ${known.join(', ')}.`);
      store.setExerciseCount(counter, p.count as number);
      return { ok: true, action: 'set_exercise_counter', message: `Zähler auf ${p.count as number} gesetzt.`, data: { counter } };
    },
  },

  set_week_exercise_filter: {
    name: 'set_week_exercise_filter',
    description: 'Welche Übungsarten der Wochenplan zeigt. "alle" zeigt wieder alles. Das ist nur ein Filter – es löscht nichts.',
    params: { types: { type: 'string', description: 'Komma-Liste aus normal, bonus, quiz, assessment, project, admin – oder "alle"', required: true } },
    run: (p) => {
      const raw = String(p.types).toLowerCase();
      if (raw.trim() === 'alle' || raw.trim() === 'all') {
        store.setWeekExerciseRoles(null);
        return { ok: true, action: 'set_week_exercise_filter', message: 'Der Wochenplan zeigt wieder alle Übungsarten.' };
      }
      const wanted = raw.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      const unknown = wanted.filter((w) => !(w in ROLE_LABEL));
      if (unknown.length > 0) return fail('set_week_exercise_filter', `Unbekannte Art: ${unknown.join(', ')}.`);
      store.setWeekExerciseRoles(wanted);
      return { ok: true, action: 'set_week_exercise_filter', message: `Der Wochenplan zeigt jetzt: ${wanted.map((w) => ROLE_LABEL[w]).join(', ')}.` };
    },
  },

  create_exam: {
    name: 'create_exam',
    description: 'Eigenen Prüfungstermin eintragen. Der reguläre Stundenplan ist nicht änderbar.',
    params: {
      title: { type: 'string', description: 'Bezeichnung', required: true },
      subject: { type: 'subject', description: 'Fach', required: true },
      when: { type: 'datetime', description: 'JJJJ-MM-TTTHH:MM', required: true },
      location: { type: 'string', description: 'Raum' },
    },
    run: (p) => {
      store.saveExam({ courseId: p.subject as string, title: p.title as string, when: p.when as string, location: p.location as string | undefined });
      return { ok: true, action: 'create_exam', message: `Prüfung „${p.title as string}" am ${human(p.when as string)} eingetragen.` };
    },
  },
};

/** Machine-readable tool definitions – what a provider sends as its function/tool list. */
export function toolSpecs() {
  return Object.values(ACTIONS).map((a) => ({
    name: a.name,
    description: a.description,
    readOnly: !!a.readOnly,
    needsConfirmation: !!a.confirm,
    parameters: Object.fromEntries(
      Object.entries(a.params).map(([k, v]) => [k, { type: v.type, required: !!v.required, description: v.description, ...(v.values ? { values: v.values } : {}) }]),
    ),
  }));
}

/**
 * Validate and run one call. Destructive actions are refused here on purpose – they come back as
 * `needsConfirmation` so the caller can ask first and then use runConfirmed().
 */
export function executeAction(call: ActionCall): ActionResult & { needsConfirmation?: true } {
  const v = validateAction(call);
  if (!v.ok) return { ok: false, action: call.action, message: `Das konnte ich so nicht ausführen: ${v.errors.join(' ')}`, errors: v.errors };
  if (v.def.confirm) {
    return { ok: false, needsConfirmation: true, action: call.action, message: confirmationQuestion(call.action, v.params), data: { action: call.action, params: v.params } };
  }
  return v.def.run(v.params);
}

/** Runs an action the user has just explicitly confirmed. */
export function runConfirmed(call: ActionCall): ActionResult {
  const v = validateAction(call);
  if (!v.ok) return { ok: false, action: call.action, message: v.errors.join(' '), errors: v.errors };
  return v.def.run(v.params);
}

function confirmationQuestion(action: string, params: Record<string, unknown>): string {
  const id = params.id as string | undefined;
  if (action === 'delete_task') {
    const found = id ? item(id) : undefined;
    // A Notion task or course exercise is only ever hidden, not really deleted – the question says so.
    const verb = found && (found.kind === 'notion' || found.kind === 'exercise') ? 'ausblenden' : 'löschen';
    return `Soll ich „${found?.title ?? id ?? ''}" wirklich ${verb}?`;
  }
  if (action === 'delete_note') return `Soll ich die Notiz „${id ? (getPersonal().synced.memos[id]?.title ?? id) : ''}" wirklich löschen?`;
  if (action === 'delete_link') return `Soll ich den Link „${id ? (getPersonal().synced.links[id]?.label ?? id) : ''}" wirklich löschen?`;
  return `Soll ich "${action}" wirklich ausführen?`;
}

export const today = () => toLocalDate(getNow());
