#!/usr/bin/env python3
"""Inline css/ and js/ into self-contained HTML files in dist/.

  dist/accession.html       the game
  dist/accession-hash.html  the cross-browser hash check (tools/hash-template.html)

--no-3d builds the game without the 3D board view and three.js, as
dist/accession-no3d.html, to prove the game stands without them (BUILD.md §6.3).
three.js is inlined as an inert <script type="text/x-three"> block that board3d.js runs
on first use, so it costs nothing until 3D is switched on.
"""
import os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
no3d = '--no-3d' in sys.argv[1:]
build = os.environ.get('ACCESSION_BUILD', 'dev')

def read(rel):
    return open(os.path.join(root, rel), encoding='utf-8').read()

def inline(html):
    def css(m):
        return '<style>\n' + read(m.group(1)) + '\n</style>'
    def js(m):
        if no3d and m.group(1) == 'js/view/board3d.js':
            return ''
        return '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '\n</script>'
    def three(m):
        if no3d:
            return ''
        return '<script type="text/x-three" id="three-src">\n' + read(m.group(1)).replace('</script', '<\\/script') + '\n</script>'
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
    html = re.sub(r'<script type="text/x-three" data-src="([^"]+)"></script>', three, html)
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)
    return html.replace('__BUILD__', build)

def write(name, html):
    out = os.path.join(root, 'dist', name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', os.path.relpath(out, root), len(html.encode('utf-8')) // 1024, 'KB')

index = read('index.html')
write('accession-no3d.html' if no3d else 'accession.html', inline(index))
if not no3d:
    core = '\n'.join(m.group(0) for m in re.finditer(r'<script src="((?:js/core|content)/[^"]+)"></script>', index))
    write('accession-hash.html', inline(read('tools/hash-template.html').replace('<!-- core -->', core)))
