import { TARGETS, targetOf } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { usePersonal } from '../lib/store';
import type { Memo } from '../lib/state';
import { CourseDot, Empty, Icon } from '../components/ui';
import { useUI } from '../components/ui-context';

/** Personal notes, not from Notion – a quiet place for things worth writing down. */
export function NotesPage() {
  useTitle('Notizen');
  const { synced } = usePersonal();
  const ui = useUI();
  const memos = Object.values(synced.memos).sort((a, b) => b.updatedAt - a.updatedAt);
  const groups = TARGETS.map((t) => ({ t, list: memos.filter((m) => m.courseId === t.id) })).filter((g) => g.list.length > 0);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Persönlich, nicht aus Notion</p>
          <h1>Notizen</h1>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => ui.openMemoEditor({ mode: 'new' })}>
          <Icon name="plus" size={18} />Notiz
        </button>
      </header>

      {memos.length === 0 ? (
        <Empty>Noch keine Notizen. Zum Beispiel Passwörter, Ideen oder Dinge, die du dir sonst merken müsstest.</Empty>
      ) : (
        <div className="todo-groups">
          {groups.map(({ t, list }) => (
            <section key={t.id} className="todo-group" aria-label={t.name}>
              <h3 className="todo-group__head">
                <span className="todo-group__name"><CourseDot color={t.color} />{t.name}</span>
                <span className="count">{list.length}</span>
              </h3>
              <ul className="list">
                {list.map((m) => <MemoRow key={m.id} memo={m} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export function MemoRow({ memo, hideCourse }: { memo: Memo; hideCourse?: boolean }) {
  const ui = useUI();
  const target = targetOf(memo.courseId);
  const preview = memo.body.replace(/\s+/g, ' ').trim();
  return (
    <li>
      <button type="button" className="row row--link memo-row" onClick={() => ui.openMemoEditor({ mode: 'edit', id: memo.id })}>
        <Icon name="note" size={20} />
        <span className="row__main">
          <span className="row__title">{memo.title}</span>
          <span className="row__meta">
            {!hideCourse && <span className="meta-course"><CourseDot color={target.color} />{target.shortName}</span>}
            {preview && <span className="memo-row__preview">{preview}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}
