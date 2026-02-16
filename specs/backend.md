# Entity Forge Backend PRD

**Product:** Entity Forge Backend (PostgreSQL + pgvector + Express API)  
**Version:** 1.0  
**Date:** 2026-02-16  
**Status:** Draft → Ready for Implementation  
**Target Audience:** Senior developer (Ralph/Codex)

---

## Executive Summary

Transform Entity Forge from a **client-only React app with ephemeral storage** into a **full-stack application with PostgreSQL persistence, vector embeddings, and RAG-powered chat interface**.

**Current State:**
- Frontend: React + Vite (1,545 lines, `src/EntityForge.jsx`)
- Storage: `window.storage` (key-value pairs, ~50MB browser limit)
- Limitations: No search, no relationships, no collaboration, no semantic queries

**Target State:**
- **Backend:** Express + Prisma + PostgreSQL 15+ with pgvector extension
- **Auth:** Supabase Auth (JWT-based, OAuth support)
- **Storage:** Normalized schema with JSONB flexibility + vector embeddings
- **Features:** Semantic search, RAG for context-aware generation, chat-to-graph workflow builder
- **Deployment:** Railway (backend + DB) + Vercel (frontend, static)

---

## Goals

### Phase 1: Backend Foundation (MVP - Week 1-2)
1. **PostgreSQL schema:** Users, workspaces, entities, workflows, versions
2. **REST API:** CRUD endpoints for entities/workflows with auth middleware
3. **Migration:** Export from window.storage → Import to PostgreSQL
4. **Frontend API client:** Replace window.storage calls with fetch/axios
5. **Deploy:** Railway (backend + DB) + Vercel (frontend)

### Phase 2: Vector Embeddings + RAG (Week 3)
6. **pgvector extension:** Install and configure IVFFlat indexes
7. **Embedding pipeline:** OpenAI `text-embedding-3-small` (1536 dims)
8. **Background worker:** BullMQ or pg-boss for async embedding generation
9. **Vector search API:** `/api/entities/similar` with cosine similarity
10. **Frontend integration:** "Similar entities" panel, semantic search bar

### Phase 3: Chat Interface (Week 4-5)
11. **Chat UI:** Sidebar with message history, streaming responses
12. **Workflow generator:** LLM orchestration (Anthropic/OpenAI) with RAG context injection
13. **Graph deserialization:** LLM JSON → Canvas state (nodes, connections, prompts)
14. **Refinement loop:** Edit prompts, regenerate nodes, save to vault

### Phase 4: Polish + Collaboration (Optional - Month 2+)
15. **Real-time sync:** WebSockets for multi-user canvas editing
16. **Permissions:** Workspace roles (viewer, editor, admin)
17. **Analytics:** Generation logs, cost tracking, usage dashboards
18. **Community features:** Public templates, favorites, forking

---

## Non-Goals (Out of Scope for MVP)

- ❌ Real-time collaboration (Phase 4 only)
- ❌ Mobile app (web-first)
- ❌ Offline mode (requires service workers + IndexedDB sync)
- ❌ Third-party integrations (D&D Beyond, Roll20, etc.)
- ❌ Payment processing (assume free tier for MVP)
- ❌ Custom domains (use Railway/Vercel subdomains)

---

## Technical Architecture

### Stack

**Backend:**
- **Runtime:** Node.js 20+ (ESM, top-level await)
- **Framework:** Express 4.x (REST API, middleware-based)
- **ORM:** Prisma 5.x (type-safe queries, migrations, seeding)
- **Database:** PostgreSQL 15+ with pgvector 0.5.0+ extension
- **Queue:** BullMQ 5.x (Redis-backed job queue for embeddings)
- **Auth:** Supabase Auth (managed OAuth, magic links, JWT verification)

**Frontend (No Major Changes):**
- **Build:** Vite 6 + React 18 (existing setup)
- **API Client:** Fetch API with JWT headers
- **State:** React hooks (existing architecture preserved)

**Hosting:**
- **Backend + DB:** Railway ($10-20/mo)
- **Frontend:** Vercel (free tier, auto-deploy from GitHub)
- **Redis:** Upstash (free tier, 10k commands/day) or Railway addon

**External APIs:**
- **Embeddings:** OpenAI `text-embedding-3-small` ($0.02/1M tokens)
- **LLM (Chat):** Anthropic Claude Sonnet 4.5 or OpenAI GPT-4o
- **Auth:** Supabase (free tier → $25/mo)

---

## Database Schema

### Core Tables

```sql
-- Users (mirrored from Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces (multi-tenancy for future collaboration)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities (core data model with JSONB + vector embeddings)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('creature', 'encounter', 'dungeon', 'location', 'trap', 'faction', 'loot', 'roll_table')),
  name TEXT,  -- Extracted from data->'name' via trigger
  data JSONB NOT NULL,  -- Full SRD entity JSON (preserves flexibility)
  embedding vector(1536),  -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_entities_workspace ON entities(workspace_id);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_name ON entities USING GIN(to_tsvector('english', name));
CREATE INDEX idx_entities_data ON entities USING GIN(data);
CREATE INDEX idx_entities_embedding ON entities USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- Workflows (canvas states)
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL,  -- {nodes, connections, contextPrompts, rollResults, lockedRolls}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Entity versions (history/undo)
CREATE TABLE entity_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  version INT NOT NULL,
  data JSONB NOT NULL,
  embedding vector(1536),  -- Track semantic drift
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(entity_id, version)
);

-- Embedding queue (async job processing)
CREATE TABLE embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages (for chat-to-graph feature + context memory)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  embedding vector(1536),  -- For RAG-based chat context
  metadata JSONB DEFAULT '{}'::jsonb,  -- {workflowGenerated: bool, nodeCount: int, etc.}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_workspace ON chat_messages(workspace_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_embedding ON chat_messages USING ivfflat(embedding vector_cosine_ops) WITH (lists = 50);

-- Triggers: Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_updated_at BEFORE UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON workflows
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Triggers: Auto-extract name from JSONB
CREATE OR REPLACE FUNCTION extract_entity_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name = NEW.data->>'name';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_extract_name BEFORE INSERT OR UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION extract_entity_name();
```

### Prisma Schema (prisma/schema.prisma)

See Assessment.md Appendix A for full schema. Key models:
- `User`, `Workspace`, `Entity`, `Workflow`, `EntityVersion`, `ChatMessage`
- Use `Unsupported("vector(1536)")` for embedding columns (Prisma doesn't natively support vector types)
- All queries with vector operations use `$queryRaw` with type annotations

---

## API Endpoints

### Authentication

All endpoints require `Authorization: Bearer <JWT>` header (except `/auth/callback`).

**Middleware:**
```javascript
// middleware/auth.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = user;
  next();
}
```

### Entities

**POST /api/entities**
```javascript
// Create entity
Body: {
  workspaceId: "uuid",
  type: "creature" | "encounter" | ...,
  data: { name: "...", description: "...", ... }
}

Response: { id: "uuid", name: "...", createdAt: "...", embedding: null }

Side effect: Enqueues embedding job in embedding_queue
```

**GET /api/entities**
```javascript
// List entities with filters
Query params:
  ?workspaceId=uuid (required)
  &type=creature (optional)
  &search=dragon (optional, searches name + full-text in JSONB)
  &limit=50 (optional, default 50)
  &offset=0 (optional, for pagination)

Response: {
  entities: [{ id, type, name, data, createdAt, updatedAt }],
  total: 123
}
```

**GET /api/entities/:id**
```javascript
// Get single entity
Response: { id, type, name, data, embedding, createdAt, updatedAt, versions: [...] }
```

**PUT /api/entities/:id**
```javascript
// Update entity
Body: { data: { name: "...", ... } }

Response: { id, updatedAt }

Side effects:
  - Creates entity_version record
  - Re-enqueues embedding job (data changed)
```

**DELETE /api/entities/:id**
```javascript
// Delete entity (hard delete, cascades to versions)
Response: { success: true }
```

**GET /api/entities/similar**
```javascript
// Vector search (semantic similarity)
Query params:
  ?query=psychic+aquatic+creatures (natural language query)
  &workspaceId=uuid
  &type=creature (optional, filter by type)
  &limit=10

Response: {
  results: [
    { id, name, type, data, similarity: 0.87 },
    { id, name, type, data, similarity: 0.82 },
    ...
  ]
}

Implementation:
  1. Embed query via OpenAI
  2. Cosine similarity search: 1 - (embedding <=> query_embedding)
  3. Order by similarity DESC
```

### Workflows

**POST /api/workflows**
```javascript
// Save workflow (canvas state)
Body: {
  workspaceId: "uuid",
  name: "My Dungeon Workflow",
  data: { nodes: [...], connections: [...], contextPrompts: {...}, ... }
}

Response: { id, createdAt }
```

**GET /api/workflows**
```javascript
// List workflows
Query: ?workspaceId=uuid

Response: {
  workflows: [{ id, name, updatedAt }]
}
```

**GET /api/workflows/:id**
```javascript
// Load workflow
Response: { id, name, data, updatedAt }
```

**PUT /api/workflows/:id**
```javascript
// Update workflow
Body: { name: "...", data: {...} }

Response: { id, updatedAt }
```

### Chat (Workflow Generator)

**POST /api/chat/workflow**
```javascript
// Generate workflow from natural language
Body: {
  workspaceId: "uuid",
  message: "Create a haunted mansion adventure for level 5 party",
  provider: "anthropic" | "openai",  // Which LLM to use
  model: "claude-sonnet-4-5" | "gpt-4o"
}

Response: {
  workflow: {
    nodes: [
      { type: "dungeon", x: 100, y: 100, contextPrompt: "Gothic mansion, 3 floors, cursed artifacts" },
      { type: "creature", x: 300, y: 100, contextPrompt: "Ghost butler, CR 5, polite but deadly" },
      { type: "encounter", x: 500, y: 100, contextPrompt: "Ambush in dining hall, 3 ghosts + animated armor" }
    ],
    connections: [
      { source: 0, target: 1 },  // dungeon → creature
      { source: 0, target: 2 }   // dungeon → encounter
    ]
  },
  metadata: {
    promptTokens: 1234,
    completionTokens: 567,
    model: "claude-sonnet-4-5",
    costUsd: 0.045
  }
}

Implementation:
  1. Embed user message
  2. Vector search for similar entities (RAG context)
  3. Build LLM prompt with system instructions + RAG context + user message
  4. Call LLM (Anthropic/OpenAI)
  5. Parse JSON response (extract workflow graph)
  6. Save chat_message record with embedding
  7. Return workflow + metadata
```

**POST /api/chat/message**
```javascript
// General chat (not workflow-specific, for future conversational features)
Body: {
  workspaceId: "uuid",
  message: "What creatures have I created so far?",
  provider: "anthropic",
  model: "claude-sonnet-4-5"
}

Response: {
  reply: "You've created 23 creatures, including Red Dragon (CR 17), Ghost Butler (CR 5), ...",
  metadata: { ... }
}

Implementation: Similar to workflow generation, but RAG over entities/chat history
```

### Migration

**POST /api/migrate/import**
```javascript
// Import from window.storage JSON export
Body: {
  entities: [{ id, type, data, savedAt }, ...],
  workflow: { nodes: [...], ... },
  customNodes: { ... }
}

Response: {
  workspaceId: "uuid",
  entitiesImported: 123,
  workflowsImported: 1
}

Implementation:
  1. Create default workspace for user
  2. Bulk insert entities (prisma.entity.createMany)
  3. Enqueue embeddings for all entities
  4. Save workflow
  5. Return summary
```

---

## Embedding Pipeline

### Strategy

**On Entity Create/Update:**
1. **Insert entity with `embedding = NULL`** (don't block API response)
2. **Enqueue job in `embedding_queue`** table
3. **Background worker picks up job:**
   - Extract embeddable text: `${name} • ${description} • ${type} • ${personality} • ${theme}`
   - Call OpenAI API: `text-embedding-3-small` with 1536 dimensions
   - Update entity: `SET embedding = $1 WHERE id = $2`
   - Delete queue entry (or mark `status = 'completed'`)
4. **Retry on failure:** Max 3 attempts with exponential backoff

### Worker Implementation (workers/embedder.js)

```javascript
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getEmbeddableText(entity) {
  const parts = [
    entity.data.name,
    entity.data.description || entity.data.backstory,
    entity.type,
    entity.data.personality?.traits?.join(' '),
    entity.data.theme,
    entity.data.atmosphere
  ].filter(Boolean);
  
  return parts.join(' • ');
}

async function processQueue() {
  while (true) {
    // Fetch next pending job (with row lock to prevent concurrent processing)
    const [job] = await prisma.$queryRaw`
      SELECT * FROM embedding_queue
      WHERE status = 'pending' AND attempts < 3
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    
    if (!job) {
      await sleep(1000);  // No jobs, wait 1s
      continue;
    }
    
    try {
      // Mark as processing
      await prisma.$executeRaw`
        UPDATE embedding_queue
        SET status = 'processing'
        WHERE id = ${job.id}
      `;
      
      // Fetch entity
      const entity = await prisma.entity.findUnique({ where: { id: job.entity_id } });
      if (!entity) {
        await prisma.$executeRaw`DELETE FROM embedding_queue WHERE id = ${job.id}`;
        continue;
      }
      
      // Generate embedding
      const text = getEmbeddableText(entity);
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536
      });
      
      const embedding = response.data[0].embedding;
      
      // Update entity
      await prisma.$executeRaw`
        UPDATE entities
        SET embedding = ${embedding}::vector
        WHERE id = ${entity.id}
      `;
      
      // Delete job
      await prisma.$executeRaw`DELETE FROM embedding_queue WHERE id = ${job.id}`;
      
      console.log(`✅ Embedded entity ${entity.id} (${entity.name})`);
    } catch (error) {
      console.error(`❌ Failed to embed entity ${job.entity_id}:`, error.message);
      
      // Increment attempts, mark failed if max reached
      await prisma.$executeRaw`
        UPDATE embedding_queue
        SET 
          attempts = attempts + 1,
          last_error = ${error.message},
          status = CASE WHEN attempts >= 2 THEN 'failed' ELSE 'pending' END
        WHERE id = ${job.id}
      `;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker
processQueue().catch(console.error);
```

**Deployment:**
- Railway: Add background worker as separate service (no HTTP port)
- Uptime: Use Railway health checks or external cron (Uptime Robot)

---

## Chat Workflow Generator (RAG + LLM Orchestration)

### Prompt Engineering

**System Prompt:**
```
You are a D&D 5e campaign designer for Entity Forge.

Generate a node graph JSON that represents a workflow for creating entities.

Output JSON schema:
{
  "nodes": [
    {
      "type": "creature" | "encounter" | "dungeon" | "location" | "trap" | "faction" | "loot" | "roll_table",
      "x": number (canvas position, 100-800),
      "y": number (canvas position, 100-600),
      "contextPrompt": "string (SPECIFIC generation instruction, not generic)"
    }
  ],
  "connections": [
    { "source": number (node array index), "target": number }
  ]
}

Constraints:
- 3-8 nodes (too few = shallow, too many = overwhelming)
- Logical flow (dungeon → creatures → encounters → traps)
- SPECIFIC prompts: not "a creature" but "spectral butler, CR 5, polite but deadly"
- Grid layout: space nodes horizontally by 200px, vertically by 150px
- Connections must form a DAG (no cycles)

Example:
{
  "nodes": [
    { "type": "dungeon", "x": 100, "y": 100, "contextPrompt": "Gothic mansion, 3 floors, cursed by a lich 100 years ago" },
    { "type": "creature", "x": 300, "y": 100, "contextPrompt": "Ghost butler, CR 5, spectral, polite but deadly, serves tea" },
    { "type": "encounter", "x": 500, "y": 100, "contextPrompt": "Ambush in dining hall: 3 ghosts + 1 animated armor, initiative order matters" }
  ],
  "connections": [
    { "source": 0, "target": 1 },
    { "source": 0, "target": 2 }
  ]
}
```

**RAG Context Injection:**
```javascript
// Fetch similar entities from vector DB
const queryEmbedding = await getEmbedding(userMessage);

const similarEntities = await prisma.$queryRaw`
  SELECT id, type, name, data,
    1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
  FROM entities
  WHERE workspace_id = ${workspaceId}
    AND embedding IS NOT NULL
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT 10
`;

// Build RAG context (inject into prompt)
const ragContext = similarEntities
  .map(e => `- ${e.type}: "${e.name}" — ${e.data.description?.slice(0, 100)}`)
  .join('\n');

const userPrompt = `User intent: "${userMessage}"

Similar existing content (for inspiration, maintain thematic coherence):
${ragContext}

Generate a workflow graph as JSON. Output ONLY valid JSON, no markdown or explanations.`;
```

**LLM Call (Anthropic Example):**
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  })
});

const { content, usage } = await response.json();

// Parse JSON (LLM might wrap in markdown code blocks)
const jsonMatch = content[0].text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error('LLM did not return valid JSON');
}

const workflow = JSON.parse(jsonMatch[0]);

// Validate schema (ensure nodes, connections exist)
if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
  throw new Error('Invalid workflow: missing nodes array');
}

return {
  workflow,
  metadata: {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    model: 'claude-sonnet-4-5',
    costUsd: (usage.input_tokens * 0.003 + usage.output_tokens * 0.015) / 1000
  }
};
```

### Frontend Integration

**Chat Sidebar Component:**
```javascript
// src/components/ChatSidebar.jsx
import { useState } from 'react';

export function ChatSidebar({ workspaceId, onWorkflowGenerated }) {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setHistory([...history, { role: 'user', content: message }]);
    setLoading(true);
    
    try {
      const response = await fetch('/api/chat/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          workspaceId,
          message,
          provider: 'anthropic',
          model: 'claude-sonnet-4-5'
        })
      });
      
      const { workflow, metadata } = await response.json();
      
      setHistory([...history, 
        { role: 'user', content: message },
        { role: 'assistant', content: `Generated workflow with ${workflow.nodes.length} nodes` }
      ]);
      
      // Pass to parent (EntityForge component)
      onWorkflowGenerated(workflow);
    } catch (error) {
      setHistory([...history, 
        { role: 'user', content: message },
        { role: 'assistant', content: `Error: ${error.message}` }
      ]);
    } finally {
      setLoading(false);
      setMessage('');
    }
  };
  
  return (
    <div className="chat-sidebar">
      <div className="chat-history">
        {history.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <div className="chat-input">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Describe your workflow..."
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
}
```

**Deserialize Workflow → Canvas State:**
```javascript
// In EntityForge.jsx
const handleWorkflowGenerated = (workflow) => {
  // Convert LLM JSON → Canvas state
  const newNodes = workflow.nodes.map((n, i) => ({
    id: genId(),  // Generate unique ID
    type: n.type,
    x: n.x,
    y: n.y,
    result: null  // Entity not generated yet
  }));
  
  setNodes(newNodes);
  
  // Map connections (convert array indexes to node IDs)
  const newConnections = workflow.connections.map(c => ({
    source: newNodes[c.source].id,
    target: newNodes[c.target].id
  }));
  
  setConnections(newConnections);
  
  // Set context prompts
  const newPrompts = {};
  workflow.nodes.forEach((n, i) => {
    newPrompts[newNodes[i].id] = n.contextPrompt;
  });
  
  setContextPrompts(newPrompts);
  
  // Clear roll results (workflow is fresh)
  setRollResults({});
  setLockedRolls({});
  
  // Save workflow to backend (optional, could wait for user to click "Save Workflow")
  saveWorkflowToBackend({
    name: `Chat Workflow ${new Date().toISOString().split('T')[0]}`,
    data: { nodes: newNodes, connections: newConnections, contextPrompts: newPrompts, rollResults: {}, lockedRolls: {} }
  });
};
```

---

## Migration Strategy

### Phase 1: Export (User-Triggered)

Add "Export All Data" button in settings:

```javascript
// src/components/Settings.jsx
async function exportLegacyData() {
  const entities = JSON.parse(
    (await window.storage.get('ef2-entities'))?.value || '[]'
  );
  const workflow = JSON.parse(
    (await window.storage.get('ef2-workflow'))?.value || '{}'
  );
  const customNodes = JSON.parse(
    (await window.storage.get('ef2-custom-nodes'))?.value || '{}'
  );
  
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entities,
    workflow,
    customNodes
  };
  
  // Download JSON
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `entityforge-backup-${Date.now()}.json`;
  a.click();
}
```

### Phase 2: Import (Backend)

**POST /api/migrate/import** (see API Endpoints above)

### Phase 3: Cutover

1. **Auth wall:** If user is not authenticated, show:
   - "Sign in to unlock cloud sync, semantic search, and collaboration"
   - "Continue with local storage (limited features)"
   - Most users should migrate within 1 week

2. **Deprecation notice (1 month):**
   - Banner: "Local storage is deprecated. Migrate your data by [date]."
   - After deadline: Remove window.storage fallback

3. **Cleanup:**
   - Remove all `window.storage.get/set` calls from codebase
   - Remove migration UI after 90% of users migrated

---

## Deployment

### Railway Setup

**1. Create Railway Project:**
```bash
railway login
railway init
railway add postgres  # Provisions PostgreSQL 15
railway add redis     # For BullMQ (optional: use Upstash instead)
```

**2. Configure Services:**

**.railway.toml:**
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "api"
port = 3000

[[services]]
name = "embedder"
startCommand = "node workers/embedder.js"
```

**3. Environment Variables (Railway Dashboard):**
```
DATABASE_URL=postgresql://...           # Auto-set by Railway
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
NODE_ENV=production
PORT=3000
```

**4. Deploy:**
```bash
railway up  # Deploys both api + embedder services
```

**5. Run Migrations:**
```bash
railway run npx prisma migrate deploy
railway run npx prisma db seed  # Optional: seed with example entities
```

### Vercel Frontend Deployment

**1. Install Vercel CLI:**
```bash
npm i -g vercel
```

**2. Configure Environment Variables:**

**vercel.json:**
```json
{
  "env": {
    "VITE_API_URL": "https://entityforge-api.railway.app",
    "VITE_SUPABASE_URL": "https://...supabase.co",
    "VITE_SUPABASE_ANON_KEY": "eyJhb..."
  }
}
```

**3. Deploy:**
```bash
vercel --prod
```

Frontend will be at `https://entity-forge.vercel.app`

---

## Testing Strategy

### Unit Tests (Vitest)

**tests/api/entities.test.js:**
```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('POST /api/entities', () => {
  let workspaceId, authToken;
  
  beforeEach(async () => {
    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: { name: 'Test Workspace', ownerId: 'test-user' }
    });
    workspaceId = workspace.id;
    
    // Mock auth token
    authToken = 'test-token-123';
  });
  
  afterEach(async () => {
    // Cleanup
    await prisma.entity.deleteMany({ where: { workspaceId } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });
  
  test('creates entity and enqueues embedding', async () => {
    const response = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        workspaceId,
        type: 'creature',
        data: { name: 'Red Dragon', description: 'Ancient wyrm' }
      });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Red Dragon');
    
    // Verify embedding queue entry
    const queue = await prisma.embeddingQueue.findFirst({
      where: { entityId: response.body.id }
    });
    
    expect(queue).toBeTruthy();
    expect(queue.status).toBe('pending');
  });
});
```

### Integration Tests (Playwright)

**tests/e2e/workflow.spec.js:**
```javascript
import { test, expect } from '@playwright/test';

test('user can chat → generate workflow → forge entities', async ({ page }) => {
  // Sign in (mocked or real Supabase auth)
  await page.goto('http://localhost:5173');
  await page.click('[data-testid="sign-in"]');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button:has-text("Sign In")');
  
  // Wait for auth redirect
  await page.waitForURL('http://localhost:5173/canvas');
  
  // Open chat sidebar
  await page.click('[data-testid="chat-toggle"]');
  
  // Send chat message
  await page.fill('[data-testid="chat-input"]', 'Create a haunted mansion adventure');
  await page.press('[data-testid="chat-input"]', 'Enter');
  
  // Wait for workflow generation
  await page.waitForSelector('[data-testid="node-dungeon"]', { timeout: 10000 });
  
  // Verify nodes appeared
  const nodes = await page.locator('[data-testid^="node-"]').count();
  expect(nodes).toBeGreaterThan(2);
  
  // Click "Forge All" button
  await page.click('[data-testid="forge-all"]');
  
  // Wait for all entities to generate
  await page.waitForSelector('[data-testid="node-result"]', { timeout: 30000 });
  
  // Verify entity was generated
  const entityName = await page.locator('[data-testid="entity-name"]').first().textContent();
  expect(entityName).toBeTruthy();
});
```

---

## Success Metrics

### Phase 1 (Backend MVP)
- [ ] All CRUD endpoints working (entities, workflows)
- [ ] Auth middleware validates JWT correctly
- [ ] Migration imports 100% of window.storage entities
- [ ] Frontend successfully calls backend APIs (no window.storage fallback)
- [ ] Deployed to Railway + Vercel (live at public URLs)

### Phase 2 (Embeddings)
- [ ] Embedding worker processes queue within 1 minute
- [ ] Vector search returns relevant results (manual verification)
- [ ] Similarity scores > 0.7 for "obviously similar" entities
- [ ] Cost < $0.05 for 1000 entity embeddings

### Phase 3 (Chat)
- [ ] Chat generates valid workflow JSON 90%+ of the time
- [ ] RAG context injection improves coherence (A/B test: with/without RAG)
- [ ] Graph deserialization correctly populates canvas
- [ ] Users can edit prompts and regenerate nodes

### Phase 4 (Collaboration, Optional)
- [ ] Two users can edit same workspace simultaneously
- [ ] Real-time sync latency < 500ms
- [ ] No race conditions (last-write-wins or CRDT)

---

## Risks & Mitigation

### Risk 1: LLM JSON Parsing Failures
**Issue:** LLM returns invalid JSON or wraps in markdown  
**Mitigation:**
- System prompt: "Output ONLY valid JSON, no markdown"
- Retry up to 3 times with error feedback
- Fallback: Show error + let user paste JSON manually

### Risk 2: Vector Search Low Quality
**Issue:** Similarity scores don't match user expectations  
**Mitigation:**
- Tune embeddable text extraction (include more/less context)
- Experiment with dimensionality (1536 vs 512)
- Add manual relevance feedback ("Was this result helpful? Yes/No")

### Risk 3: Embedding Costs Explode
**Issue:** User generates 10,000 entities → $0.40 in OpenAI costs  
**Mitigation:**
- Rate limit: Max 100 entities/day per user (free tier)
- Batch embeddings: 2048 texts/request (saves HTTP overhead)
- Cache embeddings: Don't re-embed if `data` hasn't changed

### Risk 4: Migration Data Loss
**Issue:** User exports from window.storage, import fails, data gone  
**Mitigation:**
- Keep window.storage data for 30 days after import
- Add "Export to JSON" button (manual backup)
- Validate import before deleting old data

---

## Future Enhancements (Post-MVP)

### Phase 5: Advanced Features
- **Voice input:** Whisper API for chat dictation
- **Image generation:** DALL-E for creature portraits
- **PDF export:** Generate campaign PDFs with LaTeX
- **API webhooks:** Trigger workflows from external tools
- **Marketplace:** Public template library with upvotes/comments

### Phase 6: Enterprise Features
- **SSO:** SAML/OIDC for company auth
- **Audit logs:** Track who changed what, when
- **RBAC:** Fine-grained permissions (per-entity access control)
- **On-premise:** Docker Compose for self-hosted deployments

---

## Appendix: Development Checklist

### Week 1: Backend Foundation
- [ ] Initialize Node.js project (`npm init -y`)
- [ ] Install dependencies: `express prisma @prisma/client pg dotenv`
- [ ] Configure Prisma (`npx prisma init`)
- [ ] Copy database schema (from this PRD)
- [ ] Run migrations (`npx prisma migrate dev --name init`)
- [ ] Create Express server (`src/server.js`)
- [ ] Add auth middleware (`middleware/auth.js`)
- [ ] Implement CRUD endpoints (entities, workflows)
- [ ] Test with Postman/Thunder Client
- [ ] Deploy to Railway (`railway up`)

### Week 2: Frontend Integration
- [ ] Create API client (`src/lib/api.js`)
- [ ] Replace window.storage calls with fetch
- [ ] Add Supabase Auth to frontend
- [ ] Build migration UI (export/import buttons)
- [ ] Test full flow: Auth → Create entity → List entities
- [ ] Deploy frontend to Vercel
- [ ] Smoke test production (create entity via live URL)

### Week 3: Embeddings
- [ ] Install pgvector in Railway Postgres
- [ ] Create embedding worker (`workers/embedder.js`)
- [ ] Add OpenAI API integration
- [ ] Test embedding generation (single entity)
- [ ] Deploy worker to Railway (background service)
- [ ] Build vector search endpoint (`/api/entities/similar`)
- [ ] Add "Similar Entities" panel to frontend
- [ ] Test semantic search (verify results make sense)

### Week 4: Chat Interface
- [ ] Build chat sidebar component (`src/components/ChatSidebar.jsx`)
- [ ] Create workflow generation endpoint (`/api/chat/workflow`)
- [ ] Implement RAG context injection
- [ ] Test LLM prompt (manually verify JSON quality)
- [ ] Add graph deserialization logic
- [ ] Test full flow: Chat → Workflow → Forge entities
- [ ] Polish UI (loading states, error handling)

### Week 5: Polish + Launch
- [ ] Write integration tests (Playwright)
- [ ] Load test with k6 (simulate 50 concurrent users)
- [ ] Performance tuning (add database indexes, optimize queries)
- [ ] Documentation (README, API docs, architecture diagrams)
- [ ] Beta test with 10 users (collect feedback)
- [ ] Fix bugs, iterate on UX
- [ ] Public launch 🚀

---

**End of PRD**

This document is a living spec. Update as requirements evolve.

**Questions?** Ping Atticus (@AnabolicHippo on GitHub)
