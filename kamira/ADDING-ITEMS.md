# Adding shop items to Kamira

Instructions for any agent that finds products, downloads their pictures, and adds them to the site.

Search only finds what an item's **tags** say. An item with no tags is close to invisible. Every new item needs tags before it's pushed.

## Where items live

- Items are listed in `kamira/index.html`, on two long lines: `const PRODUCTS = [...]` (clothes, shoes, bags, extras) and `const DECOR = [...]` (home decor).
- Pictures are cutouts with a see-through background: `kamira/products/<id>.webp` or `kamira/decor/<id>.webp`.

Each item looks like this:

```json
{"id": "stories-jacket-leather", "brand": "& Other Stories", "name": "Leather Biker Jacket",
 "price": "$349", "url": "https://www.stories.com/...", "shelf": "Clothes", "scene": "cafe",
 "w": 600, "h": 720, "src": "products/stories-jacket-leather.webp",
 "tags": ["black", "leather", "jacket", "outerwear", "clothing"]}
```

## Steps

1. **Add the item** with every field above except `tags`. Put the store's color in the `id` when you can (`ev-studio-bag-black`). It helps the tagging script.
2. **Run the tagging script** from the repo root:
   `python3 kamira/scripts/tag-items.py`
   It adds first-guess tags to any item without them, and never touches items that already have tags.
3. **Look at each new picture and fix its tags by hand.** The script is a starting point. It gets confused by shading (black boots tagged "gray"), dark navy that looks black, and pieces with more than one color.
4. **Test search** on the live page or locally: type each new item's main color and type ("black", "boots") and make sure it shows up.
5. Commit and push as usual.

## What good tags look like

Short, plain, lowercase words someone would actually type. In this order:

1. **Colors**, main color first. Add the plain color too when you use a fancier one:
   - `navy` → also `blue`; `burgundy` → also `red`; `charcoal` → also `gray`; `cream` → also `white`; `tan` or `camel` → also `brown`; `lilac` → also `purple`; `sage`, `olive`, `mint` → also `green`; `rust` → also `orange`; `light-blue` → also `blue`
   - Use `gold`, `silver`, `tortoise`, `clear` (for clear glass) when they fit.
   - Two-color or striped pieces: list both colors.
2. **Material**: `leather`, `suede`, `wool`, `cashmere`, `cotton`, `silk`, `satin`, `velvet`, `lace`, `denim`, `ceramic`, `glass`, `metal`…
3. **Pattern**: `striped`, `floral`, `polka-dot`, `plaid`, `checkered`, `herringbone`, `paisley`, `animal-print`…
4. **Type, then its group**:
   - `dress` `clothing`, `jacket` `outerwear` `clothing`, `sweater` `knit` `top` `clothing`, `jeans` `denim` `pants` `clothing`
   - `boots` `shoes`, `flats` `shoes`, `heels` `shoes`, `loafers` `shoes`
   - `tote` `bag`, `clutch` `bag`
   - `earrings` `jewelry`, `scarf` `accessory`, `beanie` `hat` `accessory`
   - home items: the thing (`mug` `cup`, `vase`, `lamp` `light`, `pillow`, `candle`) plus `home`
5. **Fun details** a kid might search for: `swan`, `butterfly`, `cherry`, `fish`, `bow`.

Aim for 4 to 10 tags. Don't add words that are already in the item's name or brand just to pad. Search reads those too.

## Rules

- Don't change tags on items you didn't add, unless they're wrong.
- Use one spelling: `gray` not `grey`, `jewelry` not `jewellery`. Search treats common pairs as the same, but tags should be consistent.
- Plurals don't matter to search ("flat" finds "flats"), so pick the natural word.
