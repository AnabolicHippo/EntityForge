# Node Graph System

## Canvas

- Infinite canvas with panning (click-drag background)
- Grid background with subtle dots (30px spacing)
- Canvas offset tracking for node positioning
- Zoom controls (future enhancement)

## Nodes

### Visual Design
- Width: 200px, min-height: 100px
- Border radius: 9px
- Background: #16162A
- Border: 1.5px solid (color varies by state)
  - Selected: entity accent color
  - Generating: #D4A843
  - Has result: entity color @ 60% opacity
  - Default: #2a2a3a
- Box shadow on selection: 0 0 16px {entity-color}30

### Node States
1. **Empty** — Just created, no result
2. **Generating** — LLM request in flight (pulsing animation)
3. **Complete** — Has generated result
4. **Selected** — User has clicked to view details
5. **Locked** (roll tables only) — Result frozen, no re-rolls

### Node Header
- Entity icon (26x26 rounded square, color background @ 25% opacity)
- Entity name or generated result name
- Type label when result exists
- Delete button (× top-right corner)

### Node Ports
- **Input port** (left side, center): accepts connections from compatible sources
  - 12px circle, positioned at left: -6px, top: 50px (NODE_H/2)
  - Color: entity color when connected, #2a2a3a when empty
  - Not shown on source-only nodes (roll tables)
- **Output port** (right side, center): sends data downstream
  - 12px circle, positioned at right: -6px, top: 50px
  - Color: entity color when connected, #2a2a3a when empty
  - Initiates connection mode on mousedown

### Drag & Drop
- Click node header/body (not ports) to drag
- Cursor: grab → grabbing during drag
- Track drag offset to preserve click position
- Update position on mousemove while dragging
- Release on mouseup
- Prevent drag when clicking ports or delete button

## Connections

### Visual Design
- Curved Bézier paths (cubic-bezier with control points at ±50% horizontal distance)
- Gradient stroke from source color to target color
- 2px stroke width
- Dashed stroke when source has no result
- Solid stroke when source has result
- 12px transparent hit area for easy clicking
- End cap: 4px circle at target input port

### Connection Rules
- Only compatible types can connect (acceptsInputs array)
- No duplicate connections (same source + target)
- No self-connections
- Multiple inputs allowed per node
- Multiple outputs allowed per node

### Connection Flow
1. Mousedown on output port → enter connecting mode
2. Show connection hint: "Click an input port on a compatible node"
3. Mousemove → track cursor (future: show preview line)
4. Click input port → validate compatibility → create connection
5. Click canvas → cancel connection mode

### Deletion
- Click connection line (12px hit area) → remove connection
- Hover opacity: 0.5
- Cascade: deleting a node removes all its connections

## Compatibility Matrix

Roll tables connect to ALL entity types.

Entity type connections (source → target):
- **Creature** → Encounter, Dungeon, Location, Faction
- **Encounter** → Dungeon
- **Dungeon** → Location
- **Location** → Encounter, Faction
- **Trap** → Encounter, Dungeon
- **Faction** → Location
- **Loot** → Creature, Encounter, Dungeon

## Canvas Interactions

### Pan
- Mousedown on canvas background → enter pan mode
- Cursor: grab → grabbing
- Track pan start position
- Mousemove → update canvas offset
- Mouseup → exit pan mode
- Deselect any selected node when panning starts

### Selection
- Click node → select (show right panel with details)
- Click canvas → deselect all
- Only one node selected at a time

### Empty State
- Center message when no nodes exist:
  - ⚒ icon (44px)
  - "The Forge Awaits" (Cinzel font)
  - Instructions: "Add entity nodes from the palette..."
  
## Persistence

- Auto-save workflow every 1 second after changes
- Save nodes array, connections array, contextPrompts, rollResults, lockedRolls
- Storage key: `ef2-workflow`
- Load on app mount
- Clear canvas button: reset nodes, connections, all state

## Topological Sort

For orchestrated generation, nodes must be processed in dependency order:
1. Build adjacency list and in-degree count
2. Start with nodes that have in-degree 0
3. Process nodes, decrementing in-degree of children
4. When child reaches in-degree 0, add to queue
5. Return sorted order

Used by "Forge All" to ensure upstream results are available before downstream generation.
