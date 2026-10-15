# erikacary.com design system

The tokens, components and rules behind the portfolio: the home page, the `/work` gate, the audience pages and the case studies. Kamira is a separate product with its own look, so nothing here comes from it or applies to it.

I extracted everything from the live CSS on `main` (October 15, 2026). The live pages don't load these files yet. Swapping them in changes nothing on screen, apart from two bugs the system fixes (see [Audit](#audit)).

Open `index.html` to see every token and component rendered:

```bash
npx serve -p 4173 .
```

Then go to `http://localhost:4173/design-system/`.

## Files

| File | What it is |
|---|---|
| `tokens.css` | Every value: color, type, space, layout, shape, depth, motion. The source of truth. |
| `components.css` | Every reusable component, built only on tokens. Class names match the live pages. |
| `carousel.js` | The case-study carousel, for any number of slides. |
| `tokens.json` | The same tokens in the W3C design tokens format, for Figma (Tokens Studio) or Style Dictionary. Generated. |
| `build-tokens.js` | Regenerates `tokens.json` from `tokens.css`. Run `node design-system/build-tokens.js` after any token edit. |
| `index.html` | The specimen page. |
| `img/` | Placeholder screens for the specimen. No real work appears in this folder. |

## Use it

Load the fonts, then the two stylesheets, in this order:

```html
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/design-system/tokens.css">
<link rel="stylesheet" href="/design-system/components.css">
```

Behavior lives in the root scripts the site already uses: `cursor.js` (rose cursor), `reveal.js` (scroll reveal), `copy-email.js` (email links copy the address). Add `carousel.js` on pages with a carousel.

Page-only styles go in the page and use tokens only. No raw hex values, pixel sizes or shadows.

## Rules

**Color.** Paper, plum ink and one accent. Rose marks what to look at or click: labels, links, the cursor, the curtain, hover fills. Nothing else gets a color.

**Type.** Bricolage Grotesque for names, titles, headings and quotes. Schibsted Grotesk for everything you read. All caps only for short labels that name something, never for a sentence. Emphasis inside reading text is ink and semibold. The one italic on the site is the quoted question on the home page.

**Links.** Links never underline. A soft pill washes in behind them on hover. Buttons lift 1px.

**Media.** Screens float on the rose wash with a soft ink shadow. They are never stretched to fill. Every video autoplays muted, loops, plays inline and has an `aria-label` that says what happens in it.

**Motion.** Rounded, never straight lines. Blocks fade in and rise on load and on scroll, once. Under Reduce Motion the fades stay and the movement stops. The curtain and the cursor turn off.

**Dividers.** None on wide screens, where the layout separates sections. Below 860px, where sections stack, a fine row of dots marks each boundary.

**Content.**
- A project tile header always reads: project name · first-person subheader on what I did and the outcome · "Role · years" · a fourth line only for acquisition notes.
- A project reads word for word the same on every page it appears on.
- Peer quotes read as if spoken to a stranger. They use Erika's name, never "you". Cite by title and year only.
- Audience pages are named for an audience type, never a company or role.

## Tokens

### Color

| Token | Value | Use | On paper |
|---|---|---|---|
| `--paper` | `#F9F4F6` | Page background | |
| `--surface` | `#FFFFFF` | Inputs, frames, cards | |
| `--ink` | `#2B2130` | Text, primary button | 14.2:1 |
| `--muted` | `#6E6072` | Reading text | 5.4:1 |
| `--subtle` | `#8D7E91` | Meta, nav, cites | 3.5:1 ⚠ |
| `--rose` | `#B4547E` | The accent | 4.3:1 ⚠ |
| `--hairline` | `#E2D6DC` | Frame borders | |
| `--border` | `#D5C4CD` | Ghost button, input, tag, dots | |
| `--wash` | `#F2E8ED` | Hover wash, empty media | |
| `--wash-deep` | `#E7D6DF` | Gradient end | |
| `--wash-gradient` | wash → wash-deep, 135° | Behind every screen | |
| `--paper-glass` | paper at 94% | Sticky header bar | |
| `--stage-dark` | `#121212` | Behind a dark slide | |

Charts and controls also use `--rose-tint`, `--neutral-tint`, `--neutral`, `--control-off-bg`, `--control-off-fg` and `--control-pending`. `--btn-border` and `--btn-wash` still work as aliases for `--border` and `--wash`.

### Type

Sizes are fluid: the smaller number is the phone size, the larger the desktop size.

| Style | Family | Weight | Size | Used for |
|---|---|---|---|---|
| `hero` | Display | 800 | 112px max (14vw) | The home page name |
| `title-lg` | Display | 800 | 36 → 64px | Audience page title |
| `title` | Display | 800 | 34 → 56px | Case-study title |
| `title-sm` | Display | 800 | 30 → 42px | Gate title |
| `heading-lg` | Display | 700 | 24 → 34px | Tile title |
| `heading` | Display | 700 | 22 → 30px | Case-study section title |
| `heading-sm` | Display | 600 | 22 → 28px | Footer headline |
| `heading-xs` | Display | 700 | 21 → 26px | Home claim title |
| `subheading` | Display | 500 | 20 → 24px | Tile subheader |
| `quote` | Display | 500 | 18 → 21px | Peer quote (22px beside an embed) |
| `wordmark` | Display | 800 | 22px | "Erika Cary" in the nav |
| `statement` | Text | 400 | 22 → 30px | Home positioning line |
| `lede` | Text | 400 | 18 → 22px | Audience page intro |
| `body-lg` | Text | 400 | 17 → 19px | Case-study story and sections |
| `body` | Text | 400 | 17px | Facts in a tile |
| `ui` | Text | 500–600 | 16px | Buttons, inputs, tile meta line |
| `small` | Text | 400 | 15px | Nav, captions, case-study facts |
| `meta` | Text | 400 | 14px | Meta, cites, back link |
| `fine` | Text | 400 | 13px | Footer copy, "Copied" |
| `label` | Text | 600 | 12px, caps, 0.12em | Eyebrows, tags |

Each style has a matching `.t-*` class in `components.css` and a text style in `tokens.json`.

### Space, layout, shape, depth, motion

- **Space.** A 4px grid (`--space-1` = 4px up to `--space-16` = 64px), with 2px half steps (`--space-1-5` = 6px and so on) next to type. Gaps between big blocks grow with the screen: `--space-tiles` 64 → 112px, `--space-section` 64 → 104px, `--space-footer` 72 → 120px.
- **Layout.** Content 1200px wide, page intro 860px, paragraphs 720px, gate 560px. Side padding 24 → 64px. Tiles and two-quote rows split 5:7 with a 28 → 72px gutter. Columns stack at 860px.
- **Shape.** Pills (999px) for anything you click. 16px for tile heroes, 14px for figures, 12px for cards, 10px for desktop screens, 22–28px for phones.
- **Depth.** Four ink-tinted shadows: `lift` (hovered button), `soft` (phones in a row), `float` (screens on the wash), `float-strong` (phones on the wash).
- **Motion.** `--ease-out` for entrances, reveals and lifts. `--ease-settle`, `--ease-sweep` and `--ease-leave` for the curtain. `--ease-spring` for the letters in the home name. Hovers take 200ms, entrances 640ms, reveals 700ms, the curtain 900ms. Carousels hold each slide 7 seconds.

## Components

| Component | Classes | Variants and states |
|---|---|---|
| Button | `.btn` + `.btn-primary` / `.btn-ghost` | Hover: primary washes to rose, ghost fills with the wash, both lift 1px. Disabled: 55% opacity, no lift. One size, 54px tall. |
| Nav link, back link | `.nav a`, `.wk-links a`, `.cs-back`, `.link-pill` | Subtle text. Hover: wash pill, ink text. |
| Inline link | `.link-inline`, `.lock-contact a` | Ink text in a sentence, tighter pill on hover. |
| Call to action | `.wk-more` | Rose, semibold. Hover: rose underline. |
| Wordmark | `.wk-brand`, `.lock-home`, `.header-bar-name` | |
| Labels | `.wk-eyebrow`, `.hero-role`, `.lock-eyebrow`, `.wk-tag` | Eyebrow names the block below. Tag rides inside a meta line. |
| Header bar | `.header-bar` | Home only. Fades in past the name (`.is-visible`). Dotted bottom edge. |
| Home name | `.hero-name` | Letters lift and blush rose under the pointer. |
| Page intro | `.wk-intro`, `.wk-title`, `.wk-lede` | |
| Project tile | `.wk-tile`, `.wk-tile-body`, `.wk-tile-head`, `.wk-tile-title`, `.wk-tile-sub`, `.wk-meta`, `.wk-role`, `.wk-aside` | Header left, facts right, stacked below 860px. Reveals hero, then header, then facts. |
| Media hero | `.wk-hero` + `--desk`, `--recording`, `--film`, `--video`, `--phones`, `--screens`, `--compare`, `--card`, `--cycle`, `--dark` | 16:10, 4:3 below 860px. `--cycle` crossfades up to four screens. No page uses `--phones`, `--cycle` or `--dark` yet. |
| Facts list | `.wk-facts` (a `<dl>`) | Labels sit above the text below 560px. |
| Quotes | `.wk-quotes` + `--2` / `--4`, `.wk-quote` | Three in a row, two on the 5:7 split, four two by two (no page uses four yet). One column below 860px. |
| Case study | `.cs-back`, `.cs-head`, `.cs-title`, `.cs-facts`, `.cs-hero`, `.cs-story`, `.cs-credit`, `.cs-section`, `.cs-section-title`, `.cs-text`, `.cs-figure`, `.cs-caption` | |
| Wash panel | `.cs-wash` + `--wide`, `--fit`, `--bleed`, `--video`, `--slot`. Inside: `.cs-doc`, `.cs-shot`, `.cs-full`, `.cs-ia`, `.cs-hifi` | A case-study figure on the hero's rose wash. `--fit` keeps one 16:10 shape for carousel slides. `.cs-hifi` crossfades two screenshots. `.is-paused` shows a play badge on a paused clip. |
| Figure frames | `.cs-phones` (+ `--tall`, `--2`, `--3`), `.cs-shots`, `.cs-two`, `.cs-scroll`, `.cs-wide`, `.cs-video--phone`, `.cs-placeholder`, `.cs-placeholders-3` | `.cs-wide` scrolls sideways below 700px. `.cs-placeholder` holds space for media still to come. No page uses `.cs-two`, `.cs-scroll` or `.cs-phones--2` yet. |
| Carousel | `.cs-carousel` (+ `--center`), `.cs-slide`, `.cs-carousel-bar`, `.cs-arrow` | Arrow: rose, pale when disabled. While cycling, the arrow that will turn the page (`.is-filling`) goes grey and fills with rose. |
| Password gate | `.lock`, `.lock-title`, `.lock-form`, `.lock-input`, `.lock-error`, `.lock-contact`, `.lock-copy` | Input focus: rose border. Busy: button says "Opening…" and is disabled. Error: rose line that holds its space. Copy: icon becomes a check and "Copied". |
| Curtain | `.lock-curtain` | Rises, sweeps up to cover, lifts off. Off under Reduce Motion. |
| Footer | `.site-footer`, `.footer-lockup`, `.footer-headline`, `.footer-buttons`, `.footer-copy` | Same on every page. |
| Divider | `.divider-dots` | Automatic above tiles, quotes, sections and the footer below 860px. |
| Cursor | `.cur-dot`, `.cur-ring` | Fine pointers only. Ring grows over anything clickable, hides over text fields. |

### Accessibility

- **Focus.** Every control shows a 2px rose ring, offset 2px, on keyboard focus. The password field shows focus with its rose border instead.
- **Carousel.** The figure has `aria-roledescription="carousel"`. Each slide is a `group` with `aria-roledescription="slide"` and a label like "1 of 3". Hidden slides get `aria-hidden` and take their links out of the tab order. The caption is `aria-live="polite"`. Each arrow has an `aria-label` that names where it goes. Any click or scroll stops the cycle for good, and it never cycles under Reduce Motion.
- **Gate.** The field has a visually hidden label. The error line has `role="alert"`. A visually hidden status line announces "Opening…".
- **Copy email.** The icon button has `aria-label="Copy email address"`, which becomes "Copied" while the check shows.
- **Cursor and curtain.** Decorative and `aria-hidden`. Both turn off under Reduce Motion, and the cursor turns off on touch.

## Audit

What the extraction found in the live CSS, and what the system does about it.

| Finding | Where | In the system |
|---|---|---|
| The tokens are defined twice. `style.css` and `work.css` each carry the same 13 tokens, plus copies of the buttons, footer, cursor, hover rules, reveal and entrance motion. | Both stylesheets | One `tokens.css`, one `components.css`. |
| 27 hex values and 11 shadows are written out by hand in `work.css`. The rose wash gradient alone is repeated 10 times. The case-study pages add 9 more raw colors. | `work.css`, page styles | All are tokens. |
| `--btn-border` and `--btn-wash` style inputs, tags, dividers, media backgrounds and placeholders, not just buttons. | Everywhere | Renamed `--border` and `--wash`. The old names still work. |
| Case-study styles are copied between pages. THE YES and Creator Hub each define `.cs-text`, `.cs-placeholder` and the whole carousel. The two carousels have drifted: THE YES fills every live arrow while cycling, Creator Hub only the next one. | Page `<style>` blocks | Promoted to `components.css` and `carousel.js`, using Creator Hub's version. Creator Hub's wash panels are promoted too. |
| **Bug.** On a phone, THE YES journey carousel makes the whole page scroll sideways (786px wide on a 375px screen). Its slides can't shrink, so the 760px diagram stretches the page instead of scrolling in its frame. | THE YES case study | `.cs-slide { min-width: 0 }` fixes it. |
| **Bug.** `.cs-figure img` reaches into heroes inside a figure, giving phone screens 14px corners and a wash behind them. Pages patch it back with overrides (`#quiz-carousel …`, `.cs-figure .wk-hero--video video`). | `work.css` | Figure styles apply only to media placed straight in the figure. The overrides are no longer needed. |
| Dead CSS. `.cs-back` declares a 40–64px top margin that a later hover rule cancels. `.lock-eyebrow`, `.lock-sub`, `.lock-curtain.is-covering` and `.wk-voice` match nothing on any page. Creator Hub still carries the styles for the timeline it removed (`.tl`). | `work.css`, Creator Hub | Dropped. The system keeps what's on screen. |
| Only the carousel arrows and chart buttons have a focus style. Links and buttons fall back to the browser outline. | Everywhere | A rose focus ring on every control. |

### Fidelity check

I opened every portfolio page from `main`, swapped `style.css` or `work.css` for the two system files, and compared 38 computed properties on every element. The pages: home, gate, the three audience pages and the four case studies (decrypted through the local gate), at 1280px and 390px wide. For THE YES and Creator Hub I also deleted the page styles the system now covers. Every element matched, except the ones the two bug fixes above change. The rose focus ring only shows on keyboard focus, so the check doesn't cover it.

## Decisions for Erika

The system matches the site as it is. These would tighten it. Each one changes how the site looks, so none is applied.

1. **Fewer type sizes.** The site uses 22 font sizes. Six merges would bring it to 16 without touching the sizes you picked on purpose:
   - Audience page title 64px → 56px, the case-study title size.
   - Tile title 34px → 30px, the section title size.
   - Footer headline 28px and claim title 26px → one size.
   - The quote beside an embed 22px → 21px, like every other quote.
   - Claim evidence → `body-lg` (17px instead of 16px on phones).
   - Meta 14px → 15px or 13px.
2. **One caps label.** Eyebrows and tags are semibold with 0.12em spacing. The home role label (17px) and the header-bar role (13px) are medium with 0.14em. Pick one weight and spacing for both.
3. **Contrast.** `--subtle` (3.5:1) and `--rose` (4.3:1) fall short of the 4.5:1 that small text needs. They're used for nav links, meta lines, cites, eyebrows, errors and "See the case study". Options:
   - Darken `--subtle` to `#796C7D` (4.5:1). It moves close to `--muted`, so the two would blur together.
   - Add a `--rose-text` for text under 18px: `#AF517A` passes on paper, `#A44C73` passes on the wash too. Rose fills, the cursor and large text keep `#B4547E`.
   - The primary button's rose hover (paper on rose, 4.3:1) would pass with either rose.
4. **Line heights.** Titles use 1.02, 1.04 and 1.05. Headings use 1.12 and 1.15. Merging to 1.04 and 1.15 moves text by under 2px per line.
5. **Move the live site onto the system.** Link the two files from every page and delete the duplicated rules in `style.css` and `work.css`. In THE YES and Creator Hub, delete the page styles the system now covers. Swap THE YES's carousel script for `carousel.js`. Creator Hub's script also pauses clips, so check it before swapping.

## Not in the system

- **Kamira.** A separate product with its own design.
- **One-off figures.** THE YES signal quadrant (`.yq`) and its quiz-screen crop (`#quiz-carousel`), plus Creator Hub's side-menu row (`.cs-navs`), stay in their pages. They use the chart tokens: `--rose-tint`, `--neutral-tint`, `--neutral`, `--halo-rose`, `--ease-pop`.
- **Dark mode.** The site has none.
