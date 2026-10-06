"""
Functions such as (e.g., note, image, link) populate the list of renderings,
which will be shown in place of the line of code in the interface.
"""

import os
import inspect
import re
import subprocess
from dataclasses import dataclass
from .file_util import cached, relativize
from .arxiv_util import is_arxiv_link, arxiv_reference
from .reference import Reference

@dataclass(frozen=True)
class CodeLocation:
    """Refers to a specific line of code."""
    path: str
    line_number: int


@dataclass(frozen=True)
class Rendering:
    """
    Specifies what to display instead of a line of code.  Types:
    - text: plain text (verbatim)
    - markdown: to be rendered as markdown
    - image: an image (data = url)
    - video: a video (data = url)
    - link: an link to internal code or external URL
    - plot: a Vega-Lite spec
    - plotly: a Plotly figure (data = {data, layout, config}), e.g., for 3D surfaces
    - card: a card (data = {title, body, eyebrow, tags, sources, caveat})
    - note: speaker notes
    """
    type: str
    data: str | None = None
    style: dict | None = None
    external_link: Reference | None = None
    internal_link: CodeLocation | None = None

############################################################

def text(message: str, style: dict | None = None, verbatim: bool = False):
    """Make a note (bullet point) with `message`."""
    style = style or {}
    if verbatim:
        messages = message.split("\n")
        style = {
            "fontFamily": "monospace",
            "whiteSpace": "pre",
            **style
        }
    else:
        messages = [message]

    for message in messages:
        _current_renderings.append(Rendering(type="markdown", data=message, style=style))


def image(url: str, style: dict | None = None, width: int | str | None = None):
    """Show the image at `url`."""
    style = style or {}
    if width is not None:
        style["width"] = width

    if is_url(url):
        path = cached(url, "image")
    else:
        path = url
        if not os.path.exists(path):
            raise ValueError(f"Image not found: {path}")

    _current_renderings.append(Rendering(type="image", data=path, style=style))


def video(url: str, style: dict | None = None, width: int | str | None = None):
    """Show the video at `url`."""
    style = style or {}
    if width is not None:
        style["width"] = width

    if is_url(url):
        path = cached(url, "video")
    else:
        path = url
        if not os.path.exists(path):
            raise ValueError(f"Video not found: {path}")

    _current_renderings.append(Rendering(type="video", data=path, style=style))


def is_url(url: str) -> bool:
    """Check if `url` looks like a URL."""
    return url.startswith("http")


def url_reference(url: str, **kwargs):
    """Makes a reference (but doesn't add it to _current_renderings)."""
    if is_arxiv_link(url):
        return arxiv_reference(url, **kwargs)
    else:
        return Reference(url=url, **kwargs)


def link(arg: type | Reference | str | None = None, style: dict | None = None, **kwargs):
    """
    Shows a link.  There are four possible usages:
    1. link(title="...", url="...") [Creates a new reference]
    2. link(arg: Reference) [Shows an existing reference]
    3. link(arg: type) [Shows a link to the code]
    4. link(arg: str) [Creates a new reference with the given URL]
    """
    style = style or {}

    if arg is None:
        reference = Reference(**kwargs)
        _current_renderings.append(Rendering(type="link", data=reference.label, style=style, external_link=reference))
    elif isinstance(arg, Reference):
        _current_renderings.append(Rendering(type="link", data=arg.label, style=style, external_link=arg))
    elif isinstance(arg, type) or callable(arg):
        path = inspect.getfile(arg)
        _, line_number = inspect.getsourcelines(arg)
        anchor = CodeLocation(relativize(path), line_number)
        _current_renderings.append(Rendering(type="link", data=arg.__name__, style=style, internal_link=anchor))
    elif isinstance(arg, str):
        reference = url_reference(url=arg, **kwargs)
        _current_renderings.append(Rendering(type="link", data=reference.label, style=style, external_link=reference))
    else:
        raise ValueError(f"Invalid argument: {arg}")


def plot(spec: any):
    """Show a plot given `spec`."""
    _current_renderings.append(Rendering(type="plot", data=spec))


def plotly(figure: any, style: dict | None = None):
    """Show a Plotly figure: a dict with `data` (traces), and optionally `layout` and `config`,
    or a plotly.graph_objects.Figure. Use it for what Vega-Lite can't draw, such as 3D surfaces."""
    if hasattr(figure, "to_plotly_json"):  # A plotly Figure
        figure = figure.to_plotly_json()
    _current_renderings.append(Rendering(type="plotly", data=figure, style=style))


def card(
    title: str,
    body: str | None = None,
    eyebrow: str | None = None,
    tags: list[str] | None = None,
    sources: list[Reference | str] | None = None,
    caveat: str | None = None,
    style: dict | None = None,
):
    """
    Show a card (e.g., a case study): a small `eyebrow` label, a `title`, a
    markdown `body`, `tags`, cited `sources` (references or URLs), and a `caveat`.
    """
    data = {
        "title": title,
        "body": body,
        "eyebrow": eyebrow,
        "tags": tags or [],
        "sources": [source if isinstance(source, Reference) else url_reference(source) for source in sources or []],
        "caveat": caveat,
    }
    _current_renderings.append(Rendering(type="card", data=data, style=style))


def note(message: str):
    """Show a note."""
    _current_renderings.append(Rendering(type="note", data=message))


############################################################

# Accumulate the renderings during execution (gets flushed).
_current_renderings: list[Rendering] = []

def pop_renderings() -> list[Rendering]:
    """Return the renderings and clear the list."""
    renderings = _current_renderings.copy()
    _current_renderings.clear()
    return renderings


def system_text(command: list[str]):
    output = subprocess.check_output(command).decode('utf-8')
    output = remove_ansi_escape_sequences(output)
    text(output, verbatim=True)


def remove_ansi_escape_sequences(text):
    ansi_escape_pattern = re.compile(r'\x1b\[[0-9;]*m')
    return ansi_escape_pattern.sub('', text)
