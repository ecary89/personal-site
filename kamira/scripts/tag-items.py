#!/usr/bin/env python3
"""
Give shop items search tags (color, material, pattern, type).

Kamira's search reads each item's `tags`. This script fills in tags for any
item in PRODUCTS or DECOR (inside kamira/index.html) that doesn't have them yet.
It never changes tags that are already there, so hand fixes are safe.

How it guesses:
  - type, material and pattern come from words in the name and the store link
    ("Leather Biker Jacket" -> leather, jacket, outerwear, clothing)
  - color comes from the store link (most stores put it there, like ...-black)
    and from the pixels of the cutout image itself

It's a first pass. Always look at the results and fix what's wrong.

Run from the repo root:
  python3 kamira/scripts/tag-items.py            # tag new items, save
  python3 kamira/scripts/tag-items.py --dry-run  # just print what it would add
  python3 kamira/scripts/tag-items.py --redo ID  # re-guess one item (by id)

Needs Pillow:  pip3 install pillow
"""
import json, re, sys, colorsys
from pathlib import Path
from urllib.parse import urlparse

try:
    from PIL import Image
except ImportError:
    sys.exit('Needs Pillow first:  pip3 install pillow')

ROOT = Path(__file__).resolve().parent.parent          # kamira/
INDEX = ROOT / 'index.html'

# ---- words in names and links -> tags -------------------------------------------------
# Each key is a word to look for. Each value is the tags it adds.
WORDS = {
    # clothes
    'dress': 'dress clothing', 'gown': 'dress clothing', 'skirt': 'skirt clothing',
    'jacket': 'jacket outerwear clothing', 'bomber': 'jacket outerwear clothing', 'blazer': 'blazer jacket outerwear clothing',
    'coat': 'coat outerwear clothing', 'overcoat': 'coat outerwear clothing', 'topcoat': 'coat outerwear clothing',
    'trench': 'trench coat outerwear clothing', 'peacoat': 'coat outerwear clothing', 'puffer': 'puffer jacket outerwear clothing',
    'sweater': 'sweater knit top clothing', 'jumper': 'sweater knit top clothing', 'turtleneck': 'sweater turtleneck top clothing',
    'cardigan': 'cardigan sweater knit top clothing', 'cardi': 'cardigan sweater knit top clothing', 'crew': 'sweater knit top clothing',
    'top': 'top clothing', 'blouse': 'blouse top clothing', 'shirt': 'shirt top clothing', 'tee': 'tshirt top clothing',
    'jean': 'jeans denim pants clothing', 'jeans': 'jeans denim pants clothing', 'pant': 'pants clothing', 'pants': 'pants clothing',
    'trouser': 'pants clothing', 'shorts': 'shorts clothing',
    # shoes
    'boot': 'boots shoes', 'boots': 'boots shoes', 'flat': 'flats shoes', 'heel': 'heels shoes', 'pump': 'heels pumps shoes',
    'slingback': 'heels shoes', 'loafer': 'loafers shoes', 'clog': 'clogs shoes', 'clogs': 'clogs shoes', 'sneaker': 'sneakers shoes',
    'sandal': 'sandals shoes', 'mule': 'mules shoes', 'mary': 'mary-jane shoes', 'mj': 'mary-jane shoes',
    # bags
    'bag': 'bag', 'tote': 'tote bag', 'clutch': 'clutch bag', 'purse': 'bag', 'hobo': 'bag', 'wristlet': 'bag',
    # accessories
    'scarf': 'scarf accessory', 'bandana': 'scarf bandana accessory', 'beanie': 'beanie hat accessory', 'hat': 'hat accessory',
    'glove': 'gloves accessory', 'sunglasses': 'sunglasses accessory', 'belt': 'belt accessory',
    'scrunchie': 'hair accessory', 'headband': 'hair accessory', 'claw': 'hair clip accessory', 'clip': 'hair clip accessory',
    'earrings': 'earrings jewelry', 'earring': 'earrings jewelry', 'necklace': 'necklace jewelry', 'bracelet': 'bracelet jewelry', 'ring': 'ring jewelry',
    # home
    'vase': 'vase', 'pillow': 'pillow', 'throw': 'blanket', 'blanket': 'blanket', 'mug': 'mug cup', 'cup': 'cup', 'teacup': 'teacup cup',
    'sipper': 'cup', 'bowl': 'bowl', 'plate': 'plate', 'teapot': 'teapot', 'creamer': 'pitcher', 'pitcher': 'pitcher', 'carafe': 'carafe',
    'glass': 'glass', 'coupe': 'glass cocktail', 'martini': 'glass cocktail', 'wine': 'wine glass', 'stemware': 'wine glass',
    'candle': 'candle', 'votive': 'candle-holder', 'tealight': 'candle-holder', 'hurricane': 'candle-holder', 'cloche': 'cloche',
    'lamp': 'lamp light', 'lantern': 'lantern light', 'lights': 'string-lights light', 'pendant': 'light',
    'frame': 'picture-frame', 'catchall': 'dish', 'stand': 'cake-stand', 'plant': 'plant', 'pot': 'plant-pot',
    # materials
    'leather': 'leather', 'suede': 'suede leather', 'velvet': 'velvet', 'satin': 'satin', 'silk': 'silk', 'lace': 'lace',
    'denim': 'denim', 'wool': 'wool', 'rewool': 'wool', 'softwool': 'wool', 'boiled': 'wool', 'merino': 'wool merino', 'cashmere': 'cashmere wool',
    'alpaca': 'alpaca wool', 'cotton': 'cotton', 'linen': 'linen', 'corduroy': 'corduroy', 'nylon': 'nylon', 'fleece': 'fleece',
    'knit': 'knit', 'knitted': 'knit', 'reknit': 'knit', 'boucle': 'boucle', 'bouclé': 'boucle', 'ceramic': 'ceramic', 'stoneware': 'ceramic',
    'porcelain': 'ceramic', 'brass': 'brass metal', 'metal': 'metal', 'wire': 'metal', 'jute': 'jute', 'paper': 'paper', 'beaded': 'beaded',
    # patterns and details
    'stripe': 'striped', 'striped': 'striped', 'stripes': 'striped', 'dots': 'polka-dot', 'checkered': 'checkered', 'checker': 'checkered',
    'plaid': 'plaid', 'floral': 'floral', 'florals': 'floral', 'blossom': 'floral', 'hydrangea': 'floral', 'butterfly': 'butterfly',
    'herringbone': 'herringbone', 'quilted': 'quilted', 'cable': 'cable-knit', 'ribbed': 'ribbed', 'printed': 'print', 'bow': 'bow',
    'tassel': 'tassel', 'faux': 'faux', 'outdoor': 'outdoor',
}

# Color words that stores put in links and names -> the color tags they add
COLOR_WORDS = {
    'black': 'black', 'blacktortoise': 'black tortoise', 'charcoal': 'charcoal gray', 'grey': 'gray', 'gray': 'gray', 'stone': 'gray',
    'midgrey': 'gray', 'white': 'white', 'ivory': 'cream white', 'cream': 'cream white', 'bone': 'cream white', 'canvas': 'cream',
    'oatmeal': 'oatmeal beige', 'beige': 'beige', 'sand': 'beige', 'wheat': 'beige', 'almond': 'beige', 'taupe': 'taupe beige',
    'tan': 'tan brown', 'camel': 'camel tan brown', 'brown': 'brown', 'cocoa': 'brown', 'coffee': 'brown', 'oak': 'brown', 'beech': 'brown',
    'chocolate': 'brown', 'red': 'red', 'burgundy': 'burgundy red', 'pink': 'pink', 'rose': 'pink', 'blush': 'pink', 'mauve': 'mauve pink',
    'lilac': 'lilac purple', 'lavender': 'lavender purple', 'purple': 'purple', 'blue': 'blue', 'bluedots': 'blue polka-dot', 'navy': 'navy blue',
    'indigo': 'indigo blue denim', 'sky': 'light-blue blue', 'sea': 'blue', 'green': 'green', 'sage': 'sage green', 'mint': 'mint green',
    'olive': 'olive green', 'forest': 'green', 'emerald': 'green', 'yellow': 'yellow', 'yellowflorals': 'yellow floral', 'ochre': 'mustard yellow',
    'mustard': 'mustard yellow', 'orange': 'orange', 'rust': 'rust orange', 'gold': 'gold', 'silver': 'silver', 'amber': 'amber orange',
}
# words that look like colors but name a thing ("red wine glass", "Ruby Cardi")
NOT_A_COLOR_HERE = {('red', 'wine'), ('olive', 'led'), ('olive', 'light')}
# words that mean something else when the next word is this ("jean jacket" isn't jeans)
NOT_THIS_HERE = {('jean', 'jacket'), ('denim', 'jacket'), ('glove', 'ballet'), ('glove', 'flats'), ('frame', 'bag'), ('lace', 'boots'), ('lace', 'up'),
                 ('blanket', 'coat'), ('crew', 'cardigan'), ('red', 'wine')}

# ---- the image's own colors ---------------------------------------------------------
# Reference shades. Each pixel is matched to the closest one.
SHADES = [
    ('black', (22, 22, 24), 'black'), ('black', (40, 38, 40), 'black'),
    ('charcoal', (68, 68, 72), 'charcoal gray'), ('gray', (120, 120, 122), 'gray'), ('gray', (175, 175, 175), 'gray'),
    ('white', (246, 246, 243), 'white'), ('cream', (238, 228, 206), 'cream white'),
    ('beige', (212, 194, 166), 'beige'), ('tan', (186, 145, 100), 'tan brown'),
    ('brown', (125, 82, 50), 'brown'), ('brown', (82, 56, 40), 'brown'),
    ('red', (186, 32, 38), 'red'), ('burgundy', (110, 26, 40), 'burgundy red'),
    ('pink', (238, 168, 186), 'pink'), ('pink', (214, 112, 142), 'pink'), ('pink', (247, 210, 214), 'pink'),
    ('orange', (228, 122, 44), 'orange'), ('rust', (166, 78, 42), 'rust orange'),
    ('yellow', (240, 208, 74), 'yellow'), ('yellow', (246, 230, 150), 'yellow'), ('mustard', (196, 150, 40), 'mustard yellow'),
    ('green', (64, 128, 72), 'green'), ('sage', (150, 170, 128), 'sage green'), ('olive', (108, 106, 58), 'olive green'),
    ('mint', (178, 220, 196), 'mint green'), ('green', (36, 70, 50), 'green'),
    ('blue', (58, 108, 190), 'blue'), ('light-blue', (156, 192, 226), 'light-blue blue'), ('navy', (32, 40, 78), 'navy blue'),
    ('denim', (78, 102, 140), 'denim blue'),
    ('purple', (118, 78, 150), 'purple'), ('lilac', (196, 168, 214), 'lilac purple'),
]

def _lab(rgb):
    def f(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (f(c) for c in rgb)
    x = (r * .4124 + g * .3576 + b * .1805) / .95047
    y = (r * .2126 + g * .7152 + b * .0722)
    z = (r * .0193 + g * .1192 + b * .9505) / 1.08883
    g3 = lambda t: t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    fx, fy, fz = g3(x), g3(y), g3(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))

SHADE_LAB = [(n, _lab(c), tags) for n, c, tags in SHADES]

def image_colors(path, min_share=0.22):
    """Main colors in a cutout (ignoring see-through pixels). Returns tags, biggest first."""
    im = Image.open(path).convert('RGBA')
    im.thumbnail((96, 96))
    counts, total = {}, 0
    for r, g, b, a in (im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()):
        if a < 200:
            continue
        L, A, B = _lab((r, g, b))
        best = min(SHADE_LAB, key=lambda s: (s[1][0] - L) ** 2 + (s[1][1] - A) ** 2 + (s[1][2] - B) ** 2)
        counts[best[2]] = counts.get(best[2], 0) + 1
        total += 1
    if not total:
        return []
    # merge shades that share a main color word (two blacks, three pinks…)
    merged = {}
    for tags, n in counts.items():
        merged[tags.split()[-1]] = merged.get(tags.split()[-1], 0) + n
        merged.setdefault('_tags_' + tags.split()[-1], set()).update(tags.split())
    out = []
    for key, n in sorted(((k, v) for k, v in merged.items() if not k.startswith('_')), key=lambda kv: -kv[1]):
        if n / total >= min_share and len(out) < 2:
            out += sorted(merged['_tags_' + key])
    return out

# ---- putting it together --------------------------------------------------------------
def words_of(*texts):
    s = ' '.join(t for t in texts if t).lower()
    s = s.replace('é', 'e').replace('’', "'")
    return re.findall(r"[a-z]+", s)

def guess_tags(item):
    path = ''
    try:
        path = urlparse(item.get('url') or '').path
    except ValueError:
        pass
    name_words = words_of(item.get('name'))
    link_words = words_of(path, item.get('id'))
    tags = []
    for words in (name_words, link_words):
        for i, w in enumerate(words):
            nxt = words[i + 1] if i + 1 < len(words) else ''
            if w in WORDS and (w, nxt) not in NOT_THIS_HERE:
                tags += WORDS[w].split()
    if 'denim' in name_words + link_words and 'jacket' in tags:
        tags.append('denim')
    text_colors = []
    for words in (name_words, link_words):
        for i, w in enumerate(words):
            nxt = words[i + 1] if i + 1 < len(words) else ''
            if w in COLOR_WORDS and (w, nxt) not in NOT_A_COLOR_HERE:
                text_colors += COLOR_WORDS[w].split()
    if item.get('shelf') == 'Home decor':
        tags.append('home')
    pic = ROOT / item['src']
    pix = image_colors(pic) if pic.exists() else []
    # the store's own color word wins; the picture fills in when the store says nothing
    colors = text_colors or pix
    out = []
    for t in colors + tags:
        if t not in out:
            out.append(t)
    return out

def load():
    html = INDEX.read_text(encoding='utf8')
    lists = {}
    for name in ('PRODUCTS', 'DECOR'):
        m = re.search(r'^const ' + name + r' = (\[.*\]);$', html, re.M)
        if not m:
            sys.exit(f"Couldn't find the {name} list in index.html")
        lists[name] = (m, json.loads(m.group(1)))
    return html, lists

def main():
    dry = '--dry-run' in sys.argv
    redo = sys.argv[sys.argv.index('--redo') + 1] if '--redo' in sys.argv else None
    html, lists = load()
    changed = 0
    for name, (m, items) in lists.items():
        for it in items:
            if it.get('tags') and it['id'] != redo:
                continue
            it['tags'] = guess_tags(it)
            changed += 1
            print(f"{it['id']:44} {', '.join(it['tags'])}")
    if dry or not changed:
        print(f'\n{changed} item(s) would get tags.' if dry else 'Every item already has tags.')
        return
    for name, (m, items) in lists.items():
        line = f'const {name} = ' + json.dumps(items, ensure_ascii=False) + ';'
        html = html.replace(m.group(0), line, 1)
    INDEX.write_text(html, encoding='utf8')
    print(f'\nTagged {changed} item(s). Look them over, then fix any wrong tags by hand in index.html.')

if __name__ == '__main__':
    main()
