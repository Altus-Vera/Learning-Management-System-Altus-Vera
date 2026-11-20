import json, os
from PIL import Image, ImageDraw, ImageFont
RED = (220, 38, 38); marks = json.load(open('marks.json')); os.makedirs('annotated', exist_ok=True)
try: font = ImageFont.truetype('arialbd.ttf', 26)
except Exception: font = ImageFont.load_default()
TOP, PAD, R = 90, 36, 22
for sid, boxes in marks.items():
    src = Image.open(f'shots/{sid}.png').convert('RGB'); W, H = src.size
    # crop empty bottom area (find last non-background row)
    im = Image.new('RGB', (W + 2 * PAD, H + TOP + PAD), (247, 248, 250)); im.paste(src, (PAD, TOP))
    d = ImageDraw.Draw(im); d.rectangle([PAD - 1, TOP - 1, PAD + W, TOP + H], outline=(160, 168, 180), width=2)
    used = []
    present = [b for b in boxes if b]
    order = sorted([(i, b) for i, b in enumerate(present)], key=lambda t: t[1]['x'] + t[1]['width'] / 2)
    for i, b in order:
        x0, y0 = b['x'] + PAD - 3, b['y'] + TOP - 3; x1, y1 = x0 + b['width'] + 6, y0 + b['height'] + 6
        d.rounded_rectangle([x0, y0, x1, y1], radius=6, outline=RED, width=4)
        c0 = min(max((x0 + x1) / 2, R + 4), W + 2 * PAD - R - 4); step = 2 * R + 8
        cands = [c0 + k * step * sgn for k in range(0, 40) for sgn in ((1,) if k == 0 else (-1, 1))]
        cx = next(c for c in cands if R + 4 <= c <= W + 2 * PAD - R - 4 and all(abs(c - u) >= step for u in used))
        used.append(cx); cy = TOP / 2
        d.line([(cx, cy + R), (cx, cy + R + 8), ((x0 + x1) / 2 if abs(cx - (x0 + x1) / 2) < 3 else cx, cy + R + 8)], fill=RED, width=3)
        tx = min(max(cx, x0 + 6), x1 - 6)
        d.line([(cx, cy + R + 8), (tx, y0)] if abs(tx - cx) > 1 else [(cx, cy + R), (cx, y0)], fill=RED, width=3)
        d.polygon([(tx - 8, y0 - 12), (tx + 8, y0 - 12), (tx, y0)], fill=RED)
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=RED, outline='white', width=3)
        n = str(i + 1); w = d.textlength(n, font=font); d.text((cx - w / 2, cy - 15), n, fill='white', font=font)
    im.save(f'annotated/{sid}.png')
print(len(marks))
