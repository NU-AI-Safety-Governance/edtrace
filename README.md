# edtrace

edtrace (Educational Tracer) lets you write a Python program, capture an
execution trace of it, and step through the code in a web browser. Calls like
`text()`, `image()`, and `plot()` render markdown, figures, and charts in place
of the code that produced them, so a Python program can replace lecture notes or
slides.

This is a fork of [percyliang/edtrace](https://github.com/percyliang/edtrace)
with a rewritten viewer (TypeScript + React):

- Code and prose read differently: code lines are grouped into blocks and
  everything else is typeset (headings, lists, callouts, tables, KaTeX math)
- Outline sidebar built from your headings, with the current section highlighted
- Variables panel with call stack, typed values, and tensor heatmaps
- Clickable/draggable progress bar with section ticks
- Light and dark themes, zoom, citation hover cards, image lightbox
- Live reload: re-run a lecture and the open browser tab updates in place
- Home page listing all lectures (`var/traces/index.json`)
- Presenter mode (`P`) and a synced speaker view (`S`) with notes, next step, and a timer
- `card()` for case studies (label, title, body, tags, cited sources, caveat)
- `torch` and `sympy` are optional backend dependencies

## Quick start

1. Write `hello.py`:

```python
from edtrace import text

def main():
    text("# Hello")
    x = 3  # @inspect x
    text("Welcome!")
    x += 1  # @inspect x
```

2. Record the trace (writes `var/traces/hello.json` and updates `var/traces/index.json`):

```sh
python -m edtrace.execute -m hello
```

3. View it. From the directory containing `var/`:

```sh
pnpm --dir path/to/edtrace/frontend install
pnpm --dir path/to/edtrace/frontend dev
```

and open http://localhost:5173. The dev server serves files from the directory
you ran it from (override with `EDTRACE_CONTENT_DIR`).

## Writing lectures

| Call | Shows |
|------|-------|
| `text("...")` | One line of markdown. Leading `#`, `-`, `1.`, `>`, `> [!NOTE]` make it a heading, bullet, numbered item, quote, or callout. `$...$` / `$$...$$` is math. A multi-line string is rendered as a full markdown block (e.g., a table). |
| `image(path_or_url, width=...)` | An image (URLs are downloaded to `var/files`) |
| `video(path_or_url)` | A video |
| `link(url)`, `link(Reference(...))` | A citation chip with details on hover (arXiv links are looked up) |
| `link(function)` | A link that jumps to the function's definition |
| `plot(vega_lite_spec)` | A Vega-Lite chart |
| `card(title, body=..., eyebrow=..., tags=[...], sources=[...], caveat=...)` | A card, e.g. a case study with cited sources |
| `note("...")` | Speaker notes (shown in the speaker view, or inline with N) |

Directives go in comments:

- `# @inspect x y` shows the values of `x` and `y` after the line runs
- `# @clear x` stops showing `x`
- `# @stepover` doesn't trace into calls on this line
- `# @hide` hides the line

## Viewer shortcuts

| Key | Action |
|-----|--------|
| `Space` / `→`, `Shift+Space` / `←` | Step forward / back |
| `↓`, `↑` | Step over / back over |
| `u` | Step out of the current function |
| `⌘↑` / `Home`, `⌘↓` / `End` | First / last step |
| `a` | Reveal lines as you step (presenting) |
| `r` | Raw code |
| `e`, `v` | Inline values, variables panel |
| `n` | Speaker notes |
| `o`, `t`, `+`/`-`/`0` | Outline, theme, zoom |
| `p`, `s` | Present (fullscreen), speaker view (synced second window) |
| `/` / `?` | All shortcuts |

Letter shortcuts do not need Shift. `⌘` is Command on a Mac. Existing `h/j/k/l`,
Shift+arrows, uppercase view toggles, and `PgUp`/`PgDn` clickers remain supported.
Browser commands such as `⌘R` keep their normal behavior, and lecture shortcuts
are disabled while typing in a field.

Every position is a URL (`?trace=hello&step=12`), so you can link to any step.

## Building a static site

From the directory containing `var/`:

```sh
pnpm --dir path/to/edtrace/frontend build
```

This writes `index.html` and `assets/` next to `var/` (the site uses relative
paths, so it can be served from any subpath, e.g. GitHub Pages). Set
`VITE_EDTRACE_SITE_TITLE` in a `.env` file there to name the site.
