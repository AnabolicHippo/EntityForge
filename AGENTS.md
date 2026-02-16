# AGENTS.md — Entity Forge Development Guide

## Project Overview

**Entity Forge** is a D&D 5e SRD-compliant content generator with:
- Node-based workflow canvas
- LLM-powered entity generation (Anthropic Claude Sonnet 4)
- Roll table integration for dice-driven randomness
- 8 core entity types + custom node builder
- React + Vite single-page application
- OpenClaw Canvas runtime (window.storage API)

## Stack

- **Framework:** React 18+ with hooks
- **Build Tool:** Vite 6+
- **Runtime:** OpenClaw Canvas (browser-based, window.storage for persistence)
- **API:** Anthropic Claude API (direct fetch, no SDK)
- **Fonts:** Google Fonts (Cinzel, Source Sans 3, Fira Code)
- **No backend** — pure client-side SPA

## Build Commands

### Development
```bash
npm install
npm run dev
```
Starts Vite dev server at http://localhost:5173

### Production Build
```bash
npm run build
```
Outputs to `dist/` directory

### Preview Production
```bash
npm run preview
```
Serves production build locally

## Project Structure

```
EntityForge/
├── src/
│   └── EntityForge.jsx        # Main React component (single file app)
├── specs/                      # Requirements (Ralph planning inputs)
│   ├── core-entities.md
│   ├── node-graph.md
│   ├── generation.md
│   ├── roll-tables.md
│   ├── persistence.md
│   └── ui-design.md
├── AGENTS.md                   # This file
├── IMPLEMENTATION_PLAN.md      # Ralph task list
├── PROMPT_*.md                 # Ralph prompt templates
├── package.json
├── vite.config.js
└── index.html
```

## Code Organization

**Current:** Single-file React component (`EntityForge.jsx`)

**Future modularization:**
- `src/components/` — Canvas, Node, Sidebar, etc.
- `src/hooks/` — useNodeGraph, useGeneration, etc.
- `src/lib/` — dice.js, api.js, validation.js
- `src/data/` — SRD reference data, pre-loaded tables
- `src/types/` — TypeScript definitions (if migrating)

## Testing

**Currently:** No tests

**When adding tests:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm run test
```

Test priorities:
1. Dice engine (rollDice, resolveRollTable)
2. Graph operations (canConnect, topologicalSort)
3. Schema validation
4. API error handling

## Linting

**Currently:** No linter

**When adding ESLint:**
```bash
npm install -D eslint eslint-plugin-react eslint-plugin-react-hooks
npm run lint
```

## API Key Management

**Anthropic API key** required for LLM generation.

Options:
1. **User provides key:** Prompt on first use, store in localStorage
2. **Server proxy:** Add backend endpoint to inject server-side key
3. **Environment variable:** `VITE_ANTHROPIC_API_KEY` (dev only, not secure)

**Current implementation:** Hardcoded direct API calls (assumes user has key or uses CORS proxy)

## OpenClaw Canvas Integration

Uses `window.storage` API for persistence:
```javascript
await window.storage.set(key, jsonString);
const data = await window.storage.get(key);
```

**Required:** Run inside OpenClaw Canvas environment, not standalone browser.

## Dependencies

Core:
- `react` ^18.3.1
- `react-dom` ^18.3.1

Dev:
- `vite` ^6.0.1
- `@vitejs/plugin-react` ^4.3.4

**No other dependencies** — vanilla React, no UI libraries, no state management libs.

## Common Tasks

### Adding a new entity type
1. Add definition to `CORE_ENTITY_TYPES` in EntityForge.jsx
2. Define schema with SRD compliance rules
3. Add to `SRD_RULESET.reference` if needed
4. Update `canConnect` rules
5. Write spec in `specs/core-entities.md`

### Adding a pre-loaded roll table
1. Add table object to `SRD_ROLL_TABLES` array
2. Include: name, dice, entries (range_min, range_max, result), tags, source

### Debugging generation issues
- Check browser console for API errors
- Verify JSON response parsing (look for markdown fences)
- Check prompt construction in `buildPrompt()`
- Validate schema match between prompt and response

## Performance Notes

- Auto-save debounce: 1 second (adjust in useEffect)
- No request throttling on LLM calls
- Large graphs (>50 nodes): may slow down canvas rendering
- JSON parsing: no validation overhead (future: add schema checks)

## Known Limitations

1. **No API key UI** — assumes key available or user knows how to inject
2. **No offline mode** — requires API connectivity
3. **No undo/redo** — git-based only
4. **Desktop only** — no mobile responsive design
5. **Single file** — needs refactoring for maintainability
6. **No TypeScript** — plain JS, no type safety
7. **No tests** — manual testing only

## Deployment

### OpenClaw Canvas
1. Build: `npm run build`
2. Copy `dist/` contents to OpenClaw canvas hosting
3. Configure storage API permissions

### Static Hosting (Vercel/Netlify)
1. Build: `npm run build`
2. Deploy `dist/` folder
3. Add CORS proxy for Anthropic API or prompt user for key

## Git Workflow

- **Main branch:** Stable releases
- **Feature branches:** One per Ralph iteration
- **Commits:** Ralph commits after each successful task
- **PR reviews:** Optional for human oversight

## Contributing Guidelines

When extending the codebase:
1. Update relevant spec in `specs/`
2. Add task to `IMPLEMENTATION_PLAN.md`
3. Implement with tests (if test suite exists)
4. Update this AGENTS.md if process changes
5. Commit with clear message: "[Entity] Add feature X"

## Resources

- D&D 5e SRD: https://dnd.wizards.com/resources/systems-reference-document
- Anthropic API docs: https://docs.anthropic.com/
- React docs: https://react.dev/
- Vite docs: https://vitejs.dev/
