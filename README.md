# Entity Forge

**D&D 5e SRD Content Generator** — Node-based workflow with LLM-powered entity creation

## Features

- 🐉 **8 Core Entity Types:** Creature, Encounter, Dungeon, Location, Trap, Faction, Loot, Roll Table
- 🎲 **Dice-Driven Randomness:** Roll tables inject procedural inputs into generation
- 🧠 **LLM Orchestration:** Sequential, orchestrated, or conversational generation modes
- 📐 **Node Graph Workflow:** Visual canvas with drag-drop connections
- 📚 **SRD 5.1 Compliant:** Mechanically accurate D&D content
- 💾 **Entity Vault:** Save and reuse generated content
- ⚙️ **Custom Nodes:** Extend with your own entity types

## Tech Stack

- React 18 + Vite
- Anthropic Claude Sonnet 4 API
- OpenClaw Canvas runtime (window.storage)
- Single-file architecture (for now)

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Usage

1. **Add nodes** from the left palette
2. **Connect outputs → inputs** (drag from right port to left port)
3. **Add prompts** in the right panel when selecting a node
4. **Forge entities** one at a time or all at once
5. **Save to vault** to reuse across workflows

## Development

Built using the **Ralph Wiggum** methodology — autonomous iterative coding with:
- Fresh context per iteration
- File-based memory via IMPLEMENTATION_PLAN.md
- Specs-driven planning and building
- One task per loop, git commits after each

See `AGENTS.md` for development guide.

## License

MIT

## Credits

SRD 5.1 content © Wizards of the Coast  
Built with Claude Sonnet 4 via Anthropic API
