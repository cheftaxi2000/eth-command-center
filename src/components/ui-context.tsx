import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface AddRequest {
  kind: 'task' | 'exam';
  courseId?: string;
}

interface UI {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  add: AddRequest | null;
  openAdd: (kind: AddRequest['kind'], courseId?: string) => void;
  closeAdd: () => void;
}

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [add, setAdd] = useState<AddRequest | null>(null);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openAdd = useCallback((kind: AddRequest['kind'], courseId?: string) => setAdd({ kind, courseId }), []);
  const closeAdd = useCallback(() => setAdd(null), []);

  const value = useMemo(
    () => ({ searchOpen, openSearch, closeSearch, add, openAdd, closeAdd }),
    [searchOpen, openSearch, closeSearch, add, openAdd, closeAdd],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI outside UIProvider');
  return v;
}
