#!/usr/bin/env python3
"""Inline css/ and js/ into self-contained HTML files in dist/.

  dist/accession.html       the game
  dist/accession-hash.html  the cross-browser hash check (tools/hash-template.html)

An inert placeholder, <script type="text/x-NAME" data-src="FILE"></script>, is inlined
as an inert block holding FILE's text, which the code that owns it runs on first use
(BUILD.md §6.4). The rule is generic, so removing a placeholder from index.html removes
the file from the build and nothing here needs editing.
"""
import os, re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
build = os.environ.get('ACCESSION_BUILD', 'dev')

def read(rel):
    return open(os.path.join(root, rel), encoding='utf-8').read()

def inline(html):
    def css(m):
        return '<style>\n' + read(m.group(1)) + '\n</style>'
    def js(m):
        return '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '\n</script>'
    def inert(m):
        return '<script type="text/x-%s">\n%s\n</script>' % (m.group(1), read(m.group(2)).replace('</script', '<\\/script'))
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
    html = re.sub(r'<script type="text/x-([a-z0-9-]+)" data-src="([^"]+)"></script>', inert, html)
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)
    return html.replace('__BUILD__', build)

def write(name, html):
    out = os.path.join(root, 'dist', name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', os.path.relpath(out, root), len(html.encode('utf-8')) // 1024, 'KB')

index = read('index.html')
write('accession.html', inline(index))
core = '\n'.join(m.group(0) for m in re.finditer(r'<script src="((?:js/core|content)/[^"]+)"></script>', index))
write('accession-hash.html', inline(read('tools/hash-template.html').replace('<!-- core -->', core)))
