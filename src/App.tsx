import { useEffect, type ReactNode } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AddSheet } from './components/AddSheet';
import { SideNav, TabBar } from './components/Nav';
import { SearchOverlay } from './components/SearchOverlay';
import { UIProvider, useUI } from './components/ui-context';
import { usePersonal } from './lib/store';
import { CoursePage } from './pages/CoursePage';
import { CoursesPage } from './pages/Courses';
import { LinksPage } from './pages/Links';
import { NotePage } from './pages/NotePage';
import { SettingsPage } from './pages/Settings';
import { TasksPage } from './pages/Tasks';
import { TodayPage } from './pages/Today';
import { WeekPage } from './pages/Week';

function Shell({ children }: { children: ReactNode }) {
  const ui = useUI();
  const { pathname } = useLocation();
  const theme = usePersonal().theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  // Ctrl/⌘+K opens the search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.searchOpen ? ui.closeSearch() : ui.openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  useEffect(() => {
    if (!window.location.hash.includes('h=')) window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <SideNav />
      <main className="main">
        <div className="page">{children}</div>
      </main>
      <TabBar />
      <SearchOverlay />
      <AddSheet />
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
            <Route path="/notes/:id" element={<NotePage />} />
            <Route path="/links" element={<LinksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<TodayPage />} />
          </Routes>
        </Shell>
      </UIProvider>
    </HashRouter>
  );
}
