# St. Anthony's Smart Solutions - Brand Design System & UI Blueprint

This document specifies the exact brand color palette, typography guidelines, and responsive user interface layout blueprints for **St. Anthony's Hardware Store Management System**. This specification is formatted so you can feed it directly to an AI coding assistant to generate high-fidelity, polished, and production-ready React / Tailwind CSS dashboard modules.

---

## 1. Brand Identity & Color Philosophy
The colors are extracted directly from the corporate website of **St. Anthony's Smart Solutions (Pvt) Ltd**. 
The system leverages a premium **Corporate Trust Blue** representing enterprise stability and logistics, paired with a vibrant **Active Amber/Orange** representing active trade, raw timber, and immediate stock actions. 

### Core Palette (Tailwind CSS Tokens)

```css
@theme {
  /* Brand Primary Corporate Blues */
  --color-brand-blue-50: #f0f8ff;    /* Ice Blue / Sublest background container */
  --color-brand-blue-100: #e0f2fe;   /* Alert containers, table row selections */
  --color-brand-blue-200: #bae6fd;   /* Subtle divider weight, borders */
  --color-brand-blue-500: #0076b6;   /* BRAND PRIMARY - Used in Logo Header & Sawmill Card */
  --color-brand-blue-600: #006299;   /* Hover adjustments for buttons */
  --color-brand-blue-700: #004e7a;   /* Deep Blue - Used for sidebar accents and labels */
  --color-brand-blue-900: #1c324a;   /* Contrast Midnight Charcoal/Blue for deep headers */

  /* Brand Secondary Amber/Golds (Dealer & Distribution accent) */
  --color-brand-gold-50: #fffbeb;    /* Warm Amber tint background */
  --color-brand-gold-100: #fef3c7;   /* Badge backing for low stock */
  --color-brand-gold-500: #f08b1d;   /* ACCENT ORANGE - Captured from 'Dealer & Distribution' */
  --color-brand-gold-600: #d67410;   /* Warning indicators, highlight states */
  --color-brand-gold-700: #b25b08;   /* High-contrast amber text labels */

  /* Neutral Typography and Grids */
  --color-slate-50: #f8fafc;         /* Main application body rest-canvas */
  --color-slate-100: #f1f5f9;        /* Border dividers, standard grids */
  --color-slate-900: #0f172a;        /* Deep slate for high-exposure readable text */
}
```

---

## 2. Accessibility & Contrast (WCAG 2.1 Compliance)
To ensure long-shift comfort for warehouse operators and retail clerks, please adhere to these strict element placement rules:

*   **Primary Corporate Blue (`#0076B6`)**: Has a contrast ratio of **4.56:1** against white. Restrict its use to flat backgrounds carrying bold white text, primary structural navbar sections, or high-weight body icons.
*   **Active Amber/Orange (`#F08B1D`)**: Has a ratio of **3.22:1** against white. **Never** use white text directly on top of this color. Always paint labels inside Amber cards with deep charcoal text (`#0F172A` / `slate-900`) or deep orange (`#B25B08` / `amber-900`) to guarantee high-contrast legibility.
*   **Body Rest-Canvas (`#F8FAFC`)**: Ensures soft, modern, eye-strain-free background workspaces during night shifts.

---

## 3. Typography & Sizing Principles
Craft clean visual scale by pairing contrasting monospace with humanist editorial headings:

*   **Display Font (Headings, Stats, Cards)**: Recommend **"Space Grotesk"** or system equivalent.
    *   *Usage*: Page headings, stock unit quantities, and big numeric indicators.
*   **Body Text (Buttons, Labels, Tables)**: Recommend **"Inter"** or system equivalent sans-serif.
    *   *Usage*: Core tabular reports, descriptions, vendor names, form overlays.
*   **Metadata Font (SKUs, IDs, Vouchers, Tally Links)**: Recommend **"JetBrains Mono"** or standard micro-monospace text.
    *   *Usage*: Live serial keys, SKU trackers, invoice lines, and time stamps.

---

## 4. UI Layout Design Recommendations for AI Generators
When instructing another AI coding assistant or visual workflow builder, instruct them on these architectural frameworks:

### A. Responsive Enterprise Shell Layout
1.  **Dual-Tone Bordered Shell**: Maintain a permanent sidebar in **slate-900 / Midnight** (`bg-[#0F172A]`) with subtle borders set to deep blue (`border-[#004e7a]`).
2.  **Top Brand Bar**: Top bar mimicking St. Anthony's smart solutions website containing the main blue banner (`#0076B6`) and the grid logo visual representation (consisting of white, green, and orange blocks).
3.  **Active route markers**: Current active tabs should be colored `#0076B6` with a slim decorative vertical ribbon colored `#F08B1D` on the right side.

### B. High-Fidelity Data Tables (Materials & Stock)
1.  **Strict Contrast Column Layout**: Clear zebra-striping rows using `#F8FAFC` alternating with absolute white `#FFFFFF`. Keep horizontal dividers very slim (`border-slate-100`).
2.  **Explicit Warning Chips**:
    *   **In Stock items**: High contrast tag using emerald green tint with dark emerald text (`bg-emerald-50 text-emerald-800`).
    *   **Reorder / Low Stock items**: Pulse animation indicator inside an amber container (`bg-brand-gold-50 text-brand-gold-800 border border-brand-gold-100`).
    *   **Depleted / Out-of-Stock items**: Urgent high-contrast signal in light crimson padding (`bg-red-50 text-red-800`).
3.  **Aligned Monospace Numeric block**: Quantities must always align vertically using a tabular monospaced font family for rapid scannability during audits.

### C. Dashboard KPI Framework
1.  **Top Decorative Ribbons**: Every metric card should present a solid thin 4px color bar running along its top edge. 
    *   Use *Trust Blue* for general capacity or totals.
    *   Use *Active Amber* for alerts or pending adjustments.
2.  **Action Drawers**: Overlay actions (like making sales or adjusting timber yards) must not clutter the dashboard. Introduce a clean sliding interactive slate block or expandable action console that holds clear fields.

---

## 5. Sample Copy-Paste Component Blueprints

### Tailwind HTML - Stat Metric Card:
```html
<div class="bg-white rounded-xl border border-slate-200 relative overflow-hidden p-6 shadow-sm">
  <!-- Accent Ribbon: Brand Orange -->
  <div class="absolute top-0 left-0 right-0 h-1 bg-[#F08B1D]" />
  <div class="flex items-center justify-between">
    <span class="text-slate-500 text-xs font-mono tracking-wider font-semibold">PENDING DISPATCH DEBT</span>
    <span class="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full flex items-center">
      +14.2%
    </span>
  </div>
  <div class="mt-3">
    <span class="text-3xl font-semibold text-slate-900 tracking-tight font-display">Rs. 285,400.00</span>
    <p class="text-[11px] text-slate-400 mt-1 font-mono">TALLY ID: M_LEDGER_09</p>
  </div>
</div>
```

### Tailwind HTML - Inventory Ledger Entry:
```html
<tr class="hover:bg-[#F0f8ff]/40 transition-colors">
  <td class="px-6 py-4">
    <span class="block text-[10px] font-mono text-slate-400">SKU-TIM-432</span>
    <span class="font-bold text-slate-900 text-sm">Teak Planks 2" x 4" x 10'</span>
    <span class="text-[10px] text-[#0076B6] font-semibold bg-[#e0f2fe] px-1.5 py-0.2 rounded font-mono uppercase">Timber Sawmill</span>
  </td>
  <td class="px-6 py-4 font-mono text-sm text-slate-800">
    <strong>45</strong> <span class="text-slate-400 text-xs font-sans">Pieces</span>
  </td>
  <td class="px-6 py-4">
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fffbeb] text-[#b25b08] border border-[#fef3c7]">
      <span class="w-1.5 h-1.5 rounded-full bg-[#f08b1d] animate-pulse"></span>
      REORDER LIMIT
    </span>
  </td>
  <td class="px-6 py-4 text-right font-mono font-bold text-slate-900">
    Rs. 4,200.00
  </td>
</tr>
```
