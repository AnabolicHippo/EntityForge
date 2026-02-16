# Roll Tables & Dice Mechanics

## Roll Table Node Behavior

Roll tables are **source nodes** — they generate random inputs for other entity types.

### Unique Properties
- No input ports (isSource: true)
- Can connect to ALL entity types
- Store table definition in node.result
- Store rolled outcome in rollResults[nodeId]
- Lock/unlock mechanism to freeze results

## Dice Engine

### Notation Parser
- Format: `[count]d{sides}[+/-modifier]`
- Examples: `d20`, `2d6`, `3d8+5`, `d100-10`
- Regex: `/^(\d*)d(\d+)([+-]\d+)?$/i`
- Defaults: count = 1 if omitted, modifier = 0 if omitted

### Roll Execution
```javascript
function rollDice(notation) {
  // Parse notation
  // Roll N times (1 to sides)
  // Sum rolls + modifier
  // Return { total, rolls[], notation }
}
```

### Table Resolution
```javascript
function resolveRollTable(table) {
  // Roll dice using table.dice notation
  // Find entry where roll.total in [range_min, range_max]
  // Return { roll, entry, table: table.name }
}
```

## Table Definition Schema

```json
{
  "name": "string (e.g., 'NPC Appearance')",
  "dice": "string (e.g., 'd20', '2d6')",
  "entries": [
    {
      "range_min": "number (1-100)",
      "range_max": "number (1-100)",
      "result": "string (outcome text)"
    }
  ],
  "tags": ["string[]"],
  "reroll_duplicates": "boolean?",
  "cascade": "boolean?",
  "source": "string? (attribution)"
}
```

## Table Creation Methods

### Method 1: Pre-loaded SRD Tables
- User clicks pre-loaded table from palette
- Table definition immediately stored in node.result
- Auto-roll on creation → rollResults[nodeId]
- No LLM call needed

### Method 2: LLM-Generated Tables
- User enters prompt: "Random encounters for haunted forest, d12"
- Click "Forge Roll Table"
- LLM generates table definition as JSON
- Store in node.result
- Auto-roll immediately

### Method 3: Manual JSON Entry
- Future enhancement: visual table editor
- User can paste custom JSON in right panel
- Validate schema before accepting

## Roll Results Display

### In Node Card (canvas)
- Show rolled total and dice notation
- Show first 30 chars of result text
- Example: `🎲 14 → "Distinctive scar"`

### In Right Panel (details)
- Full rolled result text
- Dice breakdown: `Rolled: 14 (d20)`
- Complete entry list with ranges
- Re-roll button (disabled if locked)
- Lock/unlock button (🔒/🔓)

## Lock Mechanism

**Purpose:** Freeze a roll result across regenerations

- Locked rolls: re-roll button disabled, result persists
- Unlocked rolls: can manually re-roll or auto-re-roll on "Forge All"
- Lock state stored in lockedRolls[nodeId]
- Visual indicator: lock icon color changes

### Lock Behavior During "Forge All"
1. Roll tables with results but NOT locked: re-roll
2. Roll tables with results AND locked: keep current result
3. Roll tables with prompt but no result: generate + roll

## Integration with Entity Generation

When generating an entity that has roll table inputs:

**Prompt injection:**
```
Roll table results to incorporate:
🎲 NPC Appearance: Rolled 14 on d20 → "Distinctive scar"
🎲 NPC Trait: Rolled 7 on d12 → "Honest"
```

**Entity LLM instruction:**
- Incorporate roll table results into the generated content
- Example: NPC creature should have a scar and honest personality
- Don't just copy — interpret and integrate creatively

## Cascade & Reroll Duplicates

### Cascade Flag
- When enabled, result can reference another roll table
- Example: "Roll on Magic Item table" → trigger nested roll
- **Not implemented yet** — future enhancement

### Reroll Duplicates
- When enabled, if same result rolled twice in a session, re-roll
- Track history in session state
- **Not implemented yet** — future enhancement

## Pre-loaded SRD Tables

Ship with these tables already defined:

1. **NPC Appearance (d20)**
   - 20 entries: jewelry, piercings, scars, tattoos, unusual features
   - Source: SRD 5.1 - NPC Characteristics

2. **NPC Interaction Trait (d12)**
   - 12 entries: argumentative, arrogant, curious, friendly, suspicious, etc.
   - Source: SRD 5.1 - NPC Characteristics

3. **Dungeon Noises (d12)**
   - 12 entries: bang/slam, buzzing, chanting, footsteps, screaming
   - Source: SRD 5.1 - Dungeon Dressing

## Future Enhancements

- **Nested rolls:** Cascade support for complex tables
- **Weighted probabilities:** Not all ranges equal
- **Custom dice:** d3, d30, percentile (d100)
- **Multiple rolls:** "Roll 3 times" mechanic
- **Table editor UI:** Visual builder instead of JSON paste
- **Community tables:** Import/export/share tables
