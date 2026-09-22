import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** What the add/edit sheet should show */
export type EditorRequest =
  | { mode: 'new'; kind: 'todo' | 'exam'; courseId?: string; text?: string }
  | { mode: 'edit'; kind: 'todo' | 'exam'; id: string };

/** What the note sheet should show */
export type MemoRequest = { mode: 'new'; courseId?: string } | { mode: 'edit'; id: string };

/** What the link sheet should show */
export type LinkRequest = { mode: 'new'; courseId?: string } | { mode: 'edit'; id: string };

interface UI {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  editor: EditorRequest | null;
  openEditor: (req: EditorRequest) => void;
  closeEditor: () => void;
  memoEditor: MemoRequest | null;
  openMemoEditor: (req: MemoRequest) => void;
  closeMemoEditor: () => void;
  linkEditor: LinkRequest | null;
  openLinkEditor: (req: LinkRequest) => void;
  closeLinkEditor: () => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
}

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [memoEditor, setMemoEditor] = useState<MemoRequest | null>(null);
  const [linkEditor, setLinkEditor] = useState<LinkRequest | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openEditor = useCallback((req: EditorRequest) => setEditor(req), []);
  const closeEditor = useCallback(() => setEditor(null), []);
  const openMemoEditor = useCallback((req: MemoRequest) => setMemoEditor(req), []);
  const closeMemoEditor = useCallback(() => setMemoEditor(null), []);
  const openLinkEditor = useCallback((req: LinkRequest) => setLinkEditor(req), []);
  const closeLinkEditor = useCallback(() => setLinkEditor(null), []);

  const value = useMemo(
    () => ({
      searchOpen, openSearch, closeSearch, editor, openEditor, closeEditor,
      memoEditor, openMemoEditor, closeMemoEditor, linkEditor, openLinkEditor, closeLinkEditor,
      helpOpen, setHelpOpen, assistantOpen, setAssistantOpen,
    }),
    [searchOpen, openSearch, closeSearch, editor, openEditor, closeEditor, memoEditor, openMemoEditor, closeMemoEditor, linkEditor, openLinkEditor, closeLinkEditor, helpOpen, assistantOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI outside UIProvider');
  return v;
}
