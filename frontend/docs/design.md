# Foster Connect - Design Spec

## 1. Aesthetic Direction: **Warm Institutional**

A blend of civic professionalism and human warmth. Think of the best-designed public library you've ever walked into — structured enough to feel trustworthy, soft enough to feel safe. No corporate coldness, no childish playfulness. Every surface communicates: _you belong here, and we take you seriously._ Trauma-informed means calm, predictable, and gently encouraging — never flashy, never overwhelming.

## 2. Color Palette

| Role                      | Color       | Hex                                              |
| ------------------------- | ----------- | ------------------------------------------------ |
| **Primary (dominant)**    | Emerald 600 | `#10b981`                                        |
| **Accent (sparingly)**    | Amber 500   | `#f59e0b`                                        |
| **Light background**      | Slate 50    | `#f8fafc`                                        |
| **Dark background**       | Slate 950   | `#020617`                                        |
| **Card surfaces (light)** | White       | `#ffffff`                                        |
| **Card surfaces (dark)**  | Slate 900   | `#0f172a`                                        |
| **Body text (light)**     | Slate 700   | `#334155`                                        |
| **Body text (dark)**      | Slate 200   | `#e2e8f0`                                        |
| **Supportive teal**       | Teal 500    | `#14b8a6` — used for progress indicators, badges |
| **Soft blue**             | Sky 400     | `#38bdf8` — used for chart accents, info states  |

**Usage rules:** Emerald is the hero — nav highlights, primary buttons, active states. Amber is reserved for CTAs that need urgency (quick action buttons, "Get Started" prompts) and achievement badges. Never place amber on emerald directly. Teal and sky are chart/data colors only.

## 3. Typography

| Role                   | Font                  | Weight                      | Size                                   |
| ---------------------- | --------------------- | --------------------------- | -------------------------------------- |
| **Display / Headings** | **Plus Jakarta Sans** | 700 (bold)                  | H1: 32px, H2: 24px, H3: 20px           |
| **Body / UI**          | **Plus Jakarta Sans** | 400 (regular), 500 (medium) | Body: 16px, Small: 14px, Caption: 12px |

Single font family for cohesion and fast loading. Plus Jakarta Sans is geometric, modern, and has a subtle humanist warmth in its rounded terminals — professional without being sterile. Line-height: 1.6 for body text (readability is a trauma-informed priority). Letter-spacing: -0.01em on headings for tightness, default on body.

Import: `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap`

## 4. Spatial Style

**Airy, symmetric, card-based grid.** Mobile-first with generous breathing room.

- **Page padding:** 24px mobile, 32px tablet, 48px desktop
- **Card padding:** 20px mobile, 24px desktop
- **Card border-radius:** 16px (all cards, modals, inputs)
- **Button border-radius:** 12px
- **Input border-radius:** 12px
- **Grid gap:** 16px mobile, 24px desktop
- **Section spacing:** 48px between major sections
- **Max content width:** 1200px, centered
- **Sidebar:** 260px wide on desktop, collapsed to icon-only (64px) on tablet, slide-over drawer on mobile
- **Card shadows (light):** `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- **Card shadows (dark):** `0 1px 3px rgba(0,0,0,0.3)`
- **Card hover lift:** translate Y -2px with shadow increase, 200ms ease

Layout grid: Single column on mobile. 2 columns for resource/stat cards on tablet. 3-4 columns on desktop. The AI Roadmap page uses a single centered column (max 720px) for the intake form, then a vertical timeline layout for the generated roadmap.

## 5. Signature Detail: **Progress Glow**

Every achievement, completed step, and progress indicator uses a soft emerald glow effect — a `0 0 20px rgba(16,185,129,0.25)` box-shadow that pulses gently once on state change (a single 1.5s ease-in-out animation). Progress badges on the home page, completed roadmap steps, and dashboard milestones all share this treatment. It's subtle enough to feel polished, but distinct enough that users feel a small moment of recognition every time they make progress. The glow says: _you did something, and it matters._

Animation: `@keyframes progressGlow { 0% { box-shadow: 0 0 0 rgba(16,185,129,0); } 50% { box-shadow: 0 0 24px rgba(16,185,129,0.3); } 100% { box-shadow: 0 0 0 rgba(16,185,129,0); } }` — triggered once on element enter or state change, never looping.

---

### Page-Specific Notes

- **Sidebar:** White/slate-900 background, emerald left-border on active item (3px), icons at 20px, nav labels in medium weight. Collapse gracefully.
- **Home hero:** Emerald-to-teal subtle gradient background (5% opacity over slate-50), large welcoming heading, one clear CTA in amber.
- **Stats cards:** Icon + number + label. Teal/sky/emerald icon circles (40px, rounded full, 10% opacity background).
- **Resource cards:** Thumbnail area (or category color band at top), title, 2-line description, category tag pill (rounded-full, emerald/teal/amber tints), action button.
- **Search/filter bar:** Sticky on scroll, single input with icon, horizontal filter pills below.
- **AI Roadmap:** Clean stepped form (one question visible at a time on mobile), generated roadmap as vertical timeline with connected nodes, each step a card.
- **Charts:** Use emerald, teal, sky, amber as the 4-color data palette. Rounded bar corners (4px). Clean axis labels in slate-400.
- **Forms:** Large input fields (48px height), clear labels above (not floating), helper text below in slate-400, emerald focus ring (2px offset).
