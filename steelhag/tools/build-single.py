#!/usr/bin/env python3
"""Inline the stylesheet and scripts into one file: dist/stalhagen.html."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'css/style.css').read_text()
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '</style>')
def inline(m):
    return '<script>\n' + (root / m.group(1)).read_text() + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = root / 'dist' / 'stalhagen.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html), 'bytes')
