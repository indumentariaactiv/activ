# Design System Specification: Altiv Exclusive Sportswear

## 1. Overview & Creative North Star

### The Creative North Star: "The Precision Athlete"
This design system moves away from the cluttered, spreadsheet-heavy legacy of manufacturing software and toward a high-end, editorial SaaS experience. The "Precision Athlete" concept combines the raw energy of performance sportswear with the clinical accuracy of a professional order management system. 

We break the traditional "template" look by utilizing **intentional asymmetry** and **tonal layering**. Large-scale typography serves as a structural element rather than just a label, and the layout uses generous negative space to allow complex manufacturing data to breathe. Instead of rigid grids, we use overlapping elements and varying surface depths to create an interface that feels bespoke, premium, and authoritative.

---

## 2. Colors

The palette is anchored by deep, authoritative blues and high-contrast accents, designed to feel sophisticated yet high-performance.

### The "No-Line" Rule
To achieve a signature premium look, **1px solid borders are prohibited for sectioning.** Boundaries must be defined through tonal shifts. For example, a `surface-container-low` data table should sit directly on a `surface` background without a stroke. Use the natural contrast between tokens to define the edge of the content.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers to create depth:
*   **Base Layer:** `surface` (#f9f9ff)
*   **Secondary Sections:** `surface-container-low` (#f0f3ff)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff) for maximum "lift."
*   **Deep Navigation/Sidebar:** `inverse-surface` (#233148) for an authoritative contrast.

### The "Glass & Gradient" Rule
For floating elements like "Order Summary" modals or "Production Status" overlays, utilize **Glassmorphism**. Use a semi-transparent `primary_container` or `surface` with a 20px-40px backdrop blur. 
*   **Signature Textures:** Main CTAs should use a subtle linear gradient from `primary` (#0059bb) to `primary_container` (#0070ea) at a 135-degree angle to provide a "lit from within" professional polish.

---

## 3. Typography

The system utilizes a dual-typeface strategy to balance athletic energy with administrative clarity.

*   **Display & Headlines (Manrope):** Chosen for its geometric, modern structure. Used at scale (`display-lg` to `headline-sm`), it provides an editorial feel that mimics high-end fashion branding.
*   **Body & Labels (Inter):** A high-legibility sans-serif used for all functional data. Inter's tall x-height ensures that complex SKU numbers and order quantities remain readable even at `label-sm`.

**Hierarchy Tip:** Use `tertiary` (#9e3d00) sparingly for alerts or "Action Required" statuses to provide a sharp, professional contrast against the deep navy palette.

---

## 4. Elevation & Depth

We convey hierarchy through **Tonal Layering** rather than traditional structural lines or heavy shadows.

*   **The Layering Principle:** Depth is achieved by "stacking." Place a `surface-container-lowest` card on a `surface-container-high` section to create a soft, natural lift.
*   **Ambient Shadows:** For high-priority floating elements, use extra-diffused shadows.
    *   *Value:* `0px 12px 32px rgba(13, 28, 50, 0.06)`
    *   The shadow is tinted with `on_surface` to ensure it feels like a natural part of the environment.
*   **The "Ghost Border" Fallback:** If a container requires definition against a similar background, use a "Ghost Border": `outline-variant` at **15% opacity**. Never use a 100% opaque border.
*   **Object-Oriented Radii:** Follow a strict 8px (`DEFAULT`) to 12px (`md`) scale for all containers to maintain the "Modern Sportswear" aesthetic—rounded enough to feel approachable, but sharp enough to feel professional.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`), white text, 8px radius.
*   **Secondary:** `surface-container-highest` background with `on_secondary_container` text. No border.
*   **Tertiary:** Transparent background with `primary` text. Use for low-emphasis actions like "Add Note."

### Cards & Data Lists
*   **Forbidden:** Divider lines between list items.
*   **Alternative:** Use 12px-16px of vertical white space or alternating tonal shifts (`surface` to `surface-container-low`) to separate production line items.
*   **Order Cards:** Use `surface-container-lowest` with a "Ghost Border" and an 8px radius.

### Input Fields
*   **State:** Neutral states use `surface-container-high` as a background.
*   **Focus:** Transition the background to `surface-container-lowest` and apply a 2px `primary` ghost border (20% opacity).

### Manufacturing Specific Components
*   **Size Matrix Grid:** Unlike the provided reference image, do not use heavy black grids. Use a "Soft Grid" where only the header has a subtle `surface-container-highest` background and data cells are separated by 4px of white space.
*   **Status Chips:** Use high-chroma `primary_fixed` for "In Production" and `tertiary_fixed` for "On Hold," utilizing rounded-full shapes for an "Object-Oriented" feel.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `primary` gradients for the "Altiv" brand moments (Logos, Hero CTAs).
*   **Do** prioritize "Breathing Room." If a table feels cramped, increase the vertical padding rather than adding a divider.
*   **Do** use `manrope` in all-caps for `label-sm` to give it a sophisticated, "spec-sheet" look.

### Don't
*   **Don't** use pure black (#000000). Use `on_surface` (#0d1c32) for text to maintain the deep navy brand soul.
*   **Don't** use 1px solid borders for layout. If you feel you need a line, use a background color change instead.
*   **Don't** use standard "drop shadows" with high opacity. If it looks like a shadow, it’s too dark. It should look like a "glow" or "soft lift."
*   **Don't** cram data. The legacy manufacturing look is the enemy. Group information logically and use the `xl` (1.5rem) spacing token between major content blocks.