#!/usr/bin/env python3
"""Inline ANANKE into one self-contained file.

Emits two things from the same body:
  dist/ananke.html   a standalone page you can open or host anywhere
  dist/ananke.inner.html  the same body without the document wrapper, for
                          hosts that supply their own <head>/<body>
"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
# The two faces are embedded rather than linked: the page then renders as
# designed with no network at all, and never falls back silently.
css = (root / 'css/fonts.css').read_text() + '\n' + (root / 'css/style.css').read_text()
js = [(root / f'js/{n}.js').read_text() for n in ('engine', 'levels', 'ui')]
html = (root / 'index.html').read_text()

body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
body = re.sub(r'\s*<script src="[^"]+"></script>', '', body).strip()

# Canvas text is drawn before webfonts land; redraw once they do.
REFLOW = ("if (document.fonts && document.fonts.ready) "
          "document.fonts.ready.then(function () "
          "{ window.dispatchEvent(new Event('resize')); });")

inner = '\n'.join([
    '<title>Ananke</title>',
    '<style>\n' + css.strip() + '\n</style>', body,
    *['<script>\n' + s.strip() + '\n</script>' for s in js],
    '<script>' + REFLOW + '</script>', ''])

(root / 'dist/ananke.inner.html').write_text(inner)
(root / 'dist/ananke.html').write_text(
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + inner.split('</style>')[0] + '</style>\n</head>\n<body>\n'
    + inner.split('</style>', 1)[1].strip() + '\n</body>\n</html>\n')

for f in ('dist/ananke.html', 'dist/ananke.inner.html'):
    print(f, (root / f).stat().st_size // 1024, 'KB')
