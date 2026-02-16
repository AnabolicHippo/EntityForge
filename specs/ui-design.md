# UI Design & Visual System

## Theme & Color Palette

### Background Layers
- App background: `#0D0D12` (dark purple-black)
- Sidebar panels: `#12121C` (slightly lighter)
- Node background: `#16162A` (card surface)
- Input/control backgrounds: `#0D0D12` (recessed)

### Borders
- Default border: `#2a2a3a` (subtle)
- Panel dividers: `#1E1E2E`
- Active/selected: entity accent color
- Hover: `#4a4a5a`

### Text
- Primary: `#D4CFC4` (warm off-white)
- Secondary: `#B0ACA0` (dimmer)
- Tertiary/labels: `#6a6a7a` (muted)
- Disabled: `#4a4a5a`

### Accent Colors
- Primary gold: `#D4A843` (forge theme)
- Gradient: `linear-gradient(135deg, #D4A843, #B5651D)`

### Entity Type Colors
Each entity has base color + lighter accent:
- Creature: `#C44536` / `#E8785F`
- Encounter: `#D4A843` / `#F0D080`
- Dungeon: `#6B5B95` / `#A094C7`
- Location: `#3D7EA6` / `#6CB4D9`
- Trap: `#B5651D` / `#D9A066`
- Faction: `#4A6741` / `#7DA874`
- Loot: `#C9A227` / `#E8D06F`
- Roll Table: `#9B59B6` / `#C39BD3`

## Typography

### Font Families
```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Fira+Code:wght@400;500&family=Source+Sans+3:wght@300;400;500;600&display=swap');
```

- **Headings/branding:** `'Cinzel', serif` (medieval fantasy feel)
- **Body text:** `'Source Sans 3', sans-serif` (readable, modern)
- **Code/JSON:** `'Fira Code', monospace`

### Font Sizes
- Logo: 17px, weight 700
- Node entity name: 11-14px, weight 600
- Body text: 11-12px
- Labels/metadata: 9-10px
- Tiny labels: 8px

## Layout

### Three-Column Structure
```
┌──────────┬─────────────────────┬──────────┐
│  Sidebar │       Canvas        │  Details │
│  270px   │       flex:1        │  310px   │
└──────────┴─────────────────────┴──────────┘
```

### Left Sidebar (270px)
- Logo + ruleset selector (top)
- Three tabs: Nodes | Vault | Orch
- Panel content (scrollable)
- Action buttons (bottom, fixed)

### Canvas (flex)
- Grid background (30px dot pattern)
- Infinite pan/zoom
- Nodes and connections rendered
- Floating hints/errors

### Right Panel (310px, conditional)
- Only shown when node selected
- Entity header with icon
- Scrollable details
- Context prompt input
- Connected inputs list
- Generate button
- Result display (if generated)

## Animations & Transitions

### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn 0.3s ease-out; }
```

### Pulse (generating state)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.gen-pulse { animation: pulse 1.5s infinite; }
```

### Hover States
- Node cards: box-shadow transition 0.2s
- Ports: scale(1.4) on hover, transition 0.15s
- Buttons: background/border color transition 0.15s
- Connections: opacity 0.5 on hover

## Button Styles

### Primary Action (Forge)
```css
background: linear-gradient(135deg, {entity-color}, {entity-accent});
border: none;
border-radius: 7px;
color: #0D0D12;
font-weight: 700;
font-family: 'Cinzel', serif;
padding: 9px 0;
```

### Secondary Action
```css
background: transparent;
border: 1px solid #2a2a3a;
border-radius: 7px;
color: #6a6a7a;
padding: 9px 12px;
```

### Entity Palette Button
```css
background: #16162250;
border: 1px solid #2a2a3a;
border-radius: 7px;
padding: 8px 10px;
display: flex;
align-items: center;
gap: 8px;
transition: all 0.15s;
```
Hover: border `#4a4a5a`, background `#1a1a2a`

## Icons & Emoji

- Entity type icons: emoji (🐉, ⚔️, 🏰, etc.)
- UI icons: unicode symbols (⚒, 🎲, 💾, ✕, 🔒, etc.)
- Icon sizes: 12-16px (inline), 26-44px (featured)

## Scrollbars

```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1a1a24; }
::-webkit-scrollbar-thumb { background: #3a3a4a; border-radius: 3px; }
```

## Error Display

```css
position: absolute;
bottom: 16px;
left: 50%;
transform: translateX(-50%);
background: #C4453620;
border: 1px solid #C44536;
border-radius: 7px;
padding: 8px 14px;
color: #E8785F;
z-index: 20;
max-width: 380px;
```

## Focus States

```css
textarea:focus,
input:focus,
select:focus {
  outline: none;
  border-color: #D4A843 !important;
}
```

## Responsive Behavior

- Min sidebar width: 270px
- Min details panel width: 310px
- Canvas: fills remaining space
- No mobile support (desktop-only app)

## Accessibility Notes

- No ARIA labels (future enhancement)
- No keyboard navigation (future enhancement)
- Color contrast: meets WCAG AA for most text
- Focus indicators: visible on form inputs
- No screen reader support currently

## Z-Index Layers

```
1 = Connections (SVG paths)
2 = Nodes (default)
5 = Selected node
10 = Node ports, sidebar panels
20 = Error banners
100 = Modals (custom node builder)
```

## Dark Mode Only

No light mode support. Theme is locked to dark.

## Future Enhancements

- Customizable theme (color picker)
- Light mode variant
- Zoom controls (buttons + mousewheel)
- Minimap for large graphs
- Grid snapping toggle
- Node alignment tools
- Keyboard shortcuts
