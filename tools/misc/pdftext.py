#!/usr/bin/env python3
"""Minimal PDF text extractor: inflate the content streams and pull the text
operators out. No dependencies - poppler is not installed here and pypdf's
cryptography wheel panics on import, so this does the small part of the job we
actually need.

    python3 tools/misc/pdftext.py file.pdf [first_page] [last_page]
"""
import re, sys, zlib

def unescape(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == 92 and i + 1 < len(s):          # backslash
            n = s[i + 1]
            mapping = {110: 10, 114: 13, 116: 9, 98: 8, 102: 12}
            if n in mapping: out.append(mapping[n]); i += 2; continue
            if 48 <= n <= 55:                    # octal
                j = i + 1; oct_digits = b''
                while j < len(s) and 48 <= s[j] <= 55 and len(oct_digits) < 3:
                    oct_digits += bytes([s[j]]); j += 1
                out.append(int(oct_digits, 8)); i = j; continue
            out.append(n); i += 2; continue
        out.append(c); i += 1
    return bytes(out)

def text_from_stream(data):
    pieces = []
    # (literal) Tj / TJ, and hex <..> strings
    for m in re.finditer(rb'\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|T[Jj*]|Td|TD|Tm|ET', data, re.S):
        tok = m.group(0)
        if tok.startswith(b'('):
            pieces.append(unescape(tok[1:-1]).decode('latin-1'))
        elif tok.startswith(b'<'):
            h = re.sub(rb'\s', b'', tok[1:-1])
            if len(h) % 2: h += b'0'
            try:
                raw = bytes.fromhex(h.decode('ascii'))
                # 2-byte CID text is common; keep only plausible latin1
                pieces.append(raw.decode('latin-1'))
            except ValueError:
                pass
        elif tok in (b'Td', b'TD', b'Tm', b'T*', b'ET'):
            pieces.append('\n')
    return ''.join(pieces)

def main():
    path = sys.argv[1]
    lo = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    hi = int(sys.argv[3]) if len(sys.argv) > 3 else 10 ** 9
    blob = open(path, 'rb').read()
    streams = []
    for m in re.finditer(rb'stream\r?\n', blob):
        start = m.end()
        end = blob.find(b'endstream', start)
        if end < 0: continue
        raw = blob[start:end]
        try:
            streams.append(zlib.decompress(raw))
        except zlib.error:
            try: streams.append(zlib.decompressobj().decompress(raw))
            except zlib.error: pass
    page_no = 0
    for s in streams:
        if b'BT' not in s: continue          # not a content stream
        page_no += 1
        if page_no < lo: continue
        if page_no > hi: break
        txt = text_from_stream(s)
        txt = re.sub(r'\n{3,}', '\n\n', txt)
        print('\n========== page %d ==========' % page_no)
        print(txt)

main()
