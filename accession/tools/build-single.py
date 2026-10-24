#!/usr/bin/env python3
"""Inline css/ and js/ into self-contained HTML files in dist/.

  dist/accession.html       the game
  dist/accession-hash.html  the cross-browser hash check (tools/hash-template.html), with the
                            core, tools/monkey.js, tools/replay.js and the golden runs inlined

Each build is stamped with its coreHash and vmHash (BUILD.md §3.6, §6.1), from
tools/core-hash.js: the game as <meta name="accession-core-hash"> and
<meta name="accession-vm-hash"> in its head, the hash page in its heading line.

  python3 tools/build-single.py             the two builds
  python3 tools/build-single.py --release   also keeps the game as dist/builds/<coreHash>.html,
                                            so replays made with it keep working (§3.6)

An inert placeholder, <script type="text/x-NAME" data-src="FILE"></script>, is inlined
as an inert block holding FILE's text, which the code that owns it runs on first use
(BUILD.md §6.4). The rule is generic, so removing a placeholder from index.html removes
the file from the build and nothing here needs editing.
"""
import html, json, os, re, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
build = os.environ.get('ACCESSION_BUILD', 'dev')

def read(rel):
    return open(os.path.join(root, rel), encoding='utf-8').read()

def hashes():
    out = subprocess.run(['node', os.path.join(root, 'tools', 'core-hash.js'), '--json'], capture_output=True, text=True, check=True).stdout
    h = json.loads(out)
    if not (re.fullmatch(r'[0-9a-f]{8}', h['coreHash']) and re.fullmatch(r'[0-9a-f]{8}', h['vmHash'])):
        raise SystemExit('build-single: tools/core-hash.js gave ' + out.strip())
    return h

def inline(text):
    def css(m):
        return '<style>\n' + read(m.group(1)) + '\n</style>'
    def js(m):
        return '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '\n</script>'
    def inert(m):
        return '<script type="text/x-%s">\n%s\n</script>' % (m.group(1), read(m.group(2)).replace('</script', '<\\/script'))
    text = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, text)
    text = re.sub(r'<script type="text/x-([a-z0-9-]+)" data-src="([^"]+)"></script>', inert, text)
    text = re.sub(r'<script src="([^"]+)"></script>', js, text)
    return text

def write(name, text):
    out = os.path.join(root, 'dist', name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(text)
    print('wrote', os.path.relpath(out, root), len(text.encode('utf-8')) // 1024, 'KB')

h = hashes()
stamp = '<meta name="accession-core-hash" content="%s">\n<meta name="accession-vm-hash" content="%s">\n<meta name="accession-build" content="%s">\n' % (h['coreHash'], h['vmHash'], html.escape(build, quote=True))
index = read('index.html')
if '<head>\n' not in index:
    raise SystemExit('build-single: index.html has no <head> line to stamp')
game = inline(index).replace('<head>\n', '<head>\n' + stamp, 1)
write('accession.html', game)
core = '\n'.join(m.group(0) for m in re.finditer(r'<script src="((?:js/core|content)/[^"]+)"></script>', index))
page = inline(read('tools/hash-template.html').replace('<!-- core -->', core))
write('accession-hash.html', page.replace("'__BUILD__'", json.dumps(build)).replace("'__CORE_HASH__'", "'%s'" % h['coreHash']))
if '--release' in sys.argv[1:]:
    write(os.path.join('builds', h['coreHash'] + '.html'), game)
print('coreHash', h['coreHash'], 'vmHash', h['vmHash'])
