# Regenerates the SVGs in this folder. Needs Inter 500 + 700 static TTFs (OFL 1.1, from Google Fonts) in <fonts dir>:
#   uv run --no-project --with uharfbuzz --with fonttools python design/make_logo.py <fonts dir>
"""Generate decisionUI logo SVGs into ~/Dev/decisionUI/design/."""
import os
import sys

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS = sys.argv[1]
OUT = os.path.expanduser("~/Dev/decisionUI/design")
os.makedirs(OUT, exist_ok=True)

ACCENT = "#5b5bf0"
WHITE = "#fff"


def svg(w, h, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
        f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
    )


TILE = f'<rect width="64" height="64" rx="16" fill="{ACCENT}"/>'


def line(x1, y1, x2, y2, w, op=1.0, color=WHITE):
    o = "" if op == 1 else f' stroke-opacity="{op}"'
    return (
        f'<path d="M{x1:g} {y1:g}L{x2:g} {y2:g}" stroke="{color}" stroke-width="{w:g}"'
        f' stroke-linecap="round"{o}/>'
    )


def lerp(a, b, t):
    return a + (b - a) * t


# ── Recommended: the check and its remainder ───────────────────────────────────────────────────────
# A confident check that stops short; the probability it leaves on the table sits beyond it as a faint dot.
A, V, B = (15.5, 33), (27, 44.5), (49.5, 19.5)


def at(t, v=V, b=B):
    return lerp(v[0], b[0], t), lerp(v[1], b[1], t)


def check_path(a, v, e, w):
    return (
        f'<path d="M{a[0]:g} {a[1]:g}L{v[0]:g} {v[1]:g}L{e[0]:.2f} {e[1]:.2f}" fill="none" stroke="{WHITE}"'
        f' stroke-width="{w:g}" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def remainder(w, fill=0.74, r=3.6, op=0.42, a=A, v=V, b=B):
    dx, dy = b
    return (
        f'<circle cx="{dx:g}" cy="{dy:g}" r="{r:g}" fill="{WHITE}" fill-opacity="{op:g}"/>'
        + check_path(a, v, at(fill, v, b), w)
    )


# The bar version of the same idea: a faint full-length track, filled to about three quarters.
def weighted_check(w, fill=0.72, track=0.34):
    return line(*V, *B, w, track) + check_path(A, V, at(fill), w)


MARK = TILE + remainder(7)
FAVICON = f'<rect width="64" height="64" rx="14" fill="{ACCENT}"/>' + remainder(
    10, fill=0.66, r=4, op=0.5, a=(13, 32.5), v=(26, 45.5), b=(50.5, 18.5)
)

# ── Alternatives ───────────────────────────────────────────────────────────────────────────────────
# Bars: a probability distribution whose tops trace a check; the winner is solid.
def bars():
    xs, hs = (15, 25.7, 36.3, 47), (15, 8, 22, 34)
    out = TILE
    for i, (x, h) in enumerate(zip(xs, hs)):
        op = 1 if i == 3 else 0.42
        out += line(x, 48, x, 48 - h, 7, op)
    return out


# Fork: two paths leave the same point; the chosen one is the check's long stroke.
def fork():
    v = (27, 44)
    return (
        TILE
        + line(*v, 31, 17, 5, 0.38)
        + f'<path d="M16.5 33.5L{v[0]} {v[1]}L48 22" fill="none" stroke="{WHITE}" stroke-width="6.5"'
        ' stroke-linecap="round" stroke-linejoin="round"/>'
    )


# Ring: a confidence ring (filled to 80 %) around a check.
def ring():
    import math

    cx = cy = 32
    r, w, p = 20, 5, 0.8
    end = -math.pi / 2 + 2 * math.pi * p
    ex, ey = cx + r * math.cos(end), cy + r * math.sin(end)
    arc = (
        f'<path d="M{cx} {cy - r}A{r} {r} 0 1 1 {ex:.2f} {ey:.2f}" fill="none" stroke="{WHITE}"'
        f' stroke-width="{w}" stroke-linecap="round"/>'
    )
    track = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{WHITE}" stroke-opacity=".3" stroke-width="{w}"/>'
    check = (
        f'<path d="M24.5 32.5L30 38L40 27" fill="none" stroke="{WHITE}" stroke-width="5"'
        ' stroke-linecap="round" stroke-linejoin="round"/>'
    )
    return TILE + track + arc + check


# ── Wordmark ───────────────────────────────────────────────────────────────────────────────────────
def shaped_paths(text, font_path, size, x0, baseline, track_em=0.0):
    """Outline paths of `text` (HarfBuzz-shaped, kerned) at `size` px, starting at x0."""
    blob = hb.Blob.from_file_path(font_path)
    face = hb.Face(blob)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True, "calt": True})
    tt = TTFont(font_path)
    upem = tt["head"].unitsPerEm
    gs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    s = size / upem
    x = x0
    d = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        gs[order[info.codepoint]].draw(TransformPen(pen, (s, 0, 0, -s, x + pos.x_offset * s, baseline - pos.y_offset * s)))
        d.append(pen.getCommands())
        x += pos.x_advance * s + track_em * size
    return "".join(d), x


def wordmark(ink, ink2):
    h = 64
    mark_size = 48
    my = (h - mark_size) / 2
    scale = mark_size / 64
    mark = f'<g transform="translate(0 {my:g}) scale({scale:g})">{MARK.replace("<", "<", 1)}</g>'
    size = 33
    # Centre x-height + ascenders optically on the mark: baseline a bit below centre.
    baseline = 32 + size * 0.36
    x0 = mark_size + 13
    d1, x = shaped_paths("decision", f"{FONTS}/inter-700.ttf", size, x0, baseline, -0.022)
    d2, x = shaped_paths("UI", f"{FONTS}/inter-500.ttf", size, x + 0.4, baseline, -0.01)
    w = round(x + 2)
    body = mark + f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{ink2}"/>'
    return w, h, body


files = {
    "logo.svg": svg(64, 64, MARK, "decisionUI"),
    "favicon.svg": svg(64, 64, FAVICON, "decisionUI"),
    "alt-bars.svg": svg(64, 64, bars(), "decisionUI (bars)"),
    "alt-fork.svg": svg(64, 64, fork(), "decisionUI (fork)"),
    "alt-track.svg": svg(64, 64, TILE + weighted_check(7), "decisionUI (track)"),
}
w, h, body = wordmark("#18181b", "#54545c")
files["logo-wordmark.svg"] = svg(w, h, body, "decisionUI")
w, h, body = wordmark("#f4f4f5", "#b4b4bd")
files["logo-wordmark-dark.svg"] = svg(w, h, body, "decisionUI")

for name, text in files.items():
    with open(os.path.join(OUT, name), "w") as f:
        f.write(text)
    print(f"{name:26} {len(text.encode()):6} B")
