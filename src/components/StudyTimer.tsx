import { useEffect, useState } from 'react';
import { COURSES, courseById } from '../lib/data';
import { useNow } from '../lib/now';
import { suggestCourse } from '../lib/schedule';
import { usePersonal } from '../lib/store';
import { completeIfDue, fmtMinutes, remainingMs, startTimer, stopTimer, useTimer, weekStats, type RunningTimer } from '../lib/timer';
import { toast } from './toast';
import { CourseDot, Icon, SectionHead, cvar } from './ui';

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Re-render every second while `on` – only while a timer runs, nothing ticks otherwise. */
function useTick(on: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setN((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [on]);
  return Date.now();
}

/** Three soft tones – "done", without needing any permission. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22, 0.44].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = [660, 880, 990][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* no audio – the toast still says it */
  }
}

const nameOf = (t: RunningTimer) => courseById(t.courseId)?.shortName ?? 'Lernen';

export function startStudy(courseId: string, minutes: number) {
  startTimer(courseId, minutes);
  toast({ text: `${minutes} min ${courseById(courseId)?.shortName ?? ''} – los geht's. Handy weg 😉` }, 3000);
}

export function stopStudy() {
  const m = stopTimer();
  toast({ text: m ? `${fmtMinutes(m)} gespeichert` : 'Gestoppt – unter 5 Minuten wird nicht gezählt' }, 3000);
}

/**
 * Mounted once in the shell: finishes the timer when its time is up (also if the app was closed
 * meanwhile), shows the countdown in the tab title and as a small floating pill.
 */
export function StudyTimerHost() {
  const timer = useTimer();
  const now = useTick(!!timer);

  useEffect(() => {
    if (!timer) return;
    const done = completeIfDue(now);
    if (done) {
      chime();
      toast({ text: `Fertig: ${fmtMinutes(done.minutes)} ${nameOf(done)}. Zeit für eine Pause!` }, 6000);
    }
  }, [timer, now]);

  // "⏱ 12:34 · Analysis I" in the tab while running, the page's own title otherwise
  useEffect(() => {
    const strip = (t: string) => t.replace(/^⏱ \S+ · /, '');
    if (!timer) {
      document.title = strip(document.title);
      return;
    }
    document.title = `⏱ ${mmss(remainingMs(timer, now))} · ${strip(document.title)}`;
  }, [timer, now]);

  if (!timer) return null;
  const course = courseById(timer.courseId);
  return (
    <div className="timer-pill" style={cvar(course?.color ?? '#888')} role="status" aria-label={`Lernblock ${nameOf(timer)} läuft`}>
      <CourseDot color={course?.color ?? '#888'} />
      <span className="timer-pill__name">{nameOf(timer)}</span>
      <strong className="timer-pill__time">{mmss(remainingMs(timer, now))}</strong>
      <button type="button" className="timer-pill__stop" onClick={stopStudy} aria-label="Lernblock beenden">
        <Icon name="stop" size={14} />
      </button>
    </div>
  );
}

/** "25 min lernen" / "50 min" on a course page – or the running block with a stop button. */
export function StudyStart({ courseId }: { courseId: string }) {
  const timer = useTimer();
  const now = useTick(timer?.courseId === courseId);
  if (timer?.courseId === courseId) {
    return (
      <div className="study-start">
        <span className="study-start__live"><span className="study-start__pulse" />Lernblock läuft · noch {mmss(remainingMs(timer, now))}</span>
        <button type="button" className="btn btn--sm" onClick={stopStudy}><Icon name="stop" size={14} />Beenden</button>
      </div>
    );
  }
  return (
    <div className="study-start" data-noswipe>
      <button type="button" className="btn btn--sm" onClick={() => startStudy(courseId, 25)}><Icon name="timer" size={16} />25 min lernen</button>
      <button type="button" className="btn btn--sm" onClick={() => startStudy(courseId, 50)}>50 min</button>
    </div>
  );
}

/** Today page: what you studied this week, per course, and a one-tap start. */
export function StudyWeek() {
  const { synced, local } = usePersonal();
  const now = useNow();
  const timer = useTimer();
  const stats = weekStats(Object.values(synced.study), now);
  const suggested = suggestCourse(now, COURSES, synced.prefs, local.lastCourse && courseById(local.lastCourse) ? local.lastCourse : COURSES[0].id);
  const [picked, setPicked] = useState<string | null>(null);
  const courseId = picked ?? suggested;
  const max = Math.max(1, stats.total);

  const course = courseById(courseId);
  return (
    <section className="dash__study" aria-labelledby="h-study">
      <SectionHead id="h-study" title="Lernzeit" action={<span className="count">diese Woche</span>} />
      <div className="panel panel--pad study">
        <p className="study__total">
          <strong>{fmtMinutes(stats.total)}</strong>
          <span>{stats.sessions === 0 ? 'noch nichts diese Woche' : `${stats.sessions} ${stats.sessions === 1 ? 'Lernblock' : 'Lernblöcke'}`}</span>
        </p>
        {stats.total > 0 && (
          <>
            <div className="study__bar" aria-hidden="true">
              {stats.byCourse.map((c) => (
                <span key={c.courseId} style={{ ...cvar(courseById(c.courseId)?.color ?? '#888'), width: `${(c.minutes / max) * 100}%` }} />
              ))}
            </div>
            <ul className="study__legend">
              {stats.byCourse.map((c) => (
                <li key={c.courseId}><CourseDot color={courseById(c.courseId)?.color ?? '#888'} />{courseById(c.courseId)?.shortName ?? c.courseId}<span>{fmtMinutes(c.minutes)}</span></li>
              ))}
            </ul>
          </>
        )}
        {!timer && (
          // One line: which course (a plain select – no chip wall) and two start buttons
          <div className="study__start" data-noswipe>
            <label className="select-pill is-set" style={cvar(course?.color ?? '#888')}>
              <span className="dot" aria-hidden="true" />
              <select value={courseId} onChange={(e) => setPicked(e.target.value)} aria-label="Fach für den Lernblock">
                {COURSES.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
              </select>
              <Icon name="chevron-down" size={14} />
            </label>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={() => startStudy(courseId, 50)}>50 min</button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => startStudy(courseId, 25)}><Icon name="timer" size={16} />25 min</button>
          </div>
        )}
      </div>
    </section>
  );
}
