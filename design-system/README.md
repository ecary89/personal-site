# erikacary.com design system

The tokens, components and rules behind the portfolio: the home page, the `/work` gate, the audience pages and the case studies. Kamira is a separate product with its own look, so nothing here comes from it or applies to it.

I extracted the system from the live CSS on `main` on October 15, 2026, then revised it with Erika on October 16. The live pages don't load these files yet. Moving the site onto them changes how the pages look. [What changes on the live site](#what-changes-on-the-live-site) lists every change.

Open `index.html` to see every token and component, or `preview.html` to flip real pages between the current site and the design system:

```bash
npx serve -p 4173 .
```

Then go to `http://localhost:4173/design-system/` or `http://localhost:4173/design-system/preview`.

## Files

| File | What it is |
|---|---|
| `tokens.css` | Every value: color, type, space, layout, shape, depth, motion. The source of truth. |
| `components.css` | Every reusable component, built only on tokens. Class names match the live pages. |
| `carousel.js` | The case-study carousel, for any number of slides. |
| `tokens.json` | The same tokens in the W3C design tokens format, for Figma (Tokens Studio) or Style Dictionary. Generated. |
| `build-tokens.js` | Regenerates `tokens.json` from `tokens.css`. Run `node design-system/build-tokens.js` after any token edit. |
| `index.html` | The specimen page. |
| `preview.html` | Flips the home page, gate and portfolio pages between the current site and the design system. The locked pages come from `work/_src`, so they only open on Erika's laptop. |
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

**Color.** Paper, plum ink and one accent. Rose marks what to look at or click. Fills and large text use `--rose`. Rose text under 18px uses the darker `--rose-text`. Every secondary text, from reading text to meta lines, is `--muted`. All text reaches 4.5:1.

**Type.** Eight sizes. Bricolage Grotesque for names, titles, headings and quotes. Schibsted Grotesk for everything you read. No all caps anywhere. Emphasis inside reading text is ink and semibold. The one italic on the site is the quoted question on the home page.

**Labels.** A label names the block below it, in a few words and sentence case: 15px, semibold, rose text. A tag rides at the end of a meta line in rose, after a middle dot. No outlined pills.

**Links.** Nav links and links inside a sentence get a soft wash pill on hover. The back link and calls to action ("See the case study") underline instead. Buttons lift 1px.

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
| `--muted` | `#6E6072` | Reading text, meta lines, nav, captions, cites | 5.4:1 |
| `--rose` | `#B4547E` | Fills and large text: arrows, cursor, curtain, focus ring | 4.3:1, large text only |
| `--rose-text` | `#A44C73` | Rose text under 18px: labels, links, tags, errors. Primary button hover. | 5.0:1 |
| `--hairline` | `#E2D6DC` | Frame borders | |
| `--border` | `#D5C4CD` | Ghost button, input, dotted dividers | |
| `--wash` | `#F2E8ED` | Hover wash, empty media | |
| `--wash-deep` | `#E7D6DF` | Gradient end | |
| `--wash-gradient` | wash → wash-deep, 135° | Behind every screen | |
| `--paper-glass` | paper at 94% | Sticky header bar | |

Charts and controls also use `--rose-tint`, `--neutral-tint`, `--neutral`, `--stage-graphite`, `--control-off-bg`, `--control-off-fg` and `--control-pending`. Old names still work: `--btn-border` and `--btn-wash` point to `--border` and `--wash`, and `--subtle` now points to `--muted`.

### Type

Eight sizes. Fluid sizes run from the phone size to the desktop size.

| Size | Token | Phone → desktop | Used for |
|---|---|---|---|
| 112 | `--size-hero` | 14vw → 112px | The home page name |
| 56 | `--size-title` | 34 → 56px | Every page title: audience pages, case studies, the gate |
| 30 | `--size-heading` | 22 → 30px | Tile and section titles, footer headline, home claims, home statement |
| 21 | `--size-subheading` | 18 → 21px | Tile subheader, home role, page intro, quotes. The wordmark is 21px at every width. |
| 19 | `--size-body-lg` | 17 → 19px | Case-study reading text, home claim evidence |
| 17 | `--size-body` | 17px | Facts, buttons, inputs |
| 15 | `--size-small` | 15px | Nav, labels, meta lines, captions, cites, the back link |
| 12 | `--size-fine` | 12px | Footer copy, "Copied" |

Text styles pair a size with a family, weight and color. Each has a `.t-*` class in `components.css` and a text style in `tokens.json`.

| Style | Family | Weight | Size |
|---|---|---|---|
| `hero` | Display | 800 | 112 |
| `title` | Display | 800 | 56 |
| `heading` | Display | 700 | 30 |
| `subheading` | Display | 500 | 21 |
| `quote` | Display | 500 | 21 |
| `wordmark` | Display | 800 | 21 |
| `statement` | Text | 400 | 30 |
| `lede` | Text | 400, muted | 21 |
| `body-lg` | Text | 400, muted | 19 |
| `body` | Text | 400, muted | 17 |
| `small` | Text | 400, muted | 15 |
| `label` | Text | 600, rose text | 15 |
| `fine` | Text | 400, muted | 12 |

### Space, layout, shape, depth, motion

- **Space.** A 4px grid (`--space-1` = 4px up to `--space-16` = 64px), with 2px half steps (`--space-1-5` = 6px and so on) next to type. Gaps between big blocks grow with the screen: `--space-tiles` 64 → 112px, `--space-section` 64 → 104px, `--space-footer` 72 → 120px.
- **Layout.** Content 1200px wide, page intro 860px, paragraphs 720px, gate 640px, footer lockup 560px. Side padding 24 → 64px. Tiles and two-quote rows split 5:7 with a 28 → 72px gutter. Columns stack at 860px.
- **Shape.** Pills (999px) for buttons, inputs and hover washes. 16px for tile heroes, 14px for figures, 12px for cards, 10px for desktop screens, 22–28px for phones.
- **Depth.** Four ink-tinted shadows: `lift` (hovered button), `soft` (phones in a row), `float` (screens on the wash), `float-strong` (phones on the wash).
- **Motion.** `--ease-out` for entrances, reveals and lifts. `--ease-settle`, `--ease-sweep` and `--ease-leave` for the curtain. `--ease-spring` for the letters in the home name. Hovers take 200ms, entrances 640ms, reveals 700ms, the curtain 900ms. Carousels hold each slide 7 seconds.

## Components

| Component | Classes | Variants and states |
|---|---|---|
| Button | `.btn` + `.btn-primary` / `.btn-ghost` | Hover: primary washes to the darker rose, ghost fills with the wash, both lift 1px. Disabled: 55% opacity, no lift. One size, 54px tall. |
| Nav link | `.nav a`, `.wk-links a`, `.link-pill` | Muted text. Hover: wash pill, ink text. |
| Back link | `.cs-back` | Muted, flush with the wordmark above it. Hover: ink text and an underline. |
| Inline link | `.link-inline`, `.lock-contact a` | Ink text in a sentence, tighter pill on hover. |
| Call to action | `.wk-more` | Rose text, semibold. Hover: underline. |
| Wordmark | `.wk-brand`, `.lock-home`, `.header-bar-name` | Never breaks onto two lines. |
| Labels | `.wk-eyebrow`, `.t-label` | Sentence case, 15px semibold, rose text. Names the block below. |
| Home role | `.hero-role`, `.header-bar-role` | A 21px subtitle under the home name. The sticky header bar repeats it as a label. |
| Tag | `.wk-tag` | Rose text at the end of a meta line, after a middle dot. Moves down whole if the line runs out of room. |
| Header bar | `.header-bar` | Home only. Fades in past the name (`.is-visible`). Dotted bottom edge. |
| Home name | `.hero-name` | Letters lift and blush rose under the pointer. |
| Page intro | `.wk-intro`, `.wk-title`, `.wk-lede` | |
| Project tile | `.wk-tile`, `.wk-tile-body`, `.wk-tile-head`, `.wk-tile-title`, `.wk-tile-sub`, `.wk-meta`, `.wk-role`, `.wk-aside` | Header left, facts right, stacked below 860px. The header's two gaps match (about 14px), so it reads as one block. Reveals hero, then header, then facts. |
| Media hero | `.wk-hero` + `--desk`, `--recording`, `--film`, `--video`, `--screens`, `--compare`, `--card` | 16:10, 4:3 below 860px. |
| Facts list | `.wk-facts` (a `<dl>`) | Labels sit above the text below 560px. |
| Quotes | `.wk-quotes` + `--2`, `.wk-quote` | Three in a row, or two on the 5:7 split. One column below 860px. |
| Case study | `.cs-back`, `.cs-head`, `.cs-title`, `.cs-facts`, `.cs-hero`, `.cs-story`, `.cs-credit`, `.cs-section`, `.cs-section-title`, `.cs-text`, `.cs-figure`, `.cs-caption` | |
| Wash panel | `.cs-wash` + `--wide`, `--fit`, `--bleed`, `--video`, `--slot`. Inside: `.cs-doc`, `.cs-shot`, `.cs-full`, `.cs-ia`, `.cs-hifi` | A case-study figure on the hero's rose wash. `--fit` keeps one 16:10 shape for carousel slides. `.cs-hifi` crossfades two screenshots. `.is-paused` shows a play badge on a paused clip. |
| Figure frames | `.cs-phones` (+ `--tall`, `--3`), `.cs-shots`, `.cs-wide`, `.cs-video--phone`, `.cs-placeholder`, `.cs-placeholders-3` | `.cs-wide` scrolls sideways below 700px. `.cs-placeholder` holds space for media still to come. |
| Carousel | `.cs-carousel` (+ `--center`), `.cs-slide`, `.cs-carousel-bar`, `.cs-arrow` | Arrow: rose, pale when disabled. While cycling, the arrow that will turn the page (`.is-filling`) goes gray and fills with rose. |
| Password gate | `.lock`, `.lock-title`, `.lock-form`, `.lock-input`, `.lock-error`, `.lock-contact`, `.lock-copy` | Input focus: rose border. Busy: button says "Opening…" and is disabled. Error: rose line that holds its space. Copy: icon becomes a check and "Copied". |
| Curtain | `.lock-curtain` | Rises, sweeps up to cover, lifts off. Off under Reduce Motion. |
| Footer | `.site-footer`, `.footer-lockup`, `.footer-headline`, `.footer-buttons`, `.footer-copy` | Same on every page. |
| Divider | `.divider-dots` | Automatic above tiles, quotes, sections and the footer below 860px. |
| Cursor | `.cur-dot`, `.cur-ring` | Fine pointers only. Ring grows over anything clickable, hides over text fields. |

### Accessibility

- **Contrast.** All text reaches 4.5:1 on paper. Rose text on the wash reaches 4.5:1 too.
- **Focus.** Every control shows a 2px rose ring, offset 2px, on keyboard focus. The password field shows focus with its rose border instead.
- **Carousel.** The figure has `aria-roledescription="carousel"`. Each slide is a `group` with `aria-roledescription="slide"` and a label like "1 of 3". Hidden slides get `aria-hidden` and take their links out of the tab order. The caption is `aria-live="polite"`. Each arrow has an `aria-label` that names where it goes. The waiting arrow's white icon reads at 3.8:1. Any click or scroll stops the cycle for good, and it never cycles under Reduce Motion.
- **Gate.** The field has a visually hidden label. The error line has `role="alert"`. A visually hidden status line announces "Opening…".
- **Copy email.** The icon button has `aria-label="Copy email address"`, which becomes "Copied" while the check shows.
- **Cursor and curtain.** Decorative and `aria-hidden`. Both turn off under Reduce Motion, and the cursor turns off on touch.

## What changes on the live site

The live pages still use `style.css` and `work.css`. Moving them onto the system changes these things, and nothing else:

- **Color.** Nav links, meta lines, cites, captions and the input placeholder go from the old gray (`#8D7E91`, 3.5:1) to `--muted`. Rose text (labels, links, the tag, errors, "Copied") and the primary button's hover use the darker `--rose-text`.
- **Type sizes.**
  - Page titles: 56px everywhere (audience pages were 64px, the gate 42px).
  - Headings: tile titles 34 → 30px, footer headline 28 → 30px, home claims 26 → 30px.
  - 21px tier: tile subheaders 24 → 21px, page intros 22 → 21px, the quote beside the embed 22 → 21px. Quotes stay 21px.
  - Wordmark 22 → 21px.
  - Small text: meta lines and cites → 15px (were 14px and 16px).
  - Buttons and inputs 16 → 17px. Footer copy 13 → 12px.
- **No caps.** Eyebrows, Before / After labels and the header-bar role are sentence case. The home role becomes a 21px subtitle.
- **Tag.** "Confidential, in flight" is rose text after a middle dot instead of an outlined pill.
- **Back link.** Lines up with the wordmark and underlines on hover instead of showing a pill.
- **Tile header.** The meta line sits 8px under the subheader, so the header reads as one block.
- **Gate.** 640px wide (was 560px), so its title sits on two lines.
- **Wordmark.** Never breaks onto two lines, even on a 375px phone.
- **Fixes.** THE YES carousel no longer makes the page scroll sideways on phones. Case-study figure styles no longer leak into heroes. Every control gets a rose focus ring.

`preview.html` shows all of it on the real pages.

## Audit

What the extraction found in the live CSS, and what the system does about it.

| Finding | Where | In the system |
|---|---|---|
| The tokens are defined twice. `style.css` and `work.css` each carry the same 13 tokens, plus copies of the buttons, footer, cursor, hover rules, reveal and entrance motion. | Both stylesheets | One `tokens.css`, one `components.css`. |
| 27 hex values and 11 shadows are written out by hand in `work.css`. The rose wash gradient alone is repeated 10 times. The case-study pages add 9 more raw colors. | `work.css`, page styles | All are tokens. |
| `--btn-border` and `--btn-wash` style inputs, dividers, media backgrounds and placeholders, not just buttons. | Everywhere | Renamed `--border` and `--wash`. The old names still work. |
| 22 font sizes, three page-title sizes and two caps-label specs. | Everywhere | Eight sizes, one title size, no caps. |
| Gray and rose text fall short of 4.5:1 (3.5:1 and 4.3:1) on nav links, meta lines, cites, eyebrows, errors and "See the case study". | Everywhere | `--muted` for gray text, `--rose-text` for rose text under 18px. |
| Case-study styles are copied between pages. THE YES and Creator Hub each define `.cs-text`, `.cs-placeholder` and the whole carousel. The two carousels have drifted: THE YES fills every live arrow while cycling, Creator Hub only the next one. | Page `<style>` blocks | Promoted to `components.css` and `carousel.js`, using Creator Hub's version. Creator Hub's wash panels are promoted too. |
| **Bug.** On a phone, THE YES journey carousel makes the whole page scroll sideways (786px wide on a 375px screen). Its slides can't shrink, so the 760px diagram stretches the page instead of scrolling in its frame. | THE YES case study | `.cs-slide { min-width: 0 }` fixes it. |
| **Bug.** `.cs-figure img` reaches into heroes inside a figure, giving phone screens 14px corners and a wash behind them. Pages patch it back with overrides (`#quiz-carousel …`, `.cs-figure .wk-hero--video video`). | `work.css` | Figure styles apply only to media placed straight in the figure. The overrides are no longer needed. |
| Dead CSS. `.cs-back` declares a 40–64px top margin that a later hover rule cancels. `.lock-eyebrow`, `.lock-sub`, `.lock-curtain.is-covering` and `.wk-voice` match nothing on any page. Creator Hub still carries the styles for the timeline it removed (`.tl`). | `work.css`, Creator Hub | Dropped. |
| Unused variants. No page uses the `--phones`, `--cycle` or `--dark` heroes, the four-quote grid, `.cs-two`, `.cs-scroll` or `.cs-phones--2`. | `work.css` | Dropped. |
| Only the carousel arrows and chart buttons have a focus style. Links and buttons fall back to the browser outline. | Everywhere | A rose focus ring on every control. |

The five phone corner rules stay. Each one matches the corners drawn into its own screenshots or recordings, so one shared radius would let those corners peek out.

### How it was checked

- **October 15, extraction.** I opened every portfolio page from `main`, swapped `style.css` or `work.css` for the system, and compared 38 computed properties on every element. The pages were home, the gate, the three audience pages and the four case studies (decrypted through the local gate), at 1280px and 390px wide. Every element matched, except the ones the two bug fixes change.
- **October 16, revision.** Erika reviewed the changes in `preview.html`. I snapshotted that approved preview on eight pages at both widths, moved it into `tokens.css` and `components.css`, and compared again. Every element matched.

## Next step

**Move the live site onto the system.** Link the two files from every page and delete the duplicated rules in `style.css` and `work.css`. In THE YES and Creator Hub, delete the page styles the system now covers. Swap THE YES's carousel script for `carousel.js`. Creator Hub's script also pauses clips, so check it before swapping. Before any commit that touches the work pages, make sure `work/_src` matches `main`, since the pre-commit hook re-encrypts from it.

## Not in the system

- **Kamira.** A separate product with its own design.
- **One-off figures.** THE YES signal quadrant (`.yq`) and its quiz-screen crop (`#quiz-carousel`), plus Creator Hub's side-menu row (`.cs-navs`), stay in their pages. They use the chart tokens: `--rose-tint`, `--neutral-tint`, `--neutral`, `--halo-rose`, `--ease-pop`.
- **Dark mode.** The site has none.
