# edtrace viewer

Displays trace JSON files written by the backend and lets you step through the
program. See the top-level README for usage.

    pnpm install
    pnpm dev        # dev server; serves var/ etc. from where you ran it
    pnpm build      # typecheck + build into the content directory
    pnpm lint
    pnpm typecheck

Layout:

- `src/types.ts` – the trace format (mirrors `backend/src/edtrace/execute.py`)
- `src/trace.ts` – stepping, outline, reveal, and variable tracking (pure functions)
- `src/Viewer.tsx` – top bar, lecture lines, keyboard shortcuts
- `src/Renderings.tsx` – text/image/link/plot renderings for a line
- `src/Panels.tsx` – outline and variables panels
- `src/Values.tsx` – inspected values (numbers, lists, dicts, tensors)
- `src/code.ts`, `src/markdown.ts` – syntax highlighting and line-level markdown
- `vite.config.ts` – serves lecture files in dev and live-reloads traces
