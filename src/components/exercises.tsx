import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { targetOf, useItems, type Item } from '../lib/data';
import { bonusFromFormula, configOf, goalProgress, roleLabel, rolesInUse, tallyValue, type GoalProgress } from '../lib/exercises';
import { useNow } from '../lib/now';
import { actions, usePersonal } from '../lib/store';
import type { CourseExercises, SourceRef } from '../types';
import { ItemRow } from './rows';
import { Chip, Icon, SectionHead, cx } from './ui';

/**
 * The official exercises of a course, grouped the way THAT course groups them (its own types and
 * wording), plus its bonus rule. Nothing here is editable – the definitions come from the read-only
 * course data, only the check-offs belong to the student.
 */

const pct = (have: number, need: number) => (need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 0);

export function GoalBar({ p }: { p: GoalProgress }) {
  const need = p.required ?? p.of;
  return (
    <div className="goal">
      <div className="goal__head">
        <span>{p.label}</span>
        <span className={cx('goal__num', p.reached && 'is-done')}>
          {p.have}{need !== undefined && ` / ${need}`}
          {p.reached && <Icon name="check" size={14} />}
        </span>
      </div>
      {need !== undefined && (
        <div className="bar" role="img" aria-label={`${p.have} von ${need}`}>
          <div className={cx('bar__fill', p.reached && 'is-done')} style={{ width: `${pct(p.have, need)}%` }} />
        </div>
      )}
      {p.hint && <p className="hint">{p.hint}</p>}
    </div>
  );
}

/** A counter for things a course has no individual entries for ("10 Serien abgegeben"). */
export function Tally({ tallyId, label, required }: { tallyId: string; label: string; required?: number }) {
  const { synced } = usePersonal();
  const value = tallyValue(synced, tallyId);
  return (
    <div className="tally">
      <span className="tally__label">{label}</span>
      <div className="tally__controls">
        <button type="button" className="icon-btn" aria-label="Eins weniger" onClick={() => actions.setExerciseCount(tallyId, value - 1)} disabled={value === 0}>–</button>
        <span className={cx('tally__value', required !== undefined && value >= required && 'is-done')}>
          {value}{required !== undefined && ` / ${required}`}
        </span>
        <button type="button" className="icon-btn" aria-label="Eins mehr" onClick={() => actions.setExerciseCount(tallyId, value + 1)}>+</button>
      </div>
    </div>
  );
}

/** Compact bonus state for the course page – the details live on /bonus. */
export function BonusCard({ courseId }: { courseId: string }) {
  const { synced } = usePersonal();
  const cfg = configOf(courseId);
  if (!cfg) return null;
  const goals = goalProgress(courseId, synced);
  const value = bonusFromFormula(courseId, synced);
  return (
    <div className="panel panel--pad bonus-card">
      <div className="bonus-card__head">
        <p className="eyebrow">{cfg.bonus.kind === 'graded-performance' ? 'Prüfungsleistung' : 'Bonus'}</p>
        <p className="bonus-card__line">{cfg.bonus.headline}</p>
      </div>
      {goals.map((g) => (g.goal.metric === 'count' && g.goal.tallyId
        ? <Tally key={g.goal.id} tallyId={g.goal.tallyId} label={g.label} required={g.required} />
        : <GoalBar key={g.goal.id} p={g} />))}
      {value && <p className="hint">Aktuell: <strong>{value.text}</strong> ({cfg.bonus.formula?.note})</p>}
    </div>
  );
}

/**
 * Which kinds of exercise the week view shows. Multi-select, stored in the synced preferences, so
 * the choice is the same on every device. It filters the view – exercise data is never touched.
 */
export function ExerciseFilter() {
  const { synced } = usePersonal();
  const roles = rolesInUse();
  const picked = synced.prefs.weekExerciseRoles;
  const isOn = (r: string) => !picked || picked.includes(r);
  const toggle = (r: string) => {
    const cur: string[] = picked ?? roles;
    const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
    actions.setWeekExerciseRoles(next.length === roles.length ? null : next);
  };
  if (roles.length === 0) return null;
  return (
    <div className="exfilter" data-noswipe>
      <span className="exfilter__label">Übungen anzeigen</span>
      <div className="filters" role="group" aria-label="Übungsarten im Wochenplan">
        <button type="button" className={cx('filter', !picked && 'is-on')} aria-pressed={!picked} onClick={() => actions.setWeekExerciseRoles(null)}>Alle</button>
        {roles.map((r) => (
          <button key={r} type="button" className={cx('filter', isOn(r) && 'is-on')} aria-pressed={isOn(r)} onClick={() => toggle(r)}>
            {roleLabel(r)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: SourceRef[] }) {
  return (
    <p className="sources">
      Quellen:{' '}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}<Icon name="external" size={13} /></a>
        </span>
      ))}
      {sources[0] && <span className="muted-tag"> · geprüft {sources[0].retrieved}</span>}
    </p>
  );
}

/** The full rule for one course: what counts, how much, what could not be verified. */
export function BonusDetail({ cfg }: { cfg: CourseExercises }) {
  const { synced } = usePersonal();
  const goals = goalProgress(cfg.courseId, synced);
  const value = bonusFromFormula(cfg.courseId, synced);
  const target = targetOf(cfg.courseId);
  return (
    <section className="bonus-detail" id={cfg.courseId}>
      <div className="bonus-detail__head">
        <h2>{target.name}</h2>
        <Chip tone={cfg.bonus.kind === 'none' ? undefined : 'accent'}>{cfg.bonus.max ?? (cfg.bonus.kind === 'graded-performance' ? 'Semesterleistung' : 'kein Bonus')}</Chip>
      </div>
      <p className="bonus-detail__headline">{cfg.bonus.headline}</p>

      <div className="panel panel--pad">
        {goals.map((g) => (g.goal.metric === 'count' && g.goal.tallyId
          ? <Tally key={g.goal.id} tallyId={g.goal.tallyId} label={g.label} required={g.required} />
          : <GoalBar key={g.goal.id} p={g} />))}
        {value && <p className="hint">Daraus ergibt sich aktuell ein Zuschlag von <strong>{value.text}</strong> – Formel {cfg.bonus.formula?.note}.</p>}
      </div>

      <dl className="kv facts">
        {cfg.bonus.facts.map((f) => (
          <Fragment key={f.q}>
            <dt>{f.q}</dt>
            <dd>{f.a}</dd>
          </Fragment>
        ))}
      </dl>

      {cfg.bonus.quote && (
        <blockquote className="quote">
          <p>„{cfg.bonus.quote}"</p>
          {cfg.bonus.quoteSource && (
            <cite>
              <a href={cfg.bonus.quoteSource.url} target="_blank" rel="noopener noreferrer">{cfg.bonus.quoteSource.label}<Icon name="external" size={13} /></a>
            </cite>
          )}
        </blockquote>
      )}

      {cfg.rhythm && <p className="hint hint--block">{cfg.rhythm}</p>}

      {cfg.unverified.length > 0 && (
        <div className="unverified">
          <p className="unverified__head"><Icon name="alert" size={16} />Nicht verifiziert – steht hinter einem Login oder ist noch offen:</p>
          <ul>{cfg.unverified.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
      )}

      <Sources sources={cfg.sources} />
    </section>
  );
}

/**
 * All official exercises of one course, grouped by the course's own types. Empty groups are left
 * out, and no course is forced into a "Bonus" section it does not have.
 */
export function ExerciseSections({ courseId }: { courseId: string }) {
  const now = useNow();
  const items = useItems();
  const cfg = configOf(courseId);
  if (!cfg) return null;
  const mine = items.filter((i) => i.kind === 'exercise' && i.courseId === courseId);
  const groups = cfg.types
    .map((t) => ({ type: t, list: mine.filter((i) => i.exercise!.typeId === t.id) }))
    .filter((g) => g.list.length > 0);
  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="h-exercises">
      <SectionHead id="h-exercises" title="Übungen des Kurses"
        action={<Link className="more" to={`/bonus#${courseId}`}>Bonusregel<Icon name="chevron-right" size={16} /></Link>} />
      <BonusCard courseId={courseId} />
      {groups.map(({ type, list }) => {
        const open = list.filter((i) => !i.done).length;
        return (
          <div key={type.id} className="exgroup">
            <h3 className="todo-group__head">
              <span className="todo-group__name">{type.label}</span>
              <span className="count">{open > 0 ? `${open} offen` : 'alles abgehakt'}</span>
            </h3>
            {type.note && <p className="hint">{type.note}</p>}
            <ul className="panel list">
              {list.map((i) => <ItemRow key={i.id} item={i} now={now} hideCourse detailed />)}
            </ul>
          </div>
        );
      })}
      <p className="hint hint--block">
        Offizielle Angaben des Kurses – hier nur abhakbar, nicht bearbeitbar.{' '}
        <Link to={`/bonus#${courseId}`}>Woher die Angaben kommen</Link>
      </p>
    </section>
  );
}

/** Items of one course that the user themselves created (for the "Meine To-dos" section). */
export const ownTodos = (items: Item[], courseId: string) => items.filter((i) => i.kind === 'todo' && i.courseId === courseId);
