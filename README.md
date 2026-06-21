# ReViet — Static Business Website

Premium Vietnamese handcrafted-goods marketplace. Built with **HTML, CSS, JavaScript, and JSON** — no build step, no framework.

## Folder structure

```
ReViet/
├── index.html              # Home page (built from the Figma design)
├── pages/                  # Secondary pages (about/services/contact — placeholders, pending rebrand)
└── assets/
    ├── css/
    │   ├── style.css       # Design tokens + all section styles
    │   └── responsive.css  # Media queries (loaded last)
    ├── js/
    │   └── main.js         # Nav toggle, search toggle, newsletter
    ├── json/
    │   ├── site-config.json
    │   ├── products.json   # New Arrivals data
    │   └── collections.json
    ├── images/             # Photos (see filenames below)
    ├── icons/              # favicon
    └── fonts/              # self-hosted fonts (optional)
```

## Adding the real photos

The homepage already looks finished using soft color placeholders. Drop real
photos into `assets/images/` with these exact names and they appear automatically
(the CSS layers each photo over its placeholder gradient):

| File | Used for |
| --- | --- |
| `hero.jpg` | Hero background |
| `collection-home.jpg` | Collections — Home Decor (large card) |
| `collection-fashion.jpg` | Collections — Fashion |
| `collection-lifestyle.jpg` | Collections — Lifestyle |
| `maker.jpg` | The Maker's Story |
| `product-tea-set.jpg` | New Arrivals — Imperial Lacquer Tea Set |
| `product-scarf.jpg` | New Arrivals — Indigo Mountain Scarf |
| `product-lantern.jpg` | New Arrivals — Lotus Lantern |
| `product-dining-set.jpg` | New Arrivals — Stoneware Dining Set |

## Run locally

```bash
python -m http.server 8000   # then open http://localhost:8000
```

## Design notes

- Palette: warm cream background, dark olive-green ink, sage buttons, dark-green footer.
- Type: **Playfair Display** (serif headings) + **Jost** (sans body), loaded from Google Fonts with system fallbacks.
- Fixed an obvious typo from the mock ("racking" → "Tracking" in the Transparent Lifecycle card).
