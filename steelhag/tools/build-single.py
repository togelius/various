#!/usr/bin/env python3
"""Inline the stylesheet and scripts into one file: dist/stalhagen.html."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'css/style.css').read_text()
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '</style>')
def inline(m):
    # data-src lets the painting worker find the scripts it needs by name
    name = pathlib.Path(m.group(1)).name
    return f'<script data-src="{name}">\n' + (root / m.group(1)).read_text() + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = root / 'dist' / 'stalhagen.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html), 'bytes')
# The artifact host supplies its own document skeleton: keep only the head's content and the body's.
head = re.search(r'<head>(.*)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
head = re.sub(r'<meta[^>]*>\s*', '', head)
art = head.strip() + '\n<style>html, body { height: 100%; }</style>\n' + body.strip() + '\n'
out2 = root / 'dist' / 'stalhagen-artifact.html'
out2.write_text(art)
print(out2, len(art), 'bytes')
