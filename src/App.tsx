import { useEffect, type ReactNode } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Assistant } from './components/Assistant';
import { StudyTimerHost } from './components/StudyTimer';
import { EditorSheet } from './components/EditorSheet';
import { MemoSheet } from './components/MemoSheet';
import { LinkSheet } from './components/LinkSheet';
import { NavDrawer, TopBar } from './components/Nav';
import { ReminderHost } from './components/Reminders';
import { SearchOverlay } from './components/SearchOverlay';
import { ShortcutsSheet, useGlobalShortcuts } from './components/Shortcuts';
import { Toasts } from './components/toast';
import { UIProvider } from './components/ui-context';
import { useMediaQuery } from './lib/hooks';
import { getNow, isSimulatedTime } from './lib/now';
import { usePersonal } from './lib/store';
import { fmtDateShort, fmtTime } from './lib/time';
import { BonusPage } from './pages/Bonus';
import { CoursePage } from './pages/CoursePage';
import { CoursesPage } from './pages/Courses';
import { LinksPage } from './pages/Links';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/Notes';
import { SettingsPage } from './pages/Settings';
import { TasksPage } from './pages/Tasks';
import { TodayPage } from './pages/Today';
import { WeekPage } from './pages/Week';

const BG = { light: '#f6f5f1', dark: '#111214' };

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const theme = usePersonal().local.theme;
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  useGlobalShortcuts();

  // Theme + matching browser/status bar colour
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const dark = theme === 'dark' || (theme === 'system' && systemDark);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? BG.dark : BG.light));
  }, [theme, systemDark]);

  useEffect(() => {
    if (!window.location.hash.includes('h=')) window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      {isSimulatedTime && <p className="sim-banner">Simulierte Zeit: {fmtDateShort(getNow())}, {fmtTime(getNow())}</p>}
      <TopBar />
      <NavDrawer />
      <main className="main">
        <div className="page">{children}</div>
      </main>
      <ReminderHost />
      <SearchOverlay />
      <EditorSheet />
      <MemoSheet />
      <LinkSheet />
      <Assistant />
      <StudyTimerHost />
      <ShortcutsSheet />
      <Toasts />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <UIProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/week" element={<WeekPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:id" element={<CoursePage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/notes/:id" element={<NotePage />} />
            <Route path="/bonus" element={<BonusPage />} />
            <Route path="/links" element={<LinksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<TodayPage />} />
          </Routes>
        </Shell>
      </UIProvider>
    </HashRouter>
  );
}
