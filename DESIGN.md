---
name: WMS APA Nano
description: Restrained enterprise warehouse operations UI
colors:
  primary: "#044ce2"
  primary-foreground: "#ffffff"
  accent: "#e9eef7"
  background: "#f3f4f6"
  foreground: "#063586"
  card: "#ffffff"
  muted: "#edf2f7"
  muted-foreground: "#65758d"
  border: "#e5e7eb"
  destructive: "#dc2626"
typography:
  display:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "14px"
    lineHeight: "20px"
  label:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  control: "10px"
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
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  input:
    rounded: "{rounded.control}"
    height: "36px"
    padding: "4px 12px"
  navigation:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
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
  access-status:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: WMS APA Nano

## Overview

**Creative North Star: "The Clear Warehouse Board"**

A clean, modern enterprise workspace for APA Nano warehouse operations: shift pulse, movements, and exceptions first; members and preferences as supporting tools. Mode: Operate.

Neutral bordered surfaces support routine desktop work. Auth uses a full-bleed warehouse scene with a centered glass card and blue actions. The signed-in shell uses a fixed sidebar, header, and centered main column. Dashboard is a split board: live pulse strip, today’s movements, and attention/quick actions.

Product copy lives in `messages/` (en, fr, de, vi). This file is visual only. Demo metrics and demo sessions stay labelled.

**Key Characteristics:**

- Restrained operations-blue actions and neutral surfaces.
- Compact hierarchy with readable table content.
- Desktop-first structure with mobile access to the same tasks.

## Colors

Semantic CSS variables in `FE/src/app/globals.css` are the runtime source. Frontmatter records the light theme. Dark overrides (`.dark`) live in the sidecar `extensions.themeOverrides.dark`; consume tokens, never hardcode light hex in components.

### Primary

Operations blue (`primary`) fills primary buttons and marks current navigation and active membership. `primary-foreground` is the text on those filled fields. Pale blue-grey (`accent`) marks current navigation, the demo chip, and active status.

### Neutral

Cool paper (`background`) is the canvas. White (`card`) is the content surface (sidebar, header, tables, settings). Deep navy (`foreground`) carries primary information; slate (`muted-foreground`) supports secondary text. Mist (`muted`) supplies subdued fills, table headers, and count chips. Hairline (`border`) supplies 1px separation. Alert red (`destructive`) identifies errors and destructive actions.

**The Purposeful Accent Rule.** Use operations blue for primary actions, current navigation, and active status; keep secondary information neutral.

**The Auth Field Rule.** Preserve the warehouse scene and centered auth form; routine Settings work stays on neutral card surfaces.

## Typography

**Display / Body / Label Font:** Source Sans 3, sans-serif, loaded through Next font with Latin, Latin extended, and Vietnamese subsets. The shell resolves the same app font variable.

**Character:** Compact, operational, no promotional display faces. Tracking-tight only on page and auth headlines.

### Hierarchy

- **Display** (600, 36px / 40px, tracking -0.025em): Auth split-panel headline (`text-4xl`). Not used inside the signed-in shell.
- **Headline** (600, 24px / 32px, tracking -0.025em): Shared page titles, including Settings. Auth and dashboard retain their own larger headline treatments.
- **Title** (600, 18px): Dialog titles and settings section headings. Sidebar wordmark is 18px semibold. Dashboard overview heading is 20px semibold.
- **Body** (400, 14px / 20px): Routine copy, buttons, labels, table cells. Inputs are 16px below 768px and 14px from 768px.
- **Label** (500, 12px / 16px): Table headers, status badges, demo chip, count chips, helper and error text.

## Layout

The signed-in shell fills the viewport with a 72px topbar and a fixed sidebar from 1024px. From 1024px to 1279px it uses a 72px compact rail; desktop expansion is 220px from 1280px to 1439px and 248px from 1440px. A user-collapsed rail remains 72px. Below 1024px navigation opens in a modal drawer and Settings reclaims full page width. The drawer is at most 280px or 88vw. Shell page padding is 12px below 1024px and 16px above; the inner page frame adds the same padding.

Spacing follows a 4px base with feature-specific working gaps. Shared page headers leave 20px before content and have a subtle bottom divider. Authorization Settings uses a 150–190px secondary navigation beside a `minmax(0, 1fr)` work area with a 28px gap. At 800px and below, it becomes one column with an 18px gap and wrapping navigation. Search and actions wrap with 12px gaps; search grows from a 180px basis to 360px maximum on larger widths and fills available mobile width. Detail rows stack at 450px. Dialogs cap height at 85dvh with internal scrolling; role options cap height at 46dvh.

The existing auth surface keeps its warehouse scene and centered form treatment. Other operational screens retain their own grids and toolbars; the Settings extension does not impose its secondary navigation on them.
**The Local Overflow Rule.** Keep wide records inside their own keyboard-focusable scrolling region (`overflow-x-auto`, `tabIndex={0}`) so the page remains usable on small screens.

## Elevation & Depth

**The Border First Rule.** Use borders and surface tones to separate routine content; reserve stronger depth for dialogs and menus.

Authorization tables and general Settings use flat bordered card surfaces. Inputs and primary buttons have no shadow. The incumbent shell also carries soft gradient panels and restrained inset highlights; preserve these materials on their existing surfaces. Menus and dialogs use the shared surface shadow over their overlay. Floating glass panels and the scrolled topbar use translucent card tones with blur when supported, with opaque fallbacks for reduced transparency and increased contrast.

## Shapes

Shared buttons and inputs use gently rounded control corners (10px); authorization selects and secondary navigation use the medium radius (8px). Navigation items, dialogs, and confirmations use the large radius (12px). Generic table shells and cards use the extra-large radius (16px); authorization general Settings uses the large radius (12px), and incumbent soft shell panels use 14px. The mobile nav drawer is square. Circular 36px initials mark people. Membership status uses a pill; the demo mode chip and list-count chip use the medium radius. Checkbox is a 4px square. Borders are one pixel.

## Components

Primitives live in `FE/src/components/ui`; shared composition in `FE/src/components/shared`; feature UI in `FE/src/features`. `Can` hides actions the session cannot perform; it is UX, not a security boundary.

### Buttons

Compact medium-weight 14px labels. Primary is filled operations blue (36px default, at least 44px below 640px or on coarse pointers). Outline supports cancel, retry, and pagination (32px small). Ghost icon buttons (36px square) support row, menu, and sign-out actions. Secondary, destructive, and link variants remain available. Hover changes fill; keyboard focus adds a 3px primary ring; the global focus outline uses 2px with a 3px offset; disabled controls reduce opacity and reject pointer interaction. Pending submits swap label to a saving state.

### Cards / Containers

Extra-large corners, 1px border, card fill, 24px internal padding. KPI cards omit shadow; the dashboard overview block is a padded bordered card with divided list rows and primary-tinted line icons.

### Inputs / Fields

Neutral 1px border, control corners (10px), card fill, no shadow. Focus shifts the border to primary and adds a 3px ring. Invalid fields use destructive borders, a destructive ring, and 12px inline error text. Labels sit above fields. Search inputs sit on the card fill with a leading icon.

### Navigation

Line SVG icons (16px) plus 14px medium text. Settings secondary routes: pale blue-grey fill and blue semibold text. The shell’s current route retains its soft gradient surface, border, and blue icon/text treatment. Inactive: muted text, mist hover fill. Header shows workspace / current section, a demo chip when demo mode is on, the user name, circular initials, and a labelled sign-out icon. Skip-to-content is visually hidden until focused.

### Status / chips

Active membership: pill, pale blue-grey fill, operations-blue text. Inactive/invited: pill outline. Demo mode in the header: medium-radius pale blue-grey chip with readable “Demo” text. Record counts: medium-radius mist chip.

### Tables

Tinted header row (`muted/50`), 1px row dividers, identity cells pairing 36px initials with name and smaller email. Shared data table headers are 11px with a 40px row height; body cells are 13px with padding supplied by the shared table/column composition. The scroll container caps at the smaller of 56dvh and 640px and keeps headers sticky. Pagination sits in a bordered footer with outline previous/next. Empty, loading (`role="status"`), error, and fetching (`aria-busy`) states use the same vocabulary.

### Dialogs

Large radius, 24px padding, shared surface shadow, dimmed overlay, 18px semibold title. Motion is 200ms fade/zoom. Reduced-motion rules shorten all durations to 0.01ms and disable animated scrolling.


### Authorization Settings

The secondary navigation only includes permitted sections, with the current entry marked by `aria-current="page"`. While session permissions load, show the shared loading state; unavailable sections show the permission-denied state. Company-scoped sessions do not show platform tenant, migration, or operations navigation.

Searchable, paginated tables use the existing DataTable. Row actions wrap, protected roles carry a neutral text status, and unavailable editing actions disappear. Keep the backend state’s text visible: accepted provisioning is not visually presented as active.

The permission matrix is a locally scrolling, bordered-row table with 13px text, muted header fill, centered action columns and left-aligned resource labels. Cells use catalog permissions; unavailable combinations show an accessible dash, and unauthorized selections are disabled. Role-assignment options use bordered 8px rows with 12px padding and muted supporting text. Dialogs retain labelled fields, inline errors, pending labels, and unsaved-change protection. Shared feedback blocks use a 1px border, 8px radius, 16px padding, and an alert role for errors.

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
