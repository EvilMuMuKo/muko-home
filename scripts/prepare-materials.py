"""Optional asset preparation: Python 3 + Pillow, not part of the npm build.
Recreates CC0 texture derivatives from the pinned URLs and MD5s in sources.json.
"""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
folder = root / 'public/materials'
sources = json.loads((folder / 'sources.json').read_text())
with tempfile.TemporaryDirectory(prefix='muko-materials-') as tmp:
    for name, asset in sources.items():
        for channel, entry in asset['maps'].items():
            source = Path(tmp) / f'{name}-{channel}.jpg'
            subprocess.run(['curl', '-fsSL', entry['source'], '-o', str(source)], check=True)
            if hashlib.md5(source.read_bytes()).hexdigest() != entry['sourceMD5']:
                raise ValueError(f'Source checksum changed: {name}/{channel}')
            image = Image.open(source).convert('RGB')
            if name == 'linen' and channel == 'color':
                image = ImageOps.grayscale(image).point(lambda v: min(255, round(v * 1.3))).convert('RGB')
            size = entry['resolution']
            if image.size != (size, size):
                image = image.resize((size, size), Image.Resampling.LANCZOS)
            image.save(folder / f'{name}-{channel}.webp', 'WEBP', quality=90 if channel == 'normal' else 86, method=6)
