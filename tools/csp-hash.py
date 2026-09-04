#!/usr/bin/env python3
"""Prints the CSP source expression for the visualizer's inline import map,
and checks whether _headers currently matches it.

script-src in _headers pins that block by hash, so any edit to it — a version
bump from tools/vendor-three.mjs, a reformat — silently stops the browser
running it and the visualizer never loads. Run this after touching it.

    python3 tools/csp-hash.py
"""
import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

block = re.search(
    r'<script type="importmap">(.*?)</script>',
    (ROOT / 'visualizer' / 'index.html').read_text(),
    re.S,
)
if not block:
    sys.exit('No <script type="importmap"> found in visualizer/index.html')

digest = hashlib.sha256(block.group(1).encode()).digest()
expr = "'sha256-" + base64.b64encode(digest).decode() + "'"

headers = (ROOT / '_headers').read_text()
ok = expr in headers

print(f'import map hash: {expr}')
print('_headers        :', 'matches' if ok else 'STALE — update script-src in _headers')
sys.exit(0 if ok else 1)
