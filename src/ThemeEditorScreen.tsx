/**
 * ThemeEditorScreen — self-contained, no imports from @/core or @/utils.
 * All host utilities are inlined so this file can be bundled as an external plugin.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, Lock, Check, X, ChevronDown, ChevronRight, Palette, Download, Upload } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CorePluginContext } from "@voiden/sdk/ui";

// ─── Theme Persistence (using IPC to Main Process) ────────────────────────────

const EXT = "ext:theme-creator";

async function pluginSaveTheme(theme: { id: string; name: string; type: string; colors: Record<string, string> }): Promise<{ success: boolean; error?: string }> {
  return (window as any).electron?.ipc?.invoke(`${EXT}:themes:save`, theme);
}

async function pluginDeleteTheme(themeId: string): Promise<{ success: boolean; error?: string }> {
  return (window as any).electron?.ipc?.invoke(`${EXT}:themes:delete`, themeId);
}

const BUNDLED_IDS = new Set([
  "voiden", "voiden-light", "tokyo-night", "dracula", "nord", "iris",
]);

// ─── Export / Import ──────────────────────────────────────────────────────────

function exportThemeAsFile(theme: { id: string; name: string; type: string; colors: Record<string, string> }) {
  const json = JSON.stringify(theme, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${theme.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importThemeFromFile(onLoaded: (theme: { id: string; name: string; type: string; colors: Record<string, string> }) => void) {
  const input    = document.createElement("input");
  input.type     = "file";
  input.accept   = ".json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text  = await file.text();
      const theme = JSON.parse(text);
      if (!theme?.id || !theme?.name || !theme?.colors) {
        alert("Invalid theme file — must contain id, name, and colors.");
        return;
      }
      onLoaded(theme);
    } catch {
      alert("Could not parse the JSON file.");
    }
  };
  input.click();
}

// ─── Inlined ResizeHandle (no @/core import) ──────────────────────────────────

const ResizeHandle = ({ orientation }: { orientation: "horizontal" | "vertical" }) => (
  <PanelResizeHandle
    style={{
      flexShrink: 0,
      position: "relative",
      ...(orientation === "vertical"
        ? { width: 1, cursor: "col-resize", backgroundColor: "var(--border)" }
        : { height: 1, cursor: "row-resize", backgroundColor: "var(--border)" }),
      transition: "background-color 0.1s",
    }}
  />
);

// ─── Inlined theme loader (no @/utils import) ─────────────────────────────────

const ALL_THEME_VARIABLES = [
  '--bg-primary', '--bg-surface', '--bg-secondary', '--fg-primary', '--fg-secondary', '--border', '--selection', '--hover',
  '--editor-bg', '--editor-fg', '--editor-selection', '--editor-findMatch', '--editor-gutter-active', '--editor-gutter-normal',
  '--ui-bg', '--ui-fg', '--ui-panel-bg', '--ui-line', '--ui-selection-normal',
  '--ui-overlay-bg', '--ui-shadow', '--ui-border-subtle', '--ui-border-subtle-light',
  '--code-bg', '--code-fg', '--code-selection', '--code-line-highlight', '--code-gutter',
  '--modal-bg', '--modal-header-bg', '--titlebar-bg', '--titlebar-fg',
  '--block-header-bg', '--blockquote-border', '--blockquote-bg', '--blockquote-fg',
  '--menu-bg', '--menu-hover-bg', '--menu-separator',
  '--placeholder-border', '--placeholder-bg', '--placeholder-fg',
  '--success', '--success-bg', '--error', '--error-bg', '--warning', '--info',
  '--accent', '--accent-alt', '--accent-rgb', '--accent-alt-rgb',
  '--faker', '--faker-bg', '--table-cell-selection',
  '--icon-primary', '--icon-secondary', '--icon-success', '--icon-error', '--icon-warning', '--icon-info',
  '--status-success', '--status-error', '--status-warning', '--status-info',
  '--vcs-added', '--vcs-modified', '--vcs-removed', '--vcs-ignored',
  '--http-get', '--http-post', '--http-put', '--http-patch', '--http-delete', '--http-head', '--http-options',
  '--button-primary-bg', '--button-primary-hover', '--button-secondary-bg', '--button-secondary-fg',
  '--button-danger-bg', '--button-danger-hover', '--button-secondary',
  '--test-passed-bg', '--test-passed-fg', '--test-failed-bg', '--test-failed-fg',
  '--highlight-search', '--highlight-search-current',
  '--badge-core-bg', '--badge-core-border', '--badge-core-fg',
  '--badge-official-bg', '--badge-official-border', '--badge-official-fg',
  '--badge-community-bg', '--badge-community-border', '--badge-community-fg',
  '--git-branch-1', '--git-branch-2', '--git-branch-3', '--git-branch-4',
  '--git-branch-5', '--git-branch-6', '--git-branch-7', '--git-branch-8',
  '--syntax-tag', '--syntax-func', '--syntax-entity', '--syntax-string',
  '--syntax-regexp', '--syntax-markup', '--syntax-keyword', '--syntax-special',
  '--syntax-comment', '--syntax-constant', '--syntax-operator',
  '--ansi-black', '--ansi-red', '--ansi-green', '--ansi-yellow',
  '--ansi-blue', '--ansi-magenta', '--ansi-cyan', '--ansi-white',
  '--ansi-bright-black', '--ansi-bright-red', '--ansi-bright-green', '--ansi-bright-yellow',
  '--ansi-bright-blue', '--ansi-bright-magenta', '--ansi-bright-cyan', '--ansi-bright-white',
  '--variable-valid-bg', '--variable-valid-fg', '--variable-invalid-bg', '--variable-invalid-fg',
  '--variable-faker-bg', '--variable-faker-fg',
  '--common-accent', '--common-alt',
];

function loadTheme(theme: { id: string; name: string; type: string; colors: Record<string, string> }) {
  const root = document.documentElement;
  ALL_THEME_VARIABLES.forEach(v => root.style.removeProperty(v));
  Object.entries(theme.colors).forEach(([prop, val]) => {
    if (!prop.startsWith('_')) root.style.setProperty(prop, val);
  });
}

async function loadThemeById(themeId = 'voiden', themes: ThemeWithColors[] = []) {
  const el = (window as any).electron;
  
  // Try local state first (for custom themes)
  const local = themes.find(t => t.id === themeId);
  if (local) {
    loadTheme(local);
    return;
  }

  if (!el?.themes) return;
  try {
    const theme = await el.themes.load(themeId);
    if (theme) { loadTheme(theme); return; }
    const fallback = await el.themes.load('voiden');
    if (fallback) loadTheme(fallback);
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThemeMetadata {
  id: string;
  name: string;
  type: string;
  bundled: boolean;
}

interface ThemeWithColors extends ThemeMetadata {
  colors: Record<string, string>;
}

interface CustomTheme {
  id: string;
  name: string;
  type: "dark" | "light";
  colors: Record<string, string>;
}

// ─── Color field definitions ──────────────────────────────────────────────────

interface ColorField { variable: string; label: string; hint?: string; }

const BASE_COLORS: ColorField[] = [
  { variable: "--bg-primary",   label: "Background",     hint: "Deepest layer — the main window background behind every panel and editor." },
  { variable: "--bg-surface",   label: "Surface",        hint: "Slightly elevated layer used for tab bars, cards, dropdowns, and tooltips." },
  { variable: "--bg-secondary", label: "Panel",          hint: "Sidebar, file tree, and secondary panel backgrounds." },
  { variable: "--fg-primary",   label: "Text",           hint: "Primary readable text — headings, labels, editor body, and input values." },
  { variable: "--fg-secondary", label: "Muted Text",     hint: "De-emphasised text — hints, descriptions, timestamps, and inactive labels." },
  { variable: "--border",       label: "Border",         hint: "Divider lines, input outlines, and separator rules between sections." },
  { variable: "--hover",        label: "Hover Overlay",  hint: "Semi-transparent tint applied on top of items when hovered. Use rgba (e.g. rgba(255,255,255,0.06))." },
  { variable: "--selection",    label: "Selection",      hint: "Highlight behind selected text or table cells. Use rgba so the text underneath stays readable." },
];

const ACCENT_COLORS: ColorField[] = [
  {
    variable: "--accent",
    label: "Accent",
    hint: "Solid hex color — drives icon fills (--icon-primary), primary button backgrounds, focused input rings, checkbox borders, and active sidebar item text. Think of this as the 'solid brand color' used whenever opacity is not needed.",
  },
  {
    variable: "--accent-rgb",
    label: "Accent RGB",
    hint: "Space-separated R G B triplet of --accent, e.g. \"215 181 109\". Used via rgb(var(--accent-rgb)/alpha) for OPACITY VARIANTS: the 2px colored line at the top of the active tab, active indicator dots, badge backgrounds, and selection overlays. Must always match --accent. Auto-filled when you pick --accent above.",
  },
  {
    variable: "--accent-alt",
    label: "Accent Alt",
    hint: "Secondary brand color (solid hex) — used for secondary links, alternate highlights, and elements that need a contrasting accent. Often a cool blue when the primary accent is warm.",
  },
  {
    variable: "--accent-alt-rgb",
    label: "Accent Alt RGB",
    hint: "Space-separated R G B triplet of --accent-alt, e.g. \"143 180 255\". Used via rgb(var(--accent-alt-rgb)/alpha) for opacity variants of the secondary accent. Must always match --accent-alt. Auto-filled when you pick --accent-alt above.",
  },
];

const STATUS_COLORS: ColorField[] = [
  { variable: "--success", label: "Success", hint: "2xx responses, passing tests, connected status indicators, and positive feedback." },
  { variable: "--error",   label: "Error",   hint: "4xx/5xx responses, failing tests, validation errors, and destructive action warnings." },
  { variable: "--warning", label: "Warning", hint: "Slow responses, deprecated APIs, missing optional fields, and caution states." },
  { variable: "--info",    label: "Info",    hint: "Neutral informational badges, tips, and non-critical notifications." },
];

const SYNTAX_COLORS: ColorField[] = [
  { variable: "--syntax-tag",      label: "Tag",      hint: "HTML/XML element names — <div>, <span>, <body>." },
  { variable: "--syntax-func",     label: "Function", hint: "Function and method names when called or defined." },
  { variable: "--syntax-string",   label: "String",   hint: "String literals, quoted values, and template literals." },
  { variable: "--syntax-keyword",  label: "Keyword",  hint: "Language keywords — const, return, if, async, import." },
  { variable: "--syntax-comment",  label: "Comment",  hint: "Inline and block comments — //, #, /* … */." },
  { variable: "--syntax-constant", label: "Constant", hint: "Constants, boolean literals (true/false), and null/undefined." },
  { variable: "--syntax-operator", label: "Operator", hint: "Arithmetic, comparison, and assignment operators — +, =, =>, ===." },
  { variable: "--syntax-entity",   label: "Entity",   hint: "Built-in types, interface names, class declarations, and HTML entities." },
  { variable: "--syntax-regexp",   label: "RegExp",   hint: "Regular expression literals — /pattern/flags." },
  { variable: "--syntax-markup",   label: "Markup",   hint: "Markdown headings, list markers, bold/italic delimiters." },
  { variable: "--syntax-special",  label: "Special",  hint: "Escape sequences, string interpolation delimiters, and other special tokens." },
];

// ─── Default base templates ───────────────────────────────────────────────────

const DEFAULT_DARK_COLORS: Record<string, string> = {
  "--bg-primary":    "#0d1526", "--bg-surface":    "#101a2d", "--bg-secondary":  "#121c31",
  "--fg-primary":    "#e8eefc", "--fg-secondary":  "#7f8aa3", "--border":        "#18233b",
  "--selection":     "#d7b56d30", "--hover":       "#ffffff0a",
  "--success":       "#7fd0b2", "--success-bg":   "rgba(127, 208, 178, 0.15)",
  "--error":         "#ee8da0", "--error-bg":     "rgba(238, 141, 160, 0.15)",
  "--warning":       "#d7b56d", "--info":         "#7dc4e4",
  "--accent":        "#d7b56d", "--accent-alt":   "#8fb4ff",
  "--accent-rgb":    "215 181 109", "--accent-alt-rgb": "143 180 255",
  "--http-head":     "#c3a6ff", "--http-options": "#74809b",
  "--table-cell-selection": "rgba(215, 181, 109, 0.22)",
  "--syntax-tag":    "#7dc4e4", "--syntax-func":  "#e6c98b", "--syntax-entity":  "#7dc4e4",
  "--syntax-string": "#7fd0b2", "--syntax-regexp":"#8de1d1", "--syntax-markup":  "#ee8da0",
  "--syntax-keyword":"#c3a6ff", "--syntax-special":"#f1d7ae","--syntax-comment": "#67728c",
  "--syntax-constant":"#c3a6ff","--syntax-operator":"#d7b56d",
  "--ansi-black":    "#121c31", "--ansi-red":     "#ee8da0", "--ansi-green":    "#7fd0b2",
  "--ansi-yellow":   "#d7b56d", "--ansi-blue":    "#5d81d6", "--ansi-magenta":  "#c3a6ff",
  "--ansi-cyan":     "#7dcfdf", "--ansi-white":   "#e8eefc",
  "--ansi-bright-black":"#7f8aa3","--ansi-bright-red":"#f3a2b1","--ansi-bright-green":"#97e0c4",
  "--ansi-bright-yellow":"#e6c98b","--ansi-bright-blue":"#7a9be8","--ansi-bright-magenta":"#d5beff",
  "--ansi-bright-cyan":"#96dcea","--ansi-bright-white":"#f4f7ff",
  "--variable-valid-bg":"rgba(127, 208, 178, 0.15)","--variable-valid-fg":"#7fd0b2",
  "--variable-invalid-bg":"rgba(238, 141, 160, 0.15)","--variable-invalid-fg":"#ee8da0",
  "--variable-faker-bg":"rgba(125, 196, 228, 0.15)","--variable-faker-fg":"#7dc4e4",
  "--faker":"#7dc4e4","--faker-bg":"rgba(125, 196, 228, 0.15)",
};

const DEFAULT_LIGHT_COLORS: Record<string, string> = {
  "--bg-primary":    "#f5f5f0", "--bg-surface":    "#ededea", "--bg-secondary":  "#e5e5e0",
  "--fg-primary":    "#1a1a1a", "--fg-secondary":  "#6b7280", "--border":        "#d1d5db",
  "--selection":     "#2563eb30", "--hover":       "#00000009",
  "--success":       "#16a34a", "--success-bg":   "rgba(22, 163, 74, 0.12)",
  "--error":         "#dc2626", "--error-bg":     "rgba(220, 38, 38, 0.12)",
  "--warning":       "#d97706", "--info":         "#2563eb",
  "--accent":        "#2563eb", "--accent-alt":   "#7c3aed",
  "--accent-rgb":    "37 99 235", "--accent-alt-rgb": "124 58 237",
  "--http-head":     "#7c3aed", "--http-options": "#9ca3af",
  "--table-cell-selection": "rgba(37, 99, 235, 0.18)",
  "--syntax-tag":    "#2563eb", "--syntax-func":  "#d97706", "--syntax-entity":  "#2563eb",
  "--syntax-string": "#16a34a", "--syntax-regexp":"#0891b2", "--syntax-markup":  "#dc2626",
  "--syntax-keyword":"#7c3aed", "--syntax-special":"#92400e","--syntax-comment": "#9ca3af",
  "--syntax-constant":"#7c3aed","--syntax-operator":"#d97706",
  "--ansi-black":    "#1f2937", "--ansi-red":     "#dc2626", "--ansi-green":    "#16a34a",
  "--ansi-yellow":   "#d97706", "--ansi-blue":    "#2563eb", "--ansi-magenta":  "#7c3aed",
  "--ansi-cyan":     "#0891b2", "--ansi-white":   "#f9fafb",
  "--ansi-bright-black":"#6b7280","--ansi-bright-red":"#ef4444","--ansi-bright-green":"#22c55e",
  "--ansi-bright-yellow":"#f59e0b","--ansi-bright-blue":"#3b82f6","--ansi-bright-magenta":"#a855f7",
  "--ansi-bright-cyan":"#06b6d4","--ansi-bright-white":"#ffffff",
  "--variable-valid-bg":"rgba(22, 163, 74, 0.12)","--variable-valid-fg":"#16a34a",
  "--variable-invalid-bg":"rgba(220, 38, 38, 0.12)","--variable-invalid-fg":"#dc2626",
  "--variable-faker-bg":"rgba(8, 145, 178, 0.12)","--variable-faker-fg":"#0891b2",
  "--faker":"#0891b2","--faker-bg":"rgba(8, 145, 178, 0.12)",
};

const COLOR_SECTIONS = [
  { title: "Base Colors",     fields: BASE_COLORS,   defaultOpen: true  },
  { title: "Accent & Active", fields: ACCENT_COLORS, defaultOpen: true  },
  { title: "Status",          fields: STATUS_COLORS, defaultOpen: true  },
  { title: "Syntax",          fields: SYNTAX_COLORS, defaultOpen: false },
];

// ─── Color helpers ────────────────────────────────────────────────────────────

function isHexColor(v: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim());
}

function parseToHex(value: string): string | null {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const [, r, g, b] = v; return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-fA-F]{6,8}$/.test(v)) return v.slice(0, 7);
  const css = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (css) {
    return `#${parseInt(css[1]).toString(16).padStart(2,"0")}${parseInt(css[2]).toString(16).padStart(2,"0")}${parseInt(css[3]).toString(16).padStart(2,"0")}`;
  }
  const tri = v.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
  if (tri) {
    return `#${parseInt(tri[1]).toString(16).padStart(2,"0")}${parseInt(tri[2]).toString(16).padStart(2,"0")}${parseInt(tri[3]).toString(16).padStart(2,"0")}`;
  }
  return null;
}

function applyPickedColor(original: string, hex: string): string {
  const v = original.trim();
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return hex + v.slice(7);
  if (/^#[0-9a-fA-F]{3,7}$/.test(v)) return hex;
  const rgba = v.match(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/i);
  if (rgba) return `rgba(${r}, ${g}, ${b}, ${rgba[1]})`;
  if (/^rgb\(/i.test(v)) return `rgb(${r}, ${g}, ${b})`;
  if (/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(v)) return `${r} ${g} ${b}`;
  return hex;
}

function hexToRgbTriplet(hex: string): string | null {
  const c = hex.trim().replace("#","");
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  if (isNaN(r)||isNaN(g)||isNaN(b)) return null;
  return `${r} ${g} ${b}`;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"");
}

// ─── Sidebar theme card ───────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: ThemeWithColors; isActive: boolean; onSelect: () => void;
  onEdit?: () => void; onDelete?: () => void; deleting?: boolean;
}

const ThemeCard = ({ theme, isActive, onSelect, onEdit, onDelete, deleting }: ThemeCardProps) => {
  const [hovered, setHovered] = useState(false);
  const colors = theme?.colors ?? {};
  const bg   = colors["--bg-primary"]   ?? "transparent";
  const surf = colors["--bg-surface"]   ?? "transparent";
  const text = colors["--fg-primary"]   ?? "inherit";
  const muted= colors["--fg-secondary"] ?? "inherit";
  const bord = colors["--border"]       ?? "transparent";
  const acc  = colors["--accent"]       ?? "transparent";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor:"pointer", borderRadius:8, overflow:"hidden",
        boxShadow: isActive
          ? "0 0 0 2px var(--accent), 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent)"
          : "0 0 0 1px var(--border)",
        transition:"box-shadow 0.15s",
      }}
    >
      {/* Mini preview */}
      <div style={{ backgroundColor:bg, padding:"8px 10px" }}>
        <div style={{ display:"flex", gap:4, marginBottom:6 }}>
          <div style={{ width:8,height:8,borderRadius:"50%",backgroundColor:acc,opacity:0.9 }} />
          <div style={{ width:8,height:8,borderRadius:"50%",backgroundColor:bord }} />
          <div style={{ width:8,height:8,borderRadius:"50%",backgroundColor:bord }} />
        </div>
        <div style={{ display:"flex", gap:4 }}>
          <div style={{ width:28,background:surf,borderRadius:2,height:20,border:`1px solid ${bord}` }} />
          <div style={{ flex:1,background:surf,borderRadius:2,height:20,border:`1px solid ${bord}` }} />
        </div>
      </div>
      {/* Label */}
      <div style={{ backgroundColor:surf,borderTop:"1px solid var(--border)",padding:"6px 10px",display:"flex",alignItems:"center",justifyContent:"space-between", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11,fontWeight:600,color:text,lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{theme.name}</div>
          <div style={{ fontSize:10,color:muted,marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{theme.id}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0 }}>
          {theme.bundled
            ? <Lock style={{ width:10,height:10,color:muted }} />
            : hovered && (
              <div style={{ display:"flex", gap:2 }}>
                {onEdit && (
                  <button onClick={e=>{e.stopPropagation();onEdit();}} style={{ padding:2,background:"none",border:"none",cursor:"pointer",borderRadius:3,color:muted }}>
                    <Pencil style={{ width:10,height:10 }} />
                  </button>
                )}
                {onDelete && (
                  <button onClick={e=>{e.stopPropagation();onDelete?.();}} disabled={deleting} style={{ padding:2,background:"none",border:"none",cursor:"pointer",borderRadius:3,color:muted,opacity:deleting?0.5:1 }}>
                    <Trash2 style={{ width:10,height:10 }} />
                  </button>
                )}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
};

// ─── Color row ────────────────────────────────────────────────────────────────

interface ColorRowProps { field: ColorField; value: string; onChange: (v:string,val:string)=>void; readOnly?: boolean; isLast?: boolean; }

const ColorRow = ({ field, value, onChange, readOnly=false, isLast=false }: ColorRowProps) => {
  const hexEquiv = parseToHex(value);
  const canPick  = !readOnly && hexEquiv !== null;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, paddingTop:12, paddingBottom:12, ...(isLast ? {} : { borderBottom:"1px solid var(--border)" }) }}>
      <div style={{ position:"relative", flexShrink:0, width:40, height:40 }}>
        <div style={{ width:40,height:40, backgroundColor:hexEquiv??value, borderRadius:8, border:"2px solid var(--ui-line)" }} />
        {canPick && (
          <input type="color" value={hexEquiv!} onChange={e=>onChange(field.variable, applyPickedColor(value, e.target.value))}
            style={{ position:"absolute",inset:0,opacity:0,width:"100%",height:"100%",cursor:"pointer",border:"none",padding:0 }}
          />
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:2 }}>
          <span style={{ fontSize:12, fontWeight:600, color:"var(--fg-primary)" }}>{field.label}</span>
          <code style={{ fontSize:10, color:"var(--fg-secondary)", fontFamily:"monospace" }}>{field.variable}</code>
        </div>
        {field.hint && <p style={{ fontSize:11, color:"var(--fg-secondary)", margin:"0 0 8px 0", lineHeight:1.4 }}>{field.hint}</p>}
        <input
          type="text" value={value} readOnly={readOnly} spellCheck={false}
          onChange={e=>onChange(field.variable, e.target.value)}
          style={{ width:"100%", padding:"6px 10px", fontSize:12, fontFamily:"monospace", borderRadius:6,
            border:"1px solid var(--border)", backgroundColor:"var(--bg-primary)", color:"var(--fg-primary)",
            outline:"none", boxSizing:"border-box", opacity:readOnly?0.6:1 }}
        />
      </div>
    </div>
  );
};

// ─── Collapsible section ──────────────────────────────────────────────────────

interface CollapsibleSectionProps { title:string; fields:ColorField[]; colors:Record<string,string>; onChange:(v:string,val:string)=>void; readOnly?:boolean; defaultOpen?:boolean; }

const CollapsibleSection = ({ title, fields, colors, onChange, readOnly=false, defaultOpen=true }: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom:8 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--fg-secondary)",background:"none",border:"none",cursor:"pointer",width:"100%",textAlign:"left",padding:"6px 0" }}>
        {open ? <ChevronDown style={{ width:12,height:12 }} /> : <ChevronRight style={{ width:12,height:12 }} />}
        {title}
      </button>
      {open && (
        <div style={{ paddingLeft:4 }}>
          {fields.map((f,i) => (
            <ColorRow key={f.variable} field={f} value={colors[f.variable]??""} onChange={onChange} readOnly={readOnly} isLast={i===fields.length-1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Theme group (collapsible sidebar section) ────────────────────────────────

interface ThemeGroupProps { label:string; icon:React.ReactNode; count:number; open:boolean; onToggle:()=>void; children:React.ReactNode; }

const ThemeGroup = ({ label, icon, count, open, onToggle, children }: ThemeGroupProps) => (
  <div>
    <button onClick={onToggle} style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"none",border:"none",cursor:"pointer",color:"var(--fg-secondary)" }}>
      {open ? <ChevronDown style={{ width:12,height:12,flexShrink:0 }} /> : <ChevronRight style={{ width:12,height:12,flexShrink:0 }} />}
      <span style={{ display:"flex",alignItems:"center",gap:6,flex:1,textAlign:"left" }}>
        {icon}
        <span style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>{label}</span>
      </span>
      <span style={{ fontSize:10,padding:"1px 6px",borderRadius:999,backgroundColor:"color-mix(in srgb, var(--fg-secondary) 15%, transparent)",color:"var(--fg-secondary)" }}>{count}</span>
    </button>
    {open && children}
  </div>
);

// ─── Theme preview mockup ─────────────────────────────────────────────────────

const ThemeMockup = ({ colors }: { colors:Record<string,string> }) => {
  const c = (v:string) => colors?.[v] ?? "transparent";
  return (
    <div style={{ backgroundColor:c("--bg-primary"),border:`1px solid ${c("--border")}`,borderRadius:8,overflow:"hidden",fontSize:11 }}>
      <div style={{ backgroundColor:c("--bg-surface"),borderBottom:`1px solid ${c("--border")}`,padding:"6px 10px",display:"flex",alignItems:"center",gap:6 }}>
        <div style={{ display:"flex",gap:5 }}>
          <div style={{ width:9,height:9,borderRadius:"50%",backgroundColor:c("--accent"),opacity:0.9 }} />
          <div style={{ width:9,height:9,borderRadius:"50%",backgroundColor:c("--border") }} />
          <div style={{ width:9,height:9,borderRadius:"50%",backgroundColor:c("--border") }} />
        </div>
        <div style={{ flex:1 }} />
        <div style={{ backgroundColor:c("--accent"),color:c("--bg-primary")||"#fff",borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600 }}>Send</div>
      </div>
      <div style={{ display:"flex" }}>
        <div style={{ width:90,backgroundColor:c("--bg-secondary"),borderRight:`1px solid ${c("--border")}`,padding:"8px 6px" }}>
          {["GET  /users","POST /data","DELETE /id"].map((label,i)=>(
            <div key={`mock-item-${i}`} style={{ padding:"4px 6px",borderRadius:4,marginBottom:3,backgroundColor:i===0?`${c("--accent")}25`:"transparent",color:i===0?c("--accent"):c("--fg-secondary"),fontSize:9,fontFamily:"monospace" }}>{label}</div>
          ))}
        </div>
        <div style={{ flex:1,padding:"10px 12px" }}>
          <div style={{ marginBottom:6,color:c("--fg-secondary"),fontSize:10 }}>Response · 200 OK</div>
          <div style={{ fontFamily:"monospace",lineHeight:1.6,fontSize:10 }}>
            <span style={{ color:c("--syntax-keyword") }}>{"{"}</span><br/>
            <span style={{ paddingLeft:12,color:c("--syntax-string") }}>"name"</span>
            <span style={{ color:c("--fg-primary") }}>: </span>
            <span style={{ color:c("--syntax-string") }}>"voiden"</span><span style={{ color:c("--fg-secondary") }}>,</span><br/>
            <span style={{ paddingLeft:12,color:c("--syntax-string") }}>"status"</span>
            <span style={{ color:c("--fg-primary") }}>: </span>
            <span style={{ color:c("--success") }}>true</span><br/>
            <span style={{ color:c("--syntax-keyword") }}>{"}"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Theme preview panel ──────────────────────────────────────────────────────

const ThemePreview = ({ theme, readOnly=false, onEdit, onDelete, deleting }: {
  theme:ThemeWithColors; readOnly?:boolean; onEdit?:()=>void; onDelete?:()=>void; deleting?:boolean;
}) => (
  <div style={{ padding:24, maxWidth:720 }}>
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
        <span style={{ fontSize:14,fontWeight:600,color:"var(--fg-primary)" }}>{theme.name}</span>
        {readOnly
          ? <span style={{ fontSize:10,color:"var(--fg-secondary)",border:"1px solid var(--border)",padding:"1px 6px",borderRadius:4,display:"flex",alignItems:"center",gap:3 }}><Lock style={{ width:10,height:10 }} /> Built-in</span>
          : <span style={{ fontSize:10,color:"var(--fg-secondary)",border:"1px solid var(--border)",padding:"1px 6px",borderRadius:4 }}>Custom</span>
        }
      </div>
      <div style={{ display:"flex",gap:8 }}>
        <button
          onClick={() => exportThemeAsFile(theme)}
          style={{ display:"flex",alignItems:"center",gap:4,padding:"4px 10px",fontSize:12,border:"1px solid var(--border)",borderRadius:6,background:"none",cursor:"pointer",color:"var(--fg-primary)" }}
          title="Export theme as .json file"
        >
          <Download style={{ width:12,height:12 }} /> Export
        </button>
        {!readOnly && (
          <>
            {onEdit && <button onClick={onEdit} style={{ display:"flex",alignItems:"center",gap:4,padding:"4px 10px",fontSize:12,border:"1px solid var(--border)",borderRadius:6,background:"none",cursor:"pointer",color:"var(--fg-primary)" }}><Pencil style={{ width:12,height:12 }} /> Edit</button>}
            {onDelete && <button onClick={onDelete} disabled={deleting} style={{ display:"flex",alignItems:"center",gap:4,padding:"4px 10px",fontSize:12,border:"1px solid var(--border)",borderRadius:6,background:"none",cursor:"pointer",color:"var(--fg-secondary)",opacity:deleting?0.5:1 }}><Trash2 style={{ width:12,height:12 }} /> {deleting?"Deleting…":"Delete"}</button>}
          </>
        )}
      </div>
    </div>
    <ThemeMockup colors={theme.colors} />
    <div style={{ backgroundColor:"var(--bg-surface)",borderRadius:8,padding:16,border:"1px solid var(--border)",marginTop:20 }}>
      {COLOR_SECTIONS.map(s=>(
        <CollapsibleSection key={s.title} title={s.title} fields={s.fields} colors={theme.colors} onChange={()=>{}} readOnly defaultOpen={s.title!=="Syntax"} />
      ))}
    </div>
  </div>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

type Mode = "list" | "create" | "edit";
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

export default function ThemeEditorScreen() {
  const [themes, setThemes]             = useState<ThemeWithColors[]>([]);
  const [mode, setMode]                 = useState<Mode>("list");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [draft, setDraft]               = useState<CustomTheme | null>(null);
  const [idError, setIdError]           = useState("");
  const [nameError, setNameError]       = useState("");
  const [saveError, setSaveError]       = useState("");
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [builtinOpen, setBuiltinOpen]   = useState(true);
  const [customOpen, setCustomOpen]     = useState(false);
  const el = (window as any).electron;

  // ─── Persistence ──────────────────────────────────────────────────────────

  const loadThemes = useCallback(async (forceSelection?: string | null) => {
    const rawList = await el?.themes?.list?.() ?? [];
    const withColors = await Promise.all(
      rawList.map(async (meta: any) => {
        try {
          const full = await el?.themes?.load?.(meta.id);
          return { ...meta, bundled: BUNDLED_IDS.has(meta.id), colors: full?.colors ?? {} } as ThemeWithColors;
        } catch (e) {
          console.error("[theme-creator] Failed to load theme details:", meta.id, e);
          return { ...meta, bundled: BUNDLED_IDS.has(meta.id), colors: {} } as ThemeWithColors;
        }
      })
    );

    const customOnly = withColors.filter(t => !t.bundled);
    setThemes(customOnly);

    if (customOnly.length > 0) {
      setCustomOpen(true);
    }

    if (forceSelection !== undefined) {
      setSelectedId(forceSelection);
    } else {
      setSelectedId(prev => {
        if (prev !== null && customOnly.some(t => t.id === prev)) return prev;
        return customOnly[0]?.id ?? null;
      });
    }
  }, [el?.themes]);

  useEffect(() => { loadThemes(); }, [loadThemes]);

  // Live preview sync
  useEffect(() => {
    if (!previewActive || !draft) return;
    loadTheme({ id: draft.id||"__preview__", name: draft.name, type: draft.type, colors: draft.colors });
  }, [previewActive, draft?.colors]);

  const selectedTheme = themes.find(t => t.id === selectedId) ?? null;

  function handleNew() {
    setDraft({ id:"", name:"", type:"dark", colors:{...DEFAULT_DARK_COLORS} });
    setIdError(""); setNameError(""); setSaveError("");
    setSelectedId(null); setMode("create");
  }

  function handleImport() {
    importThemeFromFile(async (theme) => {
      const result = await pluginSaveTheme(theme);
      if (result?.success) {
        await loadThemes(theme.id);
        setCustomOpen(true);
      } else {
        alert(result?.error ?? "Failed to import theme.");
      }
    });
  }

  async function handleEdit(themeId: string) {
    const t = themes.find(x => x.id === themeId); if (!t) return;
    setDraft({ id:t.id, name:t.name, type:(t.type as "dark"|"light")??"dark", colors:{...t.colors} });
    setIdError(""); setNameError(""); setSaveError("");
    setSelectedId(themeId); setMode("edit");
  }

  function handleSelect(themeId: string) {
    setSelectedId(themeId);
    if (mode !== "create" && mode !== "edit") setMode("list");
  }

  function setColor(variable: string, value: string) {
    setDraft(d => {
      if (!d) return d;
      const patch: Record<string,string> = { [variable]: value };
      if (variable === "--accent" && isHexColor(value)) { const rgb = hexToRgbTriplet(value); if (rgb) patch["--accent-rgb"] = rgb; }
      if (variable === "--accent-alt" && isHexColor(value)) { const rgb = hexToRgbTriplet(value); if (rgb) patch["--accent-alt-rgb"] = rgb; }
      return { ...d, colors: { ...d.colors, ...patch } };
    });
  }

  function setType(type: "dark"|"light") {
    setDraft(d => d ? { ...d, type, colors:{...(type==="dark"?DEFAULT_DARK_COLORS:DEFAULT_LIGHT_COLORS)} } : d);
  }

  function handlePreview() {
    if (!draft) return;
    loadTheme({ id:draft.id||"__preview__", name:draft.name, type:draft.type, colors:draft.colors });
    setPreviewActive(true);
  }

  async function handleRestoreTheme() {
    const s = await el?.userSettings?.get?.();
    await loadThemeById(s?.appearance?.theme ?? "voiden", themes);
    setPreviewActive(false);
  }

  async function handleSave() {
    if (!draft) return;
    let err = false;
    if (!draft.name.trim()) { setNameError("Display name is required."); err = true; } else setNameError("");
    const finalId = mode==="create" ? slugify(draft.id||draft.name) : draft.id;
    if (!finalId || !SLUG_REGEX.test(finalId)) { setIdError("ID must be lowercase letters, numbers, hyphens."); err = true; } else setIdError("");
    if (err) return;
    setSaving(true); setSaveError("");
    const result = await pluginSaveTheme({ ...draft, id:finalId });
    setSaving(false);
    if (!result?.success) { setSaveError(result?.error ?? "Failed to save."); return; }
    const wasPreviewActive = previewActive;
    setPreviewActive(false);
    await loadThemes(finalId);
    setMode("list"); setSelectedId(finalId); setDraft(null);
    if (wasPreviewActive) {
      const s = await el?.userSettings?.get?.();
      await loadThemeById(s?.appearance?.theme ?? "voiden", []);
    }
  }

  async function handleCancel() {
    if (previewActive) await handleRestoreTheme();
    setMode("list"); setDraft(null);
  }

  async function handleDelete(themeId: string) {
    setDeleting(themeId);
    const result = await pluginDeleteTheme(themeId);
    setDeleting(null);
    if (result?.success) await loadThemes(selectedId===themeId ? null : selectedId);
  }

  const builtinThemes = themes.filter(t => t.bundled);
  const userThemes    = themes.filter(t => !t.bundled);

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"6px 10px", fontSize:12, borderRadius:6,
    border:"1px solid var(--border)", backgroundColor:"var(--bg-primary)",
    color:"var(--fg-primary)", outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", backgroundColor:"var(--bg-primary)", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 20px",borderBottom:"1px solid var(--border)",flexShrink:0 }}>
        <Palette style={{ width:16,height:16,color:"var(--accent)",flexShrink:0 }} />
        <div style={{ flex:1,minWidth:0 }}>
          <span style={{ fontSize:14,fontWeight:600,color:"var(--fg-primary)" }}>Theme Editor</span>
          <span style={{ fontSize:12,color:"var(--fg-secondary)",marginLeft:12 }}>Create and manage custom themes. Saved to your user data.</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
          <button
            onClick={handleImport}
            title="Import theme from .json file"
            style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,fontSize:12,fontWeight:500,border:"1px solid var(--border)",cursor:"pointer",backgroundColor:"transparent",color:"var(--fg-primary)" }}
          >
            <Upload style={{ width:14,height:14 }} /> Import
          </button>
          <button
            onClick={handleNew} disabled={mode==="create"}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,fontSize:12,fontWeight:500,border:"none",cursor:"pointer",backgroundColor:"var(--accent)",color:"var(--bg-primary)",opacity:mode==="create"?0.5:1 }}
          >
            <Plus style={{ width:14,height:14 }} /> New Theme
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1,minHeight:0 }}>
        <PanelGroup direction="horizontal" style={{ height:"100%" }}>

          {/* Left panel */}
          <Panel defaultSize={28} minSize={18} maxSize={50} style={{ display:"flex",flexDirection:"column",overflow:"hidden" }}>
            <div style={{ height:"100%",display:"flex",flexDirection:"column",overflow:"hidden",backgroundColor:"var(--bg-secondary)" }}>
              <div style={{ flex:1,overflowY:"auto",paddingTop:8,paddingBottom:8 }}>
                <ThemeGroup label="My Themes" icon={<Palette style={{ width:10,height:10 }} />} count={userThemes.length} open={customOpen} onToggle={()=>setCustomOpen((o: boolean)=>!o)}>
                  {userThemes.length===0
                    ? <div style={{ padding:"6px 12px 12px",fontSize:11,fontStyle:"italic",color:"var(--fg-secondary)" }}>No custom themes yet.</div>
                    : <div style={{ display:"flex",flexDirection:"column",gap:8,padding:"6px 12px 12px" }}>
                        {userThemes.map((t: ThemeWithColors)=>(
                          <ThemeCard key={t.id} theme={t} isActive={selectedId===t.id} onSelect={()=>handleSelect(t.id)} onEdit={()=>handleEdit(t.id)} onDelete={()=>handleDelete(t.id)} deleting={deleting===t.id} />
                        ))}
                      </div>
                  }
                </ThemeGroup>
              </div>
            </div>
          </Panel>

          <ResizeHandle orientation="vertical" />

          {/* Right panel */}
          <Panel defaultSize={72} minSize={40}>
            <div style={{ height:"100%",overflowY:"auto" }}>

              {/* Create / Edit form */}
              {(mode==="create"||mode==="edit") && draft && (
                <div style={{ padding:24,maxWidth:720 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
                    <span style={{ fontSize:14,fontWeight:600,color:"var(--fg-primary)" }}>{mode==="create"?"New Theme":`Editing: ${draft.name||draft.id}`}</span>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      {previewActive && <span style={{ fontSize:12,color:"var(--fg-secondary)",fontStyle:"italic" }}>Preview active</span>}
                      <button onClick={previewActive?handleRestoreTheme:handlePreview} style={{ padding:"4px 10px",fontSize:12,border:"1px solid var(--border)",borderRadius:6,background:"none",cursor:"pointer",color:"var(--fg-primary)" }}>
                        {previewActive?"Restore":"Try Live"}
                      </button>
                      <button onClick={handleCancel} style={{ padding:4,border:"1px solid var(--border)",borderRadius:6,background:"none",cursor:"pointer",color:"var(--fg-secondary)",display:"flex" }}>
                        <X style={{ width:14,height:14 }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 }}>
                    <div>
                      <label style={{ display:"block",fontSize:12,color:"var(--fg-secondary)",marginBottom:4 }}>ID <span style={{ fontSize:10 }}>(slug, e.g. my-dark)</span></label>
                      <input type="text" value={draft.id} readOnly={mode==="edit"} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setDraft((d: CustomTheme | null)=>d?{...d,id:e.target.value}:d)} placeholder="my-dark-theme" style={{ ...inputStyle, opacity:mode==="edit"?0.6:1, fontFamily:"monospace" }} />
                      {idError && <div style={{ fontSize:10,marginTop:4,color:"var(--icon-error)" }}>{idError}</div>}
                    </div>
                    <div>
                      <label style={{ display:"block",fontSize:12,color:"var(--fg-secondary)",marginBottom:4 }}>Display Name</label>
                      <input type="text" value={draft.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setDraft((d: CustomTheme | null)=>d?{...d,name:e.target.value}:d)} placeholder="My Dark Theme" style={inputStyle} />
                      {nameError && <div style={{ fontSize:10,marginTop:4,color:"var(--icon-error)" }}>{nameError}</div>}
                    </div>
                  </div>

                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:20 }}>
                    <span style={{ fontSize:12,color:"var(--fg-secondary)" }}>Base:</span>
                    {(["dark","light"] as const).map(t=>(
                      <button key={t} onClick={()=>setType(t)} style={{ padding:"4px 12px",fontSize:12,fontWeight:500,borderRadius:6,cursor:"pointer",border:`1px solid ${draft.type===t?"var(--accent)":"var(--border)"}`,color:draft.type===t?"var(--fg-primary)":"var(--fg-secondary)",backgroundColor:draft.type===t?"color-mix(in srgb, var(--accent) 15%, transparent)":"transparent" }}>
                        {t==="dark"?"Dark":"Light"}
                      </button>
                    ))}
                    <span style={{ fontSize:10,color:"var(--fg-secondary)" }}>Resets colors to default for the selected type.</span>
                  </div>

                  <div style={{ backgroundColor:"var(--bg-surface)",borderRadius:8,padding:16,border:"1px solid var(--border)" }}>
                    {COLOR_SECTIONS.map(s=>(
                      <CollapsibleSection key={s.title} title={s.title} fields={s.fields} colors={draft.colors} onChange={setColor} defaultOpen={s.defaultOpen} />
                    ))}
                  </div>

                  {saveError && (
                    <div style={{ marginTop:12,padding:"8px 12px",borderRadius:6,fontSize:12,backgroundColor:"color-mix(in srgb, var(--icon-error) 10%, transparent)",border:"1px solid color-mix(in srgb, var(--icon-error) 30%, transparent)",color:"var(--icon-error)" }}>
                      {saveError}
                    </div>
                  )}

                  <div style={{ display:"flex",gap:8,marginTop:16 }}>
                    <button onClick={handleSave} disabled={saving} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 16px",fontSize:12,fontWeight:500,borderRadius:6,border:"none",cursor:"pointer",backgroundColor:"var(--accent)",color:"var(--bg-primary)",opacity:saving?0.6:1 }}>
                      <Check style={{ width:14,height:14 }} /> {saving?"Saving…":"Save Theme"}
                    </button>
                    <button onClick={handleCancel} style={{ padding:"6px 16px",fontSize:12,border:"1px solid var(--border)",borderRadius:6,background:"none",cursor:"pointer",color:"var(--fg-secondary)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {mode==="list" && selectedTheme && (
                <ThemePreview theme={selectedTheme} readOnly={selectedTheme.bundled} onEdit={selectedTheme.bundled?undefined:()=>handleEdit(selectedTheme.id)} onDelete={selectedTheme.bundled?undefined:()=>handleDelete(selectedTheme.id)} deleting={deleting===selectedTheme.id} />
              )}

              {mode==="list" && !selectedTheme && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:300,gap:12,opacity:0.4 }}>
                  <Palette style={{ width:32,height:32,color:"var(--fg-secondary)" }} />
                  <span style={{ fontSize:14,color:"var(--fg-secondary)" }}>Select a theme to preview</span>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
