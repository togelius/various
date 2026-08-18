#!/usr/bin/env python3
"""Inline POWER CITY into one self-contained file.

Emits:
  dist/power-city.html        a standalone page - open it, host it, mail it
  dist/power-city.inner.html  the same body without the document wrapper, for
                              hosts that supply their own <head>/<body>

No assets to bundle: every pixel and every sound in this game is generated at
runtime, so the whole cabinet is the text of these scripts.
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'css/style.css').read_text()

# Script order matters; take it from the page itself rather than a second list
# that could drift out of step with it.
order = re.findall(r'<script src="js/([^"]+)\.js"></script>', html)
js = [(root / f'js/{name}.js').read_text() for name in order]

body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
body = re.sub(r'\s*<script src="[^"]+"></script>', '', body).strip()
# The inline boot script at the end of index.html comes along with the body.

parts = ['<title>POWER CITY</title>',
         '<style>\n' + css.strip() + '\n</style>']
# The favicon is an inline SVG full of '>' characters, so match the whole
# line rather than up to the first bracket.
head_extra = re.search(r'^(<link rel="icon".*)$', html, flags=re.M)
if head_extra:
    parts.insert(1, head_extra.group(1))
parts.append(re.sub(r'<script>.*?</script>', '', body, flags=re.S).strip())
parts += ['<script>\n' + s.strip() + '\n</script>' for s in js]
boot = re.search(r'<script>\s*(window\.addEventListener\(.*?)</script>', body, flags=re.S)
parts.append('<script>\n' + boot.group(1).strip() + '\n</script>')
inner = '\n'.join(parts) + '\n'

(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/power-city.inner.html').write_text(inner)
(root / 'dist/power-city.html').write_text(
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, '
    'maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
    + inner.split('</style>')[0] + '</style>\n</head>\n<body>\n'
    + inner.split('</style>', 1)[1].strip() + '\n</body>\n</html>\n')

for f in ('dist/power-city.html', 'dist/power-city.inner.html'):
    print(f, (root / f).stat().st_size // 1024, 'KB')
