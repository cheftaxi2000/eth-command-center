import { useEffect } from 'react';
import { targetOf } from '../lib/data';
import { getNow } from '../lib/now';
import { markShown, refreshPushSubscription, showSystemNotification, wasShown } from '../lib/notify';
import { dueReminders, reminderTag, reminderText } from '../lib/reminders';
import { getPersonal } from '../lib/store';
import { toast } from './toast';

/**
 * Mounted once: while the app is open it checks every 30 s whether a reminder of an important to-do
 * is due – then an in-app toast plus (with permission) a system notification. Closed-app reminders
 * come from the Web Push service with the same tag, so a reminder never shows twice.
 */
export function ReminderHost() {
  useEffect(() => {
    void refreshPushSubscription();
    const check = () => {
      const { synced } = getPersonal();
      const now = +getNow();
      for (const r of dueReminders(Object.values(synced.todos), now, wasShown)) {
        const todo = synced.todos[r.todoId];
        const { title, body } = reminderText(r, todo, targetOf(todo.courseId).shortName, now);
        markShown(r.covers, now);
        toast({ text: `⏰ ${title} · ${body}` }, 9000);
        void showSystemNotification(title, body, reminderTag(r));
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
