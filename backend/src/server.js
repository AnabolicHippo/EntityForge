import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import { Prisma, PrismaClient } from '@prisma/client';

import { verifyToken } from '../middleware/auth.js';

const app = express();
const prisma = new PrismaClient();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ENTITY_TYPES = [
  'creature',
  'encounter',
  'dungeon',
  'location',
  'trap',
  'faction',
  'loot',
  'roll_table'
];

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    corsOrigins.length > 0
      ? {
          origin: corsOrigins,
          credentials: true
        }
      : {
          origin: true,
          credentials: true
        }
  )
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', verifyToken);

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function ensureUserExists(authUser) {
  if (!authUser?.id || !authUser?.email) {
    throw new Error('Authenticated user payload missing id/email');
  }

  await prisma.user.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null
    },
    update: {
      email: authUser.email,
      name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null
    }
  });
}

async function getWorkspaceForOwner(workspaceId, userId) {
  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      ownerId: userId
    },
    select: { id: true }
  });
}

async function requireWorkspaceAccess(req, res, workspaceId) {
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return null;
  }

  await ensureUserExists(req.user);

  const workspace = await getWorkspaceForOwner(workspaceId, req.user.id);
  if (!workspace) {
    res.status(403).json({ error: 'Workspace access denied' });
    return null;
  }

  return workspace;
}

async function embedQueryText(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input,
      dimensions: 1536
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload?.data?.[0]?.embedding;
}

app.post(
  '/api/entities',
  asyncHandler(async (req, res) => {
    const { workspaceId, type, data } = req.body || {};

    if (!workspaceId || !type || !isObject(data)) {
      return res.status(400).json({
        error: 'workspaceId, type, and data object are required'
      });
    }

    if (!ENTITY_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const workspace = await requireWorkspaceAccess(req, res, workspaceId);
    if (!workspace) return;

    const entity = await prisma.entity.create({
      data: {
        workspaceId: workspace.id,
        type,
        name: typeof data.name === 'string' ? data.name : null,
        data,
        createdBy: req.user.id
      },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    await prisma.embeddingQueue.create({
      data: {
        entityId: entity.id,
        status: 'pending'
      }
    });

    res.status(201).json({
      id: entity.id,
      name: entity.name,
      createdAt: entity.createdAt,
      embedding: null
    });
  })
);

app.get(
  '/api/entities',
  asyncHandler(async (req, res) => {
    const workspaceId = req.query.workspaceId;
    const type = req.query.type;
    const search = req.query.search;
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0);

    if (typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    if (typeof type === 'string' && !ENTITY_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid entity type filter' });
    }

    const workspace = await requireWorkspaceAccess(req, res, workspaceId);
    if (!workspace) return;

    const conditions = [Prisma.sql`e.workspace_id = ${workspace.id}`];

    if (typeof type === 'string') {
      conditions.push(Prisma.sql`e.type = ${type}::"EntityType"`);
    }

    if (typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(Prisma.sql`(e.name ILIKE ${term} OR e.data::text ILIKE ${term})`);
    }

    const whereSql = Prisma.join(conditions, ' AND ');

    const entities = await prisma.$queryRaw`
      SELECT
        e.id,
        e.type,
        e.name,
        e.data,
        e.created_at AS "createdAt",
        e.updated_at AS "updatedAt"
      FROM entities e
      WHERE ${whereSql}
      ORDER BY e.updated_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [countRow] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total
      FROM entities e
      WHERE ${whereSql}
    `;

    res.json({
      entities,
      total: countRow?.total ?? 0
    });
  })
);

app.get(
  '/api/entities/similar',
  asyncHandler(async (req, res) => {
    const workspaceId = req.query.workspaceId;
    const query = req.query.query;
    const type = req.query.type;
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), MAX_LIMIT);

    if (typeof workspaceId !== 'string' || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'workspaceId and query are required' });
    }

    if (typeof type === 'string' && !ENTITY_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid entity type filter' });
    }

    const workspace = await requireWorkspaceAccess(req, res, workspaceId);
    if (!workspace) return;

    const queryEmbedding = await embedQueryText(query.trim());
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return res.status(502).json({ error: 'Failed to generate query embedding' });
    }

    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const filters = [
      Prisma.sql`e.workspace_id = ${workspace.id}`,
      Prisma.sql`e.embedding IS NOT NULL`
    ];

    if (typeof type === 'string') {
      filters.push(Prisma.sql`e.type = ${type}::"EntityType"`);
    }

    const whereSql = Prisma.join(filters, ' AND ');

    const results = await prisma.$queryRaw`
      SELECT
        e.id,
        e.name,
        e.type,
        e.data,
        1 - (e.embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM entities e
      WHERE ${whereSql}
      ORDER BY e.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

    res.json({ results });
  })
);

app.get(
  '/api/entities/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        workspace: { select: { ownerId: true } },
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            data: true,
            createdAt: true,
            createdBy: true
          }
        }
      }
    });

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    await ensureUserExists(req.user);

    if (entity.workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Entity access denied' });
    }

    res.json({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      data: entity.data,
      embedding: entity.embedding ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      versions: entity.versions
    });
  })
);

app.put(
  '/api/entities/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data } = req.body || {};

    if (!isObject(data)) {
      return res.status(400).json({ error: 'data object is required' });
    }

    const existing = await prisma.entity.findUnique({
      where: { id },
      include: {
        workspace: { select: { ownerId: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    await ensureUserExists(req.user);

    if (existing.workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Entity access denied' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const previousVersion = await tx.entityVersion.findFirst({
        where: { entityId: existing.id },
        orderBy: { version: 'desc' },
        select: { version: true }
      });

      const nextVersion = (previousVersion?.version ?? 0) + 1;

      await tx.entityVersion.create({
        data: {
          entityId: existing.id,
          version: nextVersion,
          data: existing.data,
          createdBy: req.user.id
        }
      });

      const entity = await tx.entity.update({
        where: { id: existing.id },
        data: {
          data,
          name: typeof data.name === 'string' ? data.name : null
        },
        select: {
          id: true,
          updatedAt: true
        }
      });

      await tx.embeddingQueue.create({
        data: {
          entityId: existing.id,
          status: 'pending'
        }
      });

      return entity;
    });

    res.json(updated);
  })
);

app.delete(
  '/api/entities/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        workspace: { select: { ownerId: true } }
      }
    });

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    await ensureUserExists(req.user);

    if (entity.workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Entity access denied' });
    }

    await prisma.entity.delete({ where: { id } });

    res.json({ success: true });
  })
);

app.post(
  '/api/workflows',
  asyncHandler(async (req, res) => {
    const { workspaceId, name, data } = req.body || {};

    if (!workspaceId || typeof name !== 'string' || !name.trim() || !isObject(data)) {
      return res.status(400).json({
        error: 'workspaceId, non-empty name, and data object are required'
      });
    }

    const workspace = await requireWorkspaceAccess(req, res, workspaceId);
    if (!workspace) return;

    const workflow = await prisma.workflow.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        data,
        createdBy: req.user.id
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    res.status(201).json(workflow);
  })
);

app.get(
  '/api/workflows',
  asyncHandler(async (req, res) => {
    const workspaceId = req.query.workspaceId;

    if (typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    const workspace = await requireWorkspaceAccess(req, res, workspaceId);
    if (!workspace) return;

    const workflows = await prisma.workflow.findMany({
      where: {
        workspaceId: workspace.id
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        updatedAt: true
      }
    });

    res.json({ workflows });
  })
);

app.get(
  '/api/workflows/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        workspace: { select: { ownerId: true } }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await ensureUserExists(req.user);

    if (workflow.workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Workflow access denied' });
    }

    res.json({
      id: workflow.id,
      name: workflow.name,
      data: workflow.data,
      updatedAt: workflow.updatedAt
    });
  })
);

app.put(
  '/api/workflows/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, data } = req.body || {};

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be a non-empty string when provided' });
    }

    if (data !== undefined && !isObject(data)) {
      return res.status(400).json({ error: 'data must be an object when provided' });
    }

    if (name === undefined && data === undefined) {
      return res.status(400).json({ error: 'Provide at least one field to update: name or data' });
    }

    const existing = await prisma.workflow.findUnique({
      where: { id },
      include: {
        workspace: { select: { ownerId: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await ensureUserExists(req.user);

    if (existing.workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Workflow access denied' });
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(data !== undefined ? { data } : {})
      },
      select: {
        id: true,
        updatedAt: true
      }
    });

    res.json(updated);
  })
);

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: error.message });
  }

  if (typeof error?.message === 'string' && error.message.includes('OPENAI_API_KEY')) {
    return res.status(503).json({ error: 'Vector search unavailable: OPENAI_API_KEY is not configured' });
  }

  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 3000;

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const server = app.listen(port, () => {
    console.log(`Entity Forge backend listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
