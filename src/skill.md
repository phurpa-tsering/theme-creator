# Voiden Theme Editor — Claude Skill

This skill teaches Claude how to help users create, edit, and understand custom Voiden themes using the `voiden-theme-editor` plugin.

---

## What this plugin does

The Theme Editor lets users create fully custom color themes for the Voiden app. Themes are JSON files stored in the user's Voiden data directory (`userData/themes/`). Built-in themes (voiden, voiden-light, tokyo-night, dracula, nord, iris) are read-only references. Custom themes can be created, edited, exported as `.json` files, shared with others, and imported.

**Entry point:** Status bar → "Themes" button (right side, Palette icon)  
**Tab type:** Opens as a `custom` panel tab  
**IPC channels (main process):**
- `ext:voiden-theme-editor:themes:save` — saves a theme JSON to `userData/themes/{id}.json`
- `ext:voiden-theme-editor:themes:delete` — deletes a custom theme

---

## Theme file format

```json
{
  "id": "my-dark-theme",
  "name": "My Dark Theme",
  "type": "dark",
  "colors": {
    "--bg-primary":   "#0d1526",
    "--accent":       "#d7b56d",
    "--accent-rgb":   "215 181 109",
    ...
  }
}
```

- `id` — URL-safe slug, lowercase letters/numbers/hyphens only, e.g. `my-cool-theme`
- `name` — Display name shown in the sidebar and tab
- `type` — `"dark"` or `"light"` (informational, affects the default template used)
- `colors` — Record of CSS custom property → value

---

## Color fields — complete reference

### Base Colors

| Variable | What it controls | Format |
|---|---|---|
| `--bg-primary` | Deepest background layer — behind every panel, editor, and sidebar | Hex |
| `--bg-surface` | Slightly elevated surfaces — tab bars, dropdown menus, cards, tooltips | Hex |
| `--bg-secondary` | Sidebar, file tree, and secondary panel backgrounds | Hex |
| `--fg-primary` | All primary readable text — headings, body content, input values | Hex |
| `--fg-secondary` | De-emphasised text — hints, timestamps, inactive labels, comments | Hex |
| `--border` | Divider lines, input outlines, card borders, separator rules | Hex |
| `--hover` | Semi-transparent overlay tint on hovered items | `rgba(...)` recommended |
| `--selection` | Highlight behind selected text or table cells | `rgba(...)` recommended |

### Accent Colors — the key distinction

The theme system has **two accent variables per color** — a hex value and an RGB triplet. They must always represent the same color, just in different formats. Claude should auto-fill the RGB triplet whenever the hex is set.

#### `--accent` (hex)
Used wherever a **solid, fully-opaque** color is needed:
- **Icon fill** — all icons across the UI inherit `--icon-primary` which maps to `--accent`
- **Primary button backgrounds** — Send, Save, confirm actions
- **Focused input rings** — the 2px outline on focused text inputs and checkboxes
- **Active sidebar item text** — the highlighted item in the left/right sidebars
- **Focus indicators** — keyboard navigation highlights

#### `--accent-rgb` (space-separated triplet, e.g. `"215 181 109"`)
The **same color as `--accent`** but as `R G B` (no commas, no `rgb()` wrapper). Used anywhere CSS needs an **opacity-controlled variant** via `rgb(var(--common-accent) / alpha)`:
- **Active tab top-line** — the 2px colored bar at the top edge of the focused tab
- **Active indicator dots** — small dot shown on the active/unsaved tab
- **Badge backgrounds** — `rgba(var(--accent-rgb), 0.1)` tint behind core/official badges
- **Badge borders** — `rgba(var(--accent-rgb), 0.3)` outline on badges
- **Selection overlays** — 60% opacity accent wash over selected content

> **Rule:** `--accent-rgb` is always the R, G, B decomposition of `--accent`. For `#d7b56d`, the triplet is `215 181 109`. The editor auto-derives this when you pick `--accent`.

#### `--accent-alt` (hex)
Secondary brand color — used for **alternate** interactive elements:
- Secondary links and underlines
- Alternate highlight color when `--accent` is already in use
- Often a contrasting hue (e.g. cool blue when `--accent` is warm gold)

#### `--accent-alt-rgb` (space-separated triplet)
Same as `--accent-rgb` but for `--accent-alt`. Used for opacity variants of the secondary accent. Auto-derived from `--accent-alt`.

### Status Colors

| Variable | What it controls |
|---|---|
| `--success` | 2xx HTTP responses, passing test assertions, connected state, positive feedback |
| `--error` | 4xx/5xx responses, failed assertions, validation errors, destructive action labels |
| `--warning` | Slow responses (yellow), deprecated API warnings, caution states |
| `--info` | Neutral informational badges, tips, non-critical notifications |

### Syntax Highlighting Colors

These color the code editor and JSON response viewer:

| Variable | Tokens colored |
|---|---|
| `--syntax-keyword` | Language keywords — `const`, `return`, `if`, `async`, `import` |
| `--syntax-string` | String literals and quoted values |
| `--syntax-func` | Function and method names |
| `--syntax-tag` | HTML/XML element names — `<div>`, `<span>` |
| `--syntax-constant` | Constants, booleans (`true`, `false`), `null`, `undefined` |
| `--syntax-comment` | Inline and block comments |
| `--syntax-operator` | Operators — `+`, `=`, `=>`, `===` |
| `--syntax-entity` | Class names, interface names, built-in types, HTML entities |
| `--syntax-regexp` | Regular expression literals |
| `--syntax-markup` | Markdown headings, list markers, bold/italic delimiters |
| `--syntax-special` | Escape sequences, interpolation delimiters |

---

## How to create a theme — step by step

1. **Open the Theme Editor** via the status bar (Palette icon, right side)
2. **Click "New Theme"** in the header
3. **Set the ID** — a slug like `my-dark-theme` (lowercase, hyphens only). This becomes the filename.
4. **Set the Display Name** — shown in the UI, e.g. `My Dark Theme`
5. **Pick the base type** — Dark or Light. This pre-fills all 40+ variables with sensible defaults.
6. **Customize colors:**
   - Start with **Base Colors** — set `--bg-primary`, `--bg-secondary`, `--bg-surface` (the three background layers)
   - Set `--fg-primary` and `--fg-secondary` (text colors)
   - Set `--border` (dividers)
   - Set `--accent` — the picker auto-fills `--accent-rgb` for you
   - Set `--accent-alt` — auto-fills `--accent-alt-rgb`
   - Adjust **Status Colors** (success, error, warning, info)
   - Optionally tweak **Syntax Colors**
7. **Click "Preview"** to apply the theme to the live app immediately
8. **Click "Save Theme"** — the theme is written to `userData/themes/{id}.json`
9. The theme appears in Settings → Appearance → Theme dropdown

### Common mistakes to avoid

- **Never set `--accent-rgb` to a hex value** — it must be a space-separated triplet like `215 181 109`, not `#d7b56d`
- **Keep `--accent` and `--accent-rgb` in sync** — they represent the same color. The editor does this automatically via the color picker but if you type manually, both must match
- **Use rgba for `--hover` and `--selection`** — these overlay on top of content, so they need transparency, e.g. `rgba(255,255,255,0.06)` or `#ffffff0a`
- **`--bg-primary` < `--bg-surface` < `--bg-secondary`** in perceived lightness (for dark themes: primary is darkest, secondary is slightly lighter)

---

## Export and Import

### Export
Select any theme in the sidebar → **Export** button → downloads `{id}.json` to the browser's download folder. Share this file with others.

### Import
**Import** button in the header → select a `.json` file → validates structure → saves as a custom theme → appears in My Themes.

The imported file must have at minimum:
```json
{ "id": "...", "name": "...", "colors": { ... } }
```

---

## Suggested theme palettes for AI to generate

### Minimal dark
```
bg-primary: #111111   bg-surface: #1a1a1a   bg-secondary: #222222
fg-primary: #e8e8e8   fg-secondary: #888888   border: #2a2a2a
accent: #6ea8fe       accent-rgb: 110 168 254
success: #5cb85c      error: #d9534f   warning: #f0ad4e   info: #5bc0de
```

### Warm sepia
```
bg-primary: #1c1410   bg-surface: #241a13   bg-secondary: #2d2018
fg-primary: #f5e6cc   fg-secondary: #9a7f60   border: #3d2c1e
accent: #e8a838       accent-rgb: 232 168 56
success: #7ec98a      error: #e07070   warning: #e8a838   info: #7ab3d4
```

### Ocean blue
```
bg-primary: #0a1628   bg-surface: #0d1f3a   bg-secondary: #112549
fg-primary: #dce9f5   fg-secondary: #6b8fac   border: #1a3355
accent: #4db8ff       accent-rgb: 77 184 255
success: #4ecdc4      error: #ff6b6b   warning: #ffd166   info: #4db8ff
```
