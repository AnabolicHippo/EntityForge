# LLM Generation & Orchestration

## Generation Modes

### Sequential Mode (default)
- Process nodes in topological dependency order
- Each node waits for upstream results before generating
- No coordination between nodes
- Fast, deterministic, predictable

### Orchestrated Mode
- LLM pre-pass to analyze the graph and create a generation plan
- Plan includes: theme, tone, narrative threads, mechanical notes
- Node-specific directives based on graph structure
- Plan displayed to user before generation starts
- Each node generation incorporates the plan
- Slower but more coherent across multiple entities

### Conversational Mode
- Interactive chat with the Orchestrator
- User asks questions about graph design
- Orchestrator suggests nodes, connections, themes
- No automatic generation
- Manual steering before running Sequential or Orchestrated

## LLM Integration

### API Configuration
- Provider: Anthropic Claude
- Model: claude-sonnet-4-20250514
- Max tokens: 4000 (entity generation), 2000 (roll tables, orchestration)
- Headers: `Content-Type: application/json`
- Endpoint: `https://api.anthropic.com/v1/messages`

### Prompt Structure

**System Prompt (entities):**
```
You are a D&D 5th Edition content generator using the SRD 5.1 as your mechanical reference.
Reference ruleset: {ruleset.name} ({ruleset.version}). Use SRD-compliant mechanics, stat ranges, and terminology.
Always respond with ONLY valid JSON matching the requested schema. No markdown, no code fences, no explanation.
Be creative, original, and ensure content is balanced and mechanically sound per SRD rules.
```

**User Prompt (entities):**
```
Generate a D&D 5e {entity_type} as a JSON object.

Required JSON schema:
{schema}

[Connected entities context if any]
[Roll table results context if any]
[User prompt if provided]

Respond with ONLY the JSON object.
```

**Orchestration Pre-pass:**
```
You are the Entity Forge Orchestrator. Analyze the D&D content generation graph and produce a coherent generation plan.
Respond with ONLY JSON: {
  theme: string,
  tone: string,
  narrative_threads: string[],
  node_directives: { [node_description]: string }[],
  mechanical_notes: string
}
```

### Context Injection

Each generation receives:
1. **Entity schema** — required JSON structure for the entity type
2. **Connected inputs** — results from connected upstream nodes
   - Format: `{ type, name, data }`
   - Full JSON of upstream entities
3. **Roll table results** — resolved dice rolls from connected roll table nodes
   - Format: `{ table: string, roll: {total, notation}, entry: {result} }`
4. **User prompt** — optional context from the node's prompt field
5. **Orchestration plan** (if orchestrated mode) — theme, tone, directives

### Response Handling

1. Extract text from LLM response content blocks
2. Strip markdown code fences: `/```json\s*|```\s*/g`
3. Trim whitespace
4. Parse JSON
5. Validate against entity schema (future enhancement)
6. Store in node.result
7. Mark node as complete

### Error Handling

- Network errors: display error banner at bottom of canvas
- JSON parse errors: display error with LLM response excerpt
- Empty responses: throw "Empty response" error
- Invalid schema: future enhancement (currently no runtime validation)

## Generation Workflow

### Single Node Generation
1. User clicks "Forge {EntityType}" in right panel
2. Set generating state, track generatingNodeId
3. Gather upstream inputs:
   - Find connections where target = this node
   - Collect source node results
   - Separate roll table results from entity results
4. Build system + user prompt with context
5. Make API request
6. On success: parse JSON, store result, clear generating state
7. On error: display error, clear generating state

### Forge All
1. User clicks "Forge All" or "Orchestrate"
2. First, process all roll table nodes:
   - If no result but has prompt: generate via LLM
   - If has result but not locked: re-roll
3. If orchestrated mode and >2 nodes: run orchestration pre-pass
   - Build graph description
   - Include roll table results
   - Generate plan
   - Display plan to user
4. Get topological sort order
5. For each node in order (skip roll tables):
   - Generate with full context (inputs + rolls + plan if orchestrated)
   - Wait for completion before next node
6. Clear orchestration plan when done

## Orchestrator Chat

Available in conversational mode:
- User sends message to Orchestrator
- Include current graph context in system prompt:
  - List of nodes with types and prompts
  - Current roll table results
- Orchestrator responds with suggestions:
  - Node types to add
  - Connection patterns
  - Thematic coherence tips
  - Mechanical balance advice
- Chat history kept (last 10 messages)
- No automatic actions — purely advisory

## Performance Considerations

- Sequential generation: one API call per node (can parallelize in future)
- Orchestrated: +1 API call for pre-pass
- Roll table generation: one API call per table with prompt
- No rate limiting (relies on Anthropic's built-in limits)
- No request caching
- No streaming (wait for full response)

## Future Enhancements

- Schema validation on responses
- Retry logic with exponential backoff
- Parallel generation for independent nodes
- Request streaming for real-time feedback
- Cost tracking (tokens, API calls)
- Response caching for identical prompts
