from pathlib import Path
import re, sys
REPO=Path(__file__).resolve().parents[1]
ROOT=REPO/'public'
index=(ROOT/'index.html').read_text(encoding='utf-8')
missing=[]
for ref in re.findall(r'(?:src|href)="([^"]+)"', index):
    if ref.startswith(('http://','https://','#','mailto:','data:')):
        continue
    path=ROOT/ref.split('#',1)[0].split('?',1)[0]
    if not path.exists():
        missing.append(ref)
if missing:
    print('Missing referenced files:')
    print('\n'.join(missing))
    sys.exit(1)
print('Static file references OK')
