# Persistence & Storage

## Storage System

Uses `window.storage` API (OpenClaw Canvas storage):
- Key-value pairs
- JSON serialization
- Async get/set operations
- No size limits (within browser constraints)

## Storage Keys

### ef2-workflow
Current canvas state:
```json
{
  "nodes": [...],
  "connections": [...],
  "contextPrompts": { nodeId: "prompt" },
  "rollResults": { nodeId: result },
  "lockedRolls": { nodeId: boolean }
}
```
Auto-saved 1 second after any change.

### ef2-entities
Saved entity vault:
```json
[
  {
    "id": "abc123",
    "type": "creature",
    "data": { ...entity result },
    "savedAt": "2024-01-01T12:00:00.000Z"
  }
]
```

### ef2-custom-nodes
User-created custom entity types:
```json
{
  "quest": {
    "id": "quest",
    "name": "Quest",
    "icon": "⚙️",
    "color": "#888888",
    "accent": "#AAAAAA",
    "description": "...",
    "acceptsInputs": ["creature", "location"],
    "schema": { ... },
    "isCustom": true
  }
}
```

## Entity Vault

### Saving Entities
1. User clicks "💾 Save" in right panel
2. Create entity object with generated ID, type, data, timestamp
3. Append to savedEntities array
4. Write to storage: `ef2-entities`

### Vault Panel
- Accessible via left sidebar "Vault" tab
- List all saved entities
- Display: icon, name (from data.name or type), JSON preview (100 chars)
- Delete button per entity
- No edit capability (entities are immutable snapshots)

### Future Enhancements
- Export entities as JSON files
- Import entities from JSON
- Share entities via URL
- Tag/categorize entities
- Search vault

## Custom Node Persistence

Custom nodes created via Custom Node Builder:
1. User defines: name, icon, color, schema, acceptsInputs
2. Generate ID from name (lowercase, underscores)
3. Add to entityTypes state
4. Filter custom nodes (where isCustom: true)
5. Write custom-only nodes to storage: `ef2-custom-nodes`
6. Load custom nodes on app mount, merge with CORE_ENTITY_TYPES

## Canvas Reset

"Clear Canvas" button:
- Clears nodes, connections, contextPrompts, rollResults, lockedRolls
- Does NOT clear vault or custom nodes
- Triggers auto-save (empty state)
- No confirmation dialog (future: add warning)

## Load Order on App Mount

```javascript
useEffect(() => {
  // 1. Load vault
  const vaultData = await window.storage.get("ef2-entities");
  if (vaultData?.value) setSavedEntities(JSON.parse(vaultData.value));

  // 2. Load workflow
  const workflowData = await window.storage.get("ef2-workflow");
  if (workflowData?.value) {
    const wf = JSON.parse(workflowData.value);
    setNodes(wf.nodes);
    setConnections(wf.connections);
    setContextPrompts(wf.contextPrompts || {});
    setRollResults(wf.rollResults || {});
    setLockedRolls(wf.lockedRolls || {});
  }

  // 3. Load custom nodes
  const customData = await window.storage.get("ef2-custom-nodes");
  if (customData?.value) {
    const custom = JSON.parse(customData.value);
    setEntityTypes(prev => ({ ...prev, ...custom }));
  }
}, []);
```

## Auto-save Mechanism

```javascript
const saveWorkflow = useCallback(async () => {
  const data = { nodes, connections, contextPrompts, rollResults, lockedRolls };
  await window.storage.set("ef2-workflow", JSON.stringify(data));
}, [nodes, connections, contextPrompts, rollResults, lockedRolls]);

useEffect(() => {
  const timer = setTimeout(saveWorkflow, 1000);
  return () => clearTimeout(timer);
}, [saveWorkflow]);
```

Triggers on any change to dependencies with 1-second debounce.

## Error Handling

All storage operations wrapped in try-catch:
- Failures are silent (logged but don't block UI)
- No retry logic
- No offline support
- No conflict resolution (last write wins)

## Future Enhancements

- Export/import full workflow as JSON
- Version history (undo/redo)
- Named workflows (multiple save slots)
- Cloud sync
- Collaborative editing
