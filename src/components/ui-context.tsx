import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** What the add/edit sheet should show */
export type EditorRequest =
  | { mode: 'new'; kind: 'todo' | 'exam'; courseId?: string; text?: string }
  | { mode: 'edit'; kind: 'todo' | 'exam'; id: string };

interface UI {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  editor: EditorRequest | null;
  openEditor: (req: EditorRequest) => void;
  closeEditor: () => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
}

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openEditor = useCallback((req: EditorRequest) => setEditor(req), []);
  const closeEditor = useCallback(() => setEditor(null), []);

  const value = useMemo(
    () => ({ searchOpen, openSearch, closeSearch, editor, openEditor, closeEditor, helpOpen, setHelpOpen }),
    [searchOpen, openSearch, closeSearch, editor, openEditor, closeEditor, helpOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI outside UIProvider');
  return v;
}
