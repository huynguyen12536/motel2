---
name: Workspace
description: Restrained enterprise admin starter
colors:
  primary: "#245e50"
  primary-foreground: "#ffffff"
  accent: "#e4efeb"
  background: "#f8f9fb"
  foreground: "#182329"
  card: "#ffffff"
  muted: "#eef1f3"
  muted-foreground: "#58646e"
  border: "#dce2e6"
  destructive: "#bb3030"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
    lineHeight: "20px"
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  full: "9999px"
spacing:
  control: "8px"
  item: "12px"
  regular: "16px"
  field: "20px"
  surface: "24px"
  section: "32px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  input:
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 12px"
  navigation:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  status:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  demo-chip:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Workspace

## Overview

**Creative North Star: "The Clear Workspace"**

A clean, modern enterprise workspace for finding members, editing access, and adjusting preferences. The explicitly selected minimal direction favors readable records, restrained color, and familiar navigation. Mode: Operate.

Neutral bordered surfaces support routine desktop work. Auth uses a split brand panel; the signed-in shell uses a fixed sidebar, header, and centered main column. A mobile navigation drawer and locally scrolling tables preserve access to the same tasks. System sans-serif avoids external font requests in this offline starter.

Product copy lives in `messages/` (en, fr, de, vi). This file is visual only. Demo metrics and demo sessions stay labelled.

**Key Characteristics:**

- Restrained forest-green actions and neutral surfaces.
- Compact hierarchy with readable table content.
- Desktop-first structure with mobile access to the same tasks.

## Colors

Semantic CSS variables in `src/app/globals.css` are the runtime source. Frontmatter records the light theme. Dark overrides (`.dark`) live in the sidecar `themeOverrides.dark`; consume tokens, never hardcode light hex in components.

### Primary

Forest green (`primary`) fills primary buttons, the auth brand panel, current sidebar items, and active membership. `primary-foreground` is the text on those filled fields. Pale sage (`accent`) marks current navigation, the demo chip, and active status.

### Neutral

Cool paper (`background`) is the canvas. White (`card`) is the content surface (sidebar, header, tables, settings). Ink (`foreground`) carries primary information; slate (`muted-foreground`) supports secondary text. Mist (`muted`) supplies subdued fills, table headers, and count chips. Hairline (`border`) supplies 1px separation. Alert red (`destructive`) identifies errors and destructive actions.

**The Purposeful Accent Rule.** Use forest green for primary actions, current navigation, and active status; keep secondary information neutral.

**The Auth Field Rule.** Forest green may fill the left auth panel at large breakpoints. Everywhere else it stays on actions, current nav, icons, and status — not on page backgrounds.

## Typography

**Display / Body / Label Font:** Arial, Helvetica, sans-serif (offline starter constraint, not a display-type recommendation).

**Character:** Compact, operational, no promotional display faces. Tracking-tight only on page and auth headlines.

### Hierarchy

- **Display** (600, 36px / 40px, tracking -0.025em): Auth split-panel headline (`text-4xl`). Not used inside the signed-in shell.
- **Headline** (600, 30px / 36px, tracking -0.025em): Page titles (`PageHeader`, sign-in/sign-up headings) and dashboard KPI numerals (`tabular-nums`).
- **Title** (600, 18px): Dialog titles and settings section headings. Sidebar wordmark is 18px semibold. Dashboard overview heading is 20px semibold.
- **Body** (400, 14px / 20px): Routine copy, buttons, labels, table cells. Inputs are 16px below 768px and 14px from 768px.
- **Label** (500, 12px / 16px): Table headers, status badges, demo chip, count chips, helper and error text.

## Layout

A fixed desktop sidebar (240px), header (80px), and centered main container (maximum 1280px) organize the signed-in shell. Horizontal gutters grow from 20px to 40px at 768px; vertical padding grows from 32px to 40px. Below 768px, navigation opens in a modal drawer (288px) with a labelled close action; the drawer content is square-cornered and flush to the left edge.

Auth is a two-column grid from 1024px: brand panel (padding 48px) and a centered form column (max 384px, horizontal padding 24px). Below 1024px the brand panel hides and the wordmark appears above the form.

Spacing follows a 4px base. Page headings leave 32px before content. Dashboard KPI cards use a 3-column grid from 640px with 20px gaps. Toolbars wrap; user search fills mobile width and becomes 288px from 640px. Settings live in a max 768px bordered card. Form fields stack with 16px gaps; labels sit above inputs.

**The Local Overflow Rule.** Keep wide records inside their own keyboard-focusable scrolling region (`overflow-x-auto`, `tabIndex={0}`) so the page remains usable on small screens.

## Elevation & Depth

**The Border First Rule.** Use borders and surface tones to separate routine content; reserve stronger depth for dialogs and menus.

Tables, settings cards, and dashboard overview blocks are flat bordered surfaces. Default cards use a small shadow; dashboard KPI cards drop the shadow (`shadow-none`). Inputs, checkboxes, and outlined buttons use an extra-small shadow. Select and dropdown menus use a medium shadow. Dialogs use a large shadow over a 50% black overlay.

## Shapes

Controls and inputs use the medium radius (8px). Navigation items, dialogs, and confirmations use the large radius (12px). Table shells, cards, and settings panels use the extra-large radius (16px). The mobile nav drawer is square. Circular 36px initials mark people. Membership status uses a pill; the demo mode chip and list-count chip use the medium radius. Checkbox is a 4px square. Borders are one pixel.

## Components

Primitives live in `src/components/ui`; shared composition in `src/components/shared`; feature UI in `src/features`. `Can` hides actions the session cannot perform; it is UX, not a security boundary.

### Buttons

Compact medium-weight 14px labels. Primary is filled forest green (36px default). Outline supports cancel, retry, and pagination (32px small). Ghost icon buttons (36px square) support row, menu, and sign-out actions. Secondary, destructive, and link variants remain available. Hover changes fill; keyboard focus adds a 3px primary ring plus a 2px outline offset 3px; disabled controls reduce opacity and reject pointer interaction. Pending submits swap label to a saving state.

### Cards / Containers

Extra-large corners, 1px border, card fill, 24px internal padding. KPI cards omit shadow; the dashboard overview block is a padded bordered card with divided list rows and primary-tinted line icons.

### Inputs / Fields

Neutral 1px border, medium corners, transparent fill, extra-small shadow. Focus shifts the border to primary and adds a 3px ring. Invalid fields use destructive borders, a destructive ring, and 12px inline error text. Labels sit above fields. Search inputs sit on the card fill with a leading icon.

### Navigation

Line SVG icons (16px) plus 14px medium text. Current routes: pale sage fill and forest-green text. Inactive: muted text, mist hover fill. Header shows workspace / current section, a demo chip when demo mode is on, the user name, circular initials, and a labelled sign-out icon. Skip-to-content is visually hidden until focused.

### Status / chips

Active membership: pill, pale sage fill, forest-green text. Inactive/invited: pill outline. Demo mode in the header: medium-radius sage chip with readable “Demo” text. Record counts: medium-radius mist chip.

### Tables

Tinted header row (`muted/50`), 1px row dividers, identity cells pairing 36px initials with name and smaller email. Cells use 20px horizontal padding and 16px vertical padding, reduced to 8px vertically in compact mode. Pagination sits in a bordered footer with outline previous/next. Empty, loading (`role="status"`), error, and fetching (`aria-busy`) states use the same vocabulary.

### Dialogs

Large radius, 24px padding, large shadow, dimmed overlay, 18px semibold title. Motion is 200ms fade/zoom. Reduced-motion rules shorten all durations to 0.01ms and disable animated scrolling.

## Do's and Don'ts

### Do:

- Do reuse semantic color tokens so light and dark themes stay aligned.
- Do keep visible labels, inline errors, named icon actions, and pending states.
- Do label demo metrics and demo sessions; never present sample counts as live reporting.
- Do respect reduced-motion preferences.

### Don't:

- Don't add decorative color or promotional display typography to routine administration.
- Don't use status color without a readable text label.
- Don't force wide tables to overflow the page.
- Don't put product strings in components; use translation keys.
