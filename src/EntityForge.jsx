import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════
// DICE ENGINE
// ═══════════════════════════════════════════════════════════
function rollDice(notation) {
  const match = notation.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return { total: 0, rolls: [], notation };
  const count = parseInt(match[1] || "1");
  const sides = parseInt(match[2]);
  const mod = parseInt(match[3] || "0");
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
  return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, notation };
}

function resolveRollTable(table) {
  const roll = rollDice(table.dice);
  const entry = table.entries.find(
    (e) => roll.total >= e.range_min && roll.total <= e.range_max
  );
  return { roll, entry: entry || { result: "No matching entry" }, table: table.name };
}

// ═══════════════════════════════════════════════════════════
// SRD 5.1 RULESET
// ═══════════════════════════════════════════════════════════
const SRD_RULESET = {
  id: "dnd5e-srd",
  name: "D&D 5e SRD 5.1",
  version: "5.1",
  license: "CC-BY-4.0",
  reference: {
    sizes: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"],
    creature_types: ["Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental", "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"],
    alignments: ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned"],
    damage_types: ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"],
    conditions: ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"],
    skills: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"],
    abilities: ["str", "dex", "con", "int", "wis", "cha"],
    hit_dice_by_size: { Tiny: "d4", Small: "d6", Medium: "d8", Large: "d10", Huge: "d12", Gargantuan: "d20" },
    cr_xp: {
      "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
      "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000,
      "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
      "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000,
      "28": 120000, "29": 135000, "30": 155000
    },
    item_rarities: ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"],
    item_categories: ["weapon", "armor", "potion", "ring", "rod", "scroll", "staff", "wand", "wondrous", "mundane"],
  },
};

// ═══════════════════════════════════════════════════════════
// SRD ENTITY TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════
const CORE_ENTITY_TYPES = {
  creature: {
    id: "creature",
    name: "Creature",
    icon: "🐉",
    color: "#C44536",
    accent: "#E8785F",
    description: "SRD stat block — monster, NPC, boss, or companion",
    acceptsInputs: ["loot", "roll_table"],
    schema: {
      name: "string", role: "enum: monster|npc|boss|minion|companion",
      size: "enum: SRD sizes", type: "enum: SRD creature types", subtype: "string?",
      alignment: "enum: SRD alignments",
      armor_class: "{ value: number, type: string }",
      hit_points: "{ average: number, formula: string (SRD Hit Dice by size) }",
      speed: "{ walk, fly?, swim?, climb?, burrow? } in feet",
      ability_scores: "{ str, dex, con, int, wis, cha } range 1-30",
      saving_throws: "{ [ability]: modifier }?",
      skills: "{ [skill]: modifier }?",
      vulnerabilities: "string[] (SRD damage types)",
      resistances: "string[]", immunities: "string[]",
      senses: "{ darkvision?, blindsight?, tremorsense?, truesight?, passive_perception }",
      languages: "string[]", challenge_rating: "string (CR 0-30)",
      proficiency_bonus: "number (derived from CR)",
      traits: "{ name, description }[]", actions: "{ name, description, attack_bonus?, damage? }[]",
      bonus_actions: "{ name, description }[]?", reactions: "{ name, description, trigger }[]?",
      legendary_actions: "{ name, description, cost }[]? (boss role)",
      lair_actions: "{ description, initiative_count }[]? (boss role)",
      spellcasting: "{ ability, dc, attack, slots?, spells[] }?",
      personality: "{ traits, ideals, bonds, flaws }? (NPC/boss)",
      backstory: "string? (NPC/boss)", appearance: "string?", equipment: "string[]?",
    },
  },
  encounter: {
    id: "encounter",
    name: "Encounter",
    icon: "⚔️",
    color: "#D4A843",
    accent: "#F0D080",
    description: "SRD encounter — combat, social, exploration, or puzzle",
    acceptsInputs: ["creature", "location", "trap", "loot", "roll_table"],
    schema: {
      name: "string", type: "enum: combat|social|exploration|puzzle|trap|mixed",
      difficulty: "enum: easy|medium|hard|deadly (SRD thresholds)",
      party_level: "number", party_size: "number (default 4)",
      description: "string (read-aloud text)",
      environment: "{ terrain, lighting, weather, special_features }",
      creatures: "{ creature_ref, count, placement, tactics }[]",
      objectives: "{ primary, secondary?, hidden? }",
      complications: "string[]",
      xp_budget: "{ base_xp, multiplier, adjusted_xp }",
      rewards: "{ xp, gold_range, items[], story_rewards[] }",
      scaling: "{ easier, harder }", aftermath: "string",
    },
  },
  dungeon: {
    id: "dungeon",
    name: "Dungeon",
    icon: "🏰",
    color: "#6B5B95",
    accent: "#A094C7",
    description: "Multi-room environment with encounters, traps, and treasure",
    acceptsInputs: ["creature", "encounter", "trap", "loot", "roll_table"],
    schema: {
      name: "string", theme: "string", level_range: "string (e.g., 3-5)",
      backstory: "string",
      rooms: "{ id, name, description, dimensions, exits[], contents, encounter_ref?, trap_ref?, lighting }[]",
      entry_points: "string[] (room IDs)", boss_room: "string (room ID)",
      wandering_monsters: "{ creature_ref, frequency, patrol_route }[]",
      environmental_hazards: "{ type, location, effect, dc, damage }[]",
      treasure_hoard: "{ coins, gems, art, magic_items } (SRD tables by CR)",
      secrets: "{ location, detection_dc, description, reward }[]",
      hooks: "string[]",
    },
  },
  location: {
    id: "location",
    name: "Location",
    icon: "🗺️",
    color: "#3D7EA6",
    accent: "#6CB4D9",
    description: "Settlement, wilderness, ruin, or point of interest",
    acceptsInputs: ["creature", "dungeon", "faction", "roll_table"],
    schema: {
      name: "string", type: "enum: city|town|village|hamlet|wilderness|ruin|landmark|planar",
      region: "string", population: "{ count, demographics }",
      government: "string", economy: "string",
      description: "string (2-3 paragraphs, sensory)", atmosphere: "string",
      points_of_interest: "{ name, type, description, npc_ref? }[]",
      factions_present: "{ faction_ref, influence, goals_here }[]",
      rumors: "{ text, truth_value, source }[]",
      dangers: "string[]", history: "string", hooks: "string[]",
    },
  },
  trap: {
    id: "trap",
    name: "Trap",
    icon: "🪤",
    color: "#B5651D",
    accent: "#D9A066",
    description: "SRD trap — mechanical, magical, or natural hazard",
    acceptsInputs: ["roll_table"],
    schema: {
      name: "string", type: "enum: mechanical|magical|natural|hybrid",
      severity: "enum: setback|dangerous|deadly (SRD severity)",
      trigger: "string", effect: "string",
      damage: "{ dice, type, average } (SRD severity table)",
      save: "{ ability, dc } (SRD trap DC table)",
      attack_bonus: "number? (SRD trap attack table)",
      detection: "{ skill, dc }", disarm: "{ skill, dc, tools_required? }",
      countermeasures: "string[]", reset: "enum: automatic|manual|one_shot",
      area: "string", location_context: "string",
    },
  },
  faction: {
    id: "faction",
    name: "Faction",
    icon: "🏛️",
    color: "#4A6741",
    accent: "#7DA874",
    description: "Organization with hierarchy, goals, and influence",
    acceptsInputs: ["creature", "location", "roll_table"],
    schema: {
      name: "string",
      type: "enum: guild|cult|government|military|mercenary|religious|criminal|arcane|noble_house",
      alignment_tendency: "string", motto: "string", description: "string",
      goals: "{ goal, priority, progress }[]", methods: "string[]",
      hierarchy: "{ rank, title, responsibilities, npc_ref? }[]",
      resources: "{ type, description, quantity }[]",
      headquarters: "{ name, location_ref?, description }",
      territory: "string[]",
      allies: "{ name, relationship }[]", enemies: "{ name, relationship }[]",
      secrets: "string[]", joining: "{ requirements, process, benefits }",
      reputation: "string",
    },
  },
  loot: {
    id: "loot",
    name: "Loot",
    icon: "💎",
    color: "#C9A227",
    accent: "#E8D06F",
    description: "SRD magic item or treasure with rarity and properties",
    acceptsInputs: ["roll_table"],
    schema: {
      name: "string",
      category: "enum: weapon|armor|potion|ring|rod|scroll|staff|wand|wondrous|mundane",
      rarity: "enum: common|uncommon|rare|very_rare|legendary|artifact (SRD)",
      attunement: "{ required: boolean, requirements?: string }",
      description: "string", properties: "string[]",
      charges: "{ max, recharge }?", cursed: "{ description, removal }?",
      lore: "string", value: "{ gp, rarity_range }",
      weight: "number?", source_context: "string?",
    },
  },
  roll_table: {
    id: "roll_table",
    name: "Roll Table",
    icon: "🎲",
    color: "#9B59B6",
    accent: "#C39BD3",
    description: "Randomized input — dice-driven results feeding other nodes",
    acceptsInputs: [],
    schema: {
      name: "string", dice: "string (e.g., d20, 2d6, d100)",
      entries: "{ range_min, range_max, result, weight? }[]",
      tags: "string[]", reroll_duplicates: "boolean",
      cascade: "boolean", source: "string",
    },
    isSource: true,
  },
};

// ═══════════════════════════════════════════════════════════
// SRD PRE-LOADED ROLL TABLES
// ═══════════════════════════════════════════════════════════
const SRD_ROLL_TABLES = [
  {
    name: "NPC Appearance",
    dice: "d20",
    entries: [
      { range_min: 1, range_max: 1, result: "Distinctive jewelry (earring, bracelet, necklace)" },
      { range_min: 2, range_max: 2, result: "Piercings" },
      { range_min: 3, range_max: 3, result: "Flamboyant or outlandish clothes" },
      { range_min: 4, range_max: 4, result: "Formal, clean clothes" },
      { range_min: 5, range_max: 5, result: "Ragged, dirty clothes" },
      { range_min: 6, range_max: 6, result: "Pronounced scar" },
      { range_min: 7, range_max: 7, result: "Missing teeth" },
      { range_min: 8, range_max: 8, result: "Missing fingers" },
      { range_min: 9, range_max: 9, result: "Unusual eye color or shape" },
      { range_min: 10, range_max: 10, result: "Tattoos" },
      { range_min: 11, range_max: 11, result: "Birthmark" },
      { range_min: 12, range_max: 12, result: "Unusual skin color" },
      { range_min: 13, range_max: 13, result: "Bald" },
      { range_min: 14, range_max: 14, result: "Braided beard or hair" },
      { range_min: 15, range_max: 15, result: "Unusual hair color" },
      { range_min: 16, range_max: 16, result: "Nervous eye twitch" },
      { range_min: 17, range_max: 17, result: "Distinctive nose" },
      { range_min: 18, range_max: 18, result: "Distinctive posture (crooked or rigid)" },
      { range_min: 19, range_max: 19, result: "Exceptionally beautiful" },
      { range_min: 20, range_max: 20, result: "Exceptionally ugly" },
    ],
    tags: ["npc", "appearance", "srd"],
    source: "SRD 5.1 - NPC Characteristics",
  },
  {
    name: "NPC Interaction Trait",
    dice: "d12",
    entries: [
      { range_min: 1, range_max: 1, result: "Argumentative" },
      { range_min: 2, range_max: 2, result: "Arrogant" },
      { range_min: 3, range_max: 3, result: "Blustering" },
      { range_min: 4, range_max: 4, result: "Rude" },
      { range_min: 5, range_max: 5, result: "Curious" },
      { range_min: 6, range_max: 6, result: "Friendly" },
      { range_min: 7, range_max: 7, result: "Honest" },
      { range_min: 8, range_max: 8, result: "Hot tempered" },
      { range_min: 9, range_max: 9, result: "Irritable" },
      { range_min: 10, range_max: 10, result: "Ponderous" },
      { range_min: 11, range_max: 11, result: "Quiet" },
      { range_min: 12, range_max: 12, result: "Suspicious" },
    ],
    tags: ["npc", "personality", "srd"],
    source: "SRD 5.1 - NPC Characteristics",
  },
  {
    name: "Dungeon Noises",
    dice: "d12",
    entries: [
      { range_min: 1, range_max: 1, result: "Bang or slam" },
      { range_min: 2, range_max: 2, result: "Buzzing" },
      { range_min: 3, range_max: 3, result: "Chanting" },
      { range_min: 4, range_max: 4, result: "Chiming" },
      { range_min: 5, range_max: 5, result: "Clanking" },
      { range_min: 6, range_max: 6, result: "Clashing" },
      { range_min: 7, range_max: 7, result: "Creaking" },
      { range_min: 8, range_max: 8, result: "Drumming" },
      { range_min: 9, range_max: 9, result: "Footsteps ahead" },
      { range_min: 10, range_max: 10, result: "Footsteps approaching" },
      { range_min: 11, range_max: 11, result: "Laughter" },
      { range_min: 12, range_max: 12, result: "Screaming" },
    ],
    tags: ["dungeon", "atmosphere", "srd"],
    source: "SRD 5.1 - Dungeon Dressing",
  },
];

const ANTHROPIC_MODELS = ["claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4"];
const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini"];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const genId = () => Math.random().toString(36).substr(2, 9);

function canConnect(sourceType, targetType, entityTypes) {
  const target = entityTypes[targetType];
  return target && target.acceptsInputs.includes(sourceType);
}

function topologicalSort(nodes, connections) {
  const adj = {}, inDeg = {};
  nodes.forEach((n) => { adj[n.id] = []; inDeg[n.id] = 0; });
  connections.forEach((c) => {
    adj[c.source] = adj[c.source] || [];
    adj[c.source].push(c.target);
    inDeg[c.target] = (inDeg[c.target] || 0) + 1;
  });
  const queue = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    (adj[cur] || []).forEach((next) => { inDeg[next]--; if (inDeg[next] === 0) queue.push(next); });
  }
  return order;
}

// ═══════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════
export default function EntityForge() {
  const [entityTypes, setEntityTypes] = useState(CORE_ENTITY_TYPES);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [generating, setGenerating] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState(null);
  const [showSchema, setShowSchema] = useState(null);
  const [savedEntities, setSavedEntities] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folderFilter, setFolderFilter] = useState("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#D4A843");
  const [panel, setPanel] = useState("palette");
  const [paletteTab, setPaletteTab] = useState("entities");
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [contextPrompts, setContextPrompts] = useState({});
  const [error, setError] = useState(null);
  const [orchMode, setOrchMode] = useState("sequential");
  const [orchPlan, setOrchPlan] = useState(null);
  const [rollResults, setRollResults] = useState({});
  const [lockedRolls, setLockedRolls] = useState({});
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customDraft, setCustomDraft] = useState({ name: "", icon: "⚙️", color: "#888888", accent: "#AAAAAA", description: "", acceptsInputs: [], schemaText: "" });
  const [showCustomAi, setShowCustomAi] = useState(false);
  const [customAiChat, setCustomAiChat] = useState([]);
  const [customAiInput, setCustomAiInput] = useState("");
  const [customAiGenerating, setCustomAiGenerating] = useState(false);
  const [ruleset, setRuleset] = useState("dnd5e-srd");
  const [orchChat, setOrchChat] = useState([]);
  const [orchInput, setOrchInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const canvasRef = useRef(null);
  const NODE_W = 200, NODE_H = 100;

  // Load saved state
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("ef2-entities");
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          const normalized = Array.isArray(parsed)
            ? parsed.map((ent) => ({ ...ent, folderIds: Array.isArray(ent.folderIds) ? ent.folderIds : [] }))
            : [];
          setSavedEntities(normalized);
        }
      } catch {}
      try {
        const r = await window.storage.get("ef2-folders");
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed)) {
            setFolders(parsed.filter((f) => f?.id && f?.name).map((f) => ({ id: String(f.id), name: String(f.name), color: f.color || "#D4A843" })));
          }
        }
      } catch {}
      try {
        const r = await window.storage.get("ef2-workflow");
        if (r?.value) {
          const wf = JSON.parse(r.value);
          if (wf.nodes) setNodes(wf.nodes);
          if (wf.connections) setConnections(wf.connections);
          if (wf.contextPrompts) setContextPrompts(wf.contextPrompts);
          if (wf.rollResults) setRollResults(wf.rollResults);
          if (wf.lockedRolls) setLockedRolls(wf.lockedRolls);
        }
      } catch {}
      try {
        const r = await window.storage.get("ef2-custom-nodes");
        if (r?.value) {
          const custom = JSON.parse(r.value);
          setEntityTypes((prev) => ({ ...prev, ...custom }));
        }
      } catch {}
      try {
        const r = await window.storage.get("ef2-anthropic-key");
        if (r?.value) setAnthropicApiKey(r.value);
      } catch {}
      try {
        const r = await window.storage.get("ef2-openai-key");
        if (r?.value) setOpenaiApiKey(r.value);
      } catch {}
      try {
        const r = await window.storage.get("ef2-api-provider");
        if (r?.value === "anthropic" || r?.value === "openai") setApiProvider(r.value);
      } catch {}
      try {
        const r = await window.storage.get("ef2-model");
        if (r?.value) setModel(r.value);
      } catch {}
    })();
  }, []);

  // Auto-save
  const saveWorkflow = useCallback(async () => {
    try { await window.storage.set("ef2-workflow", JSON.stringify({ nodes, connections, contextPrompts, rollResults, lockedRolls })); } catch {}
  }, [nodes, connections, contextPrompts, rollResults, lockedRolls]);
  useEffect(() => { const t = setTimeout(saveWorkflow, 1000); return () => clearTimeout(t); }, [saveWorkflow]);

  // ── Node operations ──
  const addNode = (typeId) => {
    if (!entityTypes[typeId]) {
      setError(`Unknown node type: ${typeId}`);
      return;
    }
    const cx = 300 + Math.random() * 200 - canvasOffset.x;
    const cy = 200 + Math.random() * 200 - canvasOffset.y;
    const node = { id: genId(), type: typeId, x: cx, y: cy, result: null };
    setNodes((prev) => [...prev, node]);
    // If roll table, pre-populate with empty table
    if (typeId === "roll_table") {
      setContextPrompts((prev) => ({ ...prev, [node.id]: "" }));
    }
  };

  const deleteNode = (nodeId) => {
    setNodes((p) => p.filter((n) => n.id !== nodeId));
    setConnections((p) => p.filter((c) => c.source !== nodeId && c.target !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
    setContextPrompts((p) => { const cp = { ...p }; delete cp[nodeId]; return cp; });
    setRollResults((p) => { const rr = { ...p }; delete rr[nodeId]; return rr; });
  };

  const startConnection = (nodeId, e) => { e.stopPropagation(); setConnecting(nodeId); };
  const endConnection = (nodeId, e) => {
    e.stopPropagation();
    if (connecting && connecting !== nodeId) {
      const src = nodes.find((n) => n.id === connecting);
      const tgt = nodes.find((n) => n.id === nodeId);
      if (src && tgt && canConnect(src.type, tgt.type, entityTypes)) {
        if (!connections.some((c) => c.source === connecting && c.target === nodeId)) {
          setConnections((p) => [...p, { id: genId(), source: connecting, target: nodeId }]);
        }
      }
    }
    setConnecting(null);
  };

  const removeConnection = (connId) => setConnections((p) => p.filter((c) => c.id !== connId));

  // ── Dragging & Panning ──
  const handleNodeMouseDown = (nodeId, e) => {
    if (e.target.closest(".port")) return;
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDragging(nodeId);
    setDragOffset({ x: e.clientX - (node.x + canvasOffset.x), y: e.clientY - (node.y + canvasOffset.y) });
    setSelectedNode(nodeId);
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.closest(".canvas-bg")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
      setSelectedNode(null);
      setConnecting(null);
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (dragging) setNodes((p) => p.map((n) => n.id === dragging ? { ...n, x: e.clientX - dragOffset.x - canvasOffset.x, y: e.clientY - dragOffset.y - canvasOffset.y } : n));
    if (isPanning) setCanvasOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [dragging, dragOffset, canvasOffset, isPanning, panStart]);

  const handleMouseUp = useCallback(() => { setDragging(null); setIsPanning(false); if (connecting) setConnecting(null); }, [connecting]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  // ── Roll Table Execution ──
  const executeRollTable = (nodeId) => {
    if (lockedRolls[nodeId]) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node?.result) return;
    const res = resolveRollTable(node.result);
    setRollResults((p) => ({ ...p, [nodeId]: res }));
  };

  const toggleLockRoll = (nodeId) => {
    setLockedRolls((p) => ({ ...p, [nodeId]: !p[nodeId] }));
  };

  const saveAnthropicKey = async () => {
    try { await window.storage.set("ef2-anthropic-key", anthropicApiKey.trim()); } catch {}
  };

  const clearAnthropicKey = async () => {
    setAnthropicApiKey("");
    try { await window.storage.set("ef2-anthropic-key", ""); } catch {}
  };

  const saveOpenaiKey = async () => {
    try { await window.storage.set("ef2-openai-key", openaiApiKey.trim()); } catch {}
  };

  const clearOpenaiKey = async () => {
    setOpenaiApiKey("");
    try { await window.storage.set("ef2-openai-key", ""); } catch {}
  };

  const persistProvider = async (nextProvider) => {
    setApiProvider(nextProvider);
    try { await window.storage.set("ef2-api-provider", nextProvider); } catch {}
  };

  const persistModel = async (nextModel) => {
    setModel(nextModel);
    try { await window.storage.set("ef2-model", nextModel); } catch {}
  };

  useEffect(() => {
    const modelOptions = apiProvider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;
    if (!modelOptions.includes(model)) {
      const fallback = modelOptions[0];
      setModel(fallback);
      window.storage.set("ef2-model", fallback).catch(() => {});
    }
  }, [apiProvider, model]);

  // ── LLM Generation ──
  const getActiveApiKey = () => (apiProvider === "openai" ? openaiApiKey : anthropicApiKey).trim();

  const ensureApiKeyConfigured = () => {
    if (getActiveApiKey()) return true;
    setError("API key required. Click ⚙️ to configure.");
    return false;
  };

  const mapApiError = (status) => {
    if (status === 401) return "Invalid API key";
    if (status === 429) return "Rate limited";
    if (status >= 500) return "API error";
    return "API error";
  };

  const normalizeLlmError = (err) => {
    const message = err?.message || "API error";
    if (message.includes("JSON parse error")) return message;
    if (message === "Invalid API response") return "JSON parse error in API response";
    if (message === "Network error") return "Network error";
    if (message === "Invalid API key" || message === "Rate limited" || message === "API error") return message;
    return message;
  };

  const buildOpenAIPrompt = (system, user) => [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const extractLlmText = (data, provider) => {
    if (provider === "anthropic") {
      return data.content?.map((b) => b.type === "text" ? b.text : "").join("") || "";
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map((c) => c?.text || "").join("");
    return "";
  };

  const parseJsonWithExcerpt = (rawText) => {
    if (!rawText) throw new Error("Empty response");
    const clean = rawText.replace(/```json\s*|```\s*/g, "").trim();
    if (!clean) throw new Error("Empty response");
    try {
      return JSON.parse(clean);
    } catch (err) {
      if (err instanceof SyntaxError) {
        const excerpt = clean.slice(0, 220).replace(/\s+/g, " ");
        throw new Error(`JSON parse error. LLM response excerpt: ${excerpt}${clean.length > 220 ? "..." : ""}`);
      }
      throw err;
    }
  };

  const callLlm = async ({ system, user, messages, maxTokens }) => {
    const provider = apiProvider;
    const apiKey = getActiveApiKey();
    if (!apiKey) throw new Error("API key required. Click ⚙️ to configure.");

    const parseApiJson = async (resp) => {
      try {
        return await resp.json();
      } catch (err) {
        if (err instanceof SyntaxError) throw new Error("Invalid API response");
        throw err;
      }
    };

    if (provider === "anthropic") {
      const anthropicModel = ANTHROPIC_MODELS.includes(model) ? model : ANTHROPIC_MODELS[0];
      let resp;
      try {
        resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: maxTokens,
            system,
            messages: messages || [{ role: "user", content: user }],
          }),
        });
      } catch {
        throw new Error("Network error");
      }
      if (!resp.ok) throw new Error(mapApiError(resp.status));
      return { provider, data: await parseApiJson(resp) };
    }

    const openaiModel = OPENAI_MODELS.includes(model) ? model : OPENAI_MODELS[0];
    const payload = {
      model: openaiModel,
      messages: messages || buildOpenAIPrompt(system, user),
    };
    if (openaiModel.startsWith("o1")) payload.max_completion_tokens = maxTokens;
    else payload.max_tokens = maxTokens;

    let resp;
    try {
      resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error("Network error");
    }
    if (!resp.ok) throw new Error(mapApiError(resp.status));
    return { provider, data: await parseApiJson(resp) };
  };

  const getNodeDirective = (node, plan) => {
    if (!plan?.node_directives) return "";
    const promptLabel = (contextPrompts[node.id] || "").toLowerCase();
    const typeLabel = (entityTypes[node.type]?.name || "").toLowerCase();
    const byEntries = Array.isArray(plan.node_directives)
      ? plan.node_directives.flatMap((item) => Object.entries(item || {}))
      : Object.entries(plan.node_directives);
    const match = byEntries.find(([label]) => {
      const l = String(label || "").toLowerCase();
      return l.includes(node.id.toLowerCase()) || (typeLabel && l.includes(typeLabel)) || (promptLabel && l.includes(promptLabel));
    });
    return match?.[1] || "";
  };

  const buildPrompt = (node, inputData, rollTableInputs, orchestrationPlan = null) => {
    const et = entityTypes[node.type];
    if (!et) return { system: "", user: "" };

    const rulesetRef = `Reference ruleset: ${SRD_RULESET.name} (${SRD_RULESET.version}). Use SRD-compliant mechanics, stat ranges, and terminology.`;

    const system = `You are a D&D 5th Edition content generator using the SRD 5.1 as your mechanical reference.
${rulesetRef}
Always respond with ONLY valid JSON matching the requested schema. No markdown, no code fences, no explanation.
Be creative, original, and ensure content is balanced and mechanically sound per SRD rules.
Ability scores range 1-30. Proficiency bonus derives from CR. Hit dice size depends on creature size.
Use the standard CR/XP table for challenge ratings.`;

    const inputContext = inputData.length > 0
      ? `\n\nConnected entities to incorporate:\n${inputData.map((i) => `--- ${i.name} ---\n${JSON.stringify(i.data, null, 2)}`).join("\n\n")}`
      : "";

    const rollContext = rollTableInputs.length > 0
      ? `\n\nRoll table results to incorporate:\n${rollTableInputs.map((r) => `🎲 ${r.table}: Rolled ${r.roll.total} on ${r.roll.notation} → "${r.entry.result}"`).join("\n")}`
      : "";

    const nodeDirective = getNodeDirective(node, orchestrationPlan);
    const orchestrationContext = orchestrationPlan
      ? `\n\nOrchestration plan to incorporate:
Theme: ${orchestrationPlan.theme || "n/a"}
Tone: ${orchestrationPlan.tone || "n/a"}
Narrative threads: ${(orchestrationPlan.narrative_threads || []).join(" | ") || "n/a"}
Mechanical notes: ${orchestrationPlan.mechanical_notes || "n/a"}
Node directive: ${nodeDirective || "n/a"}`
      : "";

    const userPrompt = `Generate a D&D 5e ${et.name} as a JSON object.

Required JSON schema:
${JSON.stringify(et.schema, null, 2)}
${inputContext}${rollContext}${orchestrationContext}
${contextPrompts[node.id] ? `\nUser direction: ${contextPrompts[node.id]}` : ""}

Respond with ONLY the JSON object.`;

    return { system, user: userPrompt };
  };

  const generateNode = async (nodeId, orchestrationPlan = null) => {
    if (!ensureApiKeyConfigured()) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Roll tables don't use LLM — they store their table definition directly
    if (node.type === "roll_table") {
      // If has a prompt, use LLM to generate a roll table
      const prompt = contextPrompts[nodeId];
      if (prompt) {
        setGenerating(true); setGeneratingNodeId(nodeId); setError(null);
        try {
          const { provider, data } = await callLlm({
            system: "Generate a D&D 5e roll table as JSON. Include: name, dice (e.g. d20), entries (array of {range_min, range_max, result}), tags, source. Respond with ONLY valid JSON.",
            user: `Create a roll table for: ${prompt}\n\nRespond with ONLY JSON.`,
            maxTokens: 2000,
          });
          const text = extractLlmText(data, provider);
          const parsed = parseJsonWithExcerpt(text);
          setNodes((p) => p.map((n) => n.id === nodeId ? { ...n, result: parsed } : n));
          // Auto-roll
          const res = resolveRollTable(parsed);
          setRollResults((p) => ({ ...p, [nodeId]: res }));
        } catch (err) { setError(`Roll table generation failed: ${normalizeLlmError(err)}`); }
        finally { setGenerating(false); setGeneratingNodeId(null); }
      }
      return;
    }

    // Gather inputs
    const incomingConns = connections.filter((c) => c.target === nodeId);
    const inputData = [], rollTableInputs = [];
    incomingConns.forEach((c) => {
      const src = nodes.find((n) => n.id === c.source);
      if (!src) return;
      if (src.type === "roll_table" && rollResults[src.id]) {
        rollTableInputs.push(rollResults[src.id]);
      } else if (src.result) {
        inputData.push({ type: src.type, name: entityTypes[src.type]?.name || src.type, data: src.result });
      }
    });

    const { system, user } = buildPrompt(node, inputData, rollTableInputs, orchestrationPlan);
    setGenerating(true); setGeneratingNodeId(nodeId); setError(null);

    try {
      const { provider, data } = await callLlm({ system, user, maxTokens: 4000 });
      const text = extractLlmText(data, provider);
      const parsed = parseJsonWithExcerpt(text);
      setNodes((p) => p.map((n) => n.id === nodeId ? { ...n, result: parsed } : n));
    } catch (err) { setError(`Generation failed: ${normalizeLlmError(err)}`); }
    finally { setGenerating(false); setGeneratingNodeId(null); }
  };

  // Orchestrated generation
  const generateAll = async () => {
    if (!ensureApiKeyConfigured()) return;
    setError(null);
    let activeOrchPlan = null;
    // First resolve all roll tables
    const rollTableNodes = nodes.filter((n) => n.type === "roll_table");
    for (const rtn of rollTableNodes) {
      if (!rtn.result && contextPrompts[rtn.id]) await generateNode(rtn.id);
      else if (rtn.result && !lockedRolls[rtn.id]) {
        const res = resolveRollTable(rtn.result);
        setRollResults((p) => ({ ...p, [rtn.id]: res }));
      }
    }

    if (orchMode === "orchestrated" && nodes.length > 2) {
      // LLM pre-pass for orchestration plan
      setGenerating(true);
      try {
        const graphDesc = nodes.map((n) => {
          const et = entityTypes[n.type];
          const ins = connections.filter((c) => c.target === n.id).map((c) => { const s = nodes.find((nn) => nn.id === c.source); return s ? `${entityTypes[s.type]?.name}` : "?"; });
          return `- Node "${contextPrompts[n.id] || et?.name}" (${et?.name}) ${ins.length ? `← inputs: ${ins.join(", ")}` : "(no inputs)"}`;
        }).join("\n");

        const { provider, data } = await callLlm({
          system: "You are the Entity Forge Orchestrator. Analyze the D&D content generation graph and produce a coherent generation plan. Respond with ONLY JSON: { theme: string, tone: string, narrative_threads: string[], node_directives: { [node_description]: string }[], mechanical_notes: string }",
          user: `Plan generation for this graph:\n${graphDesc}\n\nRoll table results: ${JSON.stringify(Object.values(rollResults).map((r) => `${r.table}: ${r.entry.result}`))}\n\nProduce a cohesive generation plan as JSON.`,
          maxTokens: 2000,
        });
        const text = extractLlmText(data, provider);
        const plan = parseJsonWithExcerpt(text);
        setOrchPlan(plan);
        activeOrchPlan = plan;
      } catch (err) { setError(`Orchestration plan failed (${normalizeLlmError(err)}), falling back to sequential generation.`); }
      setGenerating(false);
    }

    // Generate in topological order
    const order = topologicalSort(nodes, connections);
    for (const nodeId of order) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node?.type === "roll_table") continue; // already handled
      await generateNode(nodeId, orchMode === "orchestrated" ? activeOrchPlan : null);
    }
    setOrchPlan(null);
  };

  // ── Custom Node Builder ──
  const closeCustomBuilder = () => {
    setShowCustomBuilder(false);
    setShowCustomAi(false);
    setCustomAiChat([]);
    setCustomAiInput("");
  };

  const saveCustomNode = async () => {
    const id = customDraft.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!id || !customDraft.name) return;
    let schema = {};
    try { schema = JSON.parse(customDraft.schemaText || "{}"); } catch { setError("Invalid JSON in schema"); return; }
    const newType = {
      id, name: customDraft.name, icon: customDraft.icon || "⚙️",
      color: customDraft.color, accent: customDraft.accent,
      description: customDraft.description,
      acceptsInputs: [...customDraft.acceptsInputs, "roll_table"],
      schema, isCustom: true,
    };
    const updated = { ...entityTypes, [id]: newType };
    setEntityTypes(updated);
    // Persist custom nodes
    const customs = {};
    Object.entries(updated).forEach(([k, v]) => { if (v.isCustom) customs[k] = v; });
    try { await window.storage.set("ef2-custom-nodes", JSON.stringify(customs)); } catch {}
    closeCustomBuilder();
    setCustomDraft({ name: "", icon: "⚙️", color: "#888888", accent: "#AAAAAA", description: "", acceptsInputs: [], schemaText: "" });
  };

  const generateCustomSchemaWithAi = async () => {
    if (!ensureApiKeyConfigured()) return;
    if (!customAiInput.trim()) return;
    const userMsg = customAiInput.trim();
    const nextHistory = [...customAiChat, { role: "user", content: userMsg }].slice(-10);
    setCustomAiChat(nextHistory);
    setCustomAiInput("");
    setCustomAiGenerating(true);
    setError(null);
    try {
      const system = 'Generate a JSON schema for a custom Entity Forge node. Output ONLY the schema object matching this format: { properties: { fieldName: { type: "string"|"number"|"boolean"|"array", description: "...", enum?: [...] } } }';
      const { provider, data } = await callLlm({
        system,
        user: userMsg,
        messages: apiProvider === "openai" ? [{ role: "system", content: system }, ...nextHistory] : nextHistory,
        maxTokens: 1600,
      });
      const text = extractLlmText(data, provider);
      const parsed = parseJsonWithExcerpt(text);
      if (!parsed || typeof parsed !== "object" || !parsed.properties || typeof parsed.properties !== "object") {
        throw new Error("Schema must include a properties object");
      }
      setCustomDraft((prev) => ({ ...prev, schemaText: JSON.stringify(parsed, null, 2) }));
      setCustomAiChat((p) => [...p, { role: "assistant", content: "Schema generated and applied to the JSON field." }]);
    } catch (err) {
      const msg = normalizeLlmError(err);
      setError(`Custom schema generation failed: ${msg}`);
      setCustomAiChat((p) => [...p, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setCustomAiGenerating(false);
    }
  };

  // ── Orchestrator Chat ──
  const sendOrchChat = async () => {
    if (!ensureApiKeyConfigured()) return;
    if (!orchInput.trim()) return;
    const userMsg = orchInput.trim();
    setOrchChat((p) => [...p, { role: "user", content: userMsg }]);
    setOrchInput("");
    const graphDesc = nodes.map((n) => {
      const et = entityTypes[n.type];
      return `${et?.icon} ${et?.name}${n.result?.name ? ` "${n.result.name}"` : ""}${contextPrompts[n.id] ? ` (prompt: "${contextPrompts[n.id]}")` : ""}`;
    }).join(", ");
    try {
      const system = `You are the Entity Forge Orchestrator, an expert D&D 5e content designer. The user has a node graph with: ${graphDesc || "no nodes yet"}. ${Object.keys(rollResults).length ? `Roll results: ${JSON.stringify(Object.values(rollResults).map((r) => `${r.table}: ${r.entry.result}`))}` : ""} Help them design their content graph. Suggest nodes, connections, themes, and improvements. Be concise and creative.`;
      const history = [...orchChat, { role: "user", content: userMsg }].slice(-10);
      const { provider, data } = await callLlm({
        system,
        user: userMsg,
        messages: apiProvider === "openai" ? [{ role: "system", content: system }, ...history] : history,
        maxTokens: 1000,
      });
      const text = extractLlmText(data, provider);
      setOrchChat((p) => [...p, { role: "assistant", content: text || "..." }]);
    } catch (err) {
      const msg = normalizeLlmError(err);
      setError(`Orchestrator chat failed: ${msg}`);
      setOrchChat((p) => [...p, { role: "assistant", content: `Error: ${msg}` }]);
    }
  };

  // ── Persistence ──
  const persistEntities = async (nextEntities) => {
    setSavedEntities(nextEntities);
    try { await window.storage.set("ef2-entities", JSON.stringify(nextEntities)); } catch {}
  };

  const persistFolders = async (nextFolders) => {
    setFolders(nextFolders);
    try { await window.storage.set("ef2-folders", JSON.stringify(nextFolders)); } catch {}
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const next = [...folders, { id: genId(), name, color: newFolderColor || "#D4A843" }];
    await persistFolders(next);
    setNewFolderName("");
  };

  const toggleEntityFolder = async (entityId, folderId) => {
    const next = savedEntities.map((ent) => {
      if (ent.id !== entityId) return ent;
      const current = Array.isArray(ent.folderIds) ? ent.folderIds : [];
      const folderIds = current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId];
      return { ...ent, folderIds };
    });
    await persistEntities(next);
  };

  const saveEntity = async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node?.result) return;
    const entity = { id: genId(), type: node.type, data: node.result, savedAt: new Date().toISOString(), folderIds: [] };
    const updated = [...savedEntities, entity];
    await persistEntities(updated);
  };

  const deleteEntity = async (entityId) => {
    const updated = savedEntities.filter((e) => e.id !== entityId);
    await persistEntities(updated);
  };

  const clearCanvas = () => { setNodes([]); setConnections([]); setSelectedNode(null); setContextPrompts({}); setRollResults({}); setLockedRolls({}); };

  // ── Port positions ──
  const getOutputPos = (n) => ({ x: n.x + NODE_W + canvasOffset.x, y: n.y + NODE_H / 2 + canvasOffset.y });
  const getInputPos = (n) => ({ x: n.x + canvasOffset.x, y: n.y + NODE_H / 2 + canvasOffset.y });

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);
  const selectedEntityType = selectedNodeData ? entityTypes[selectedNodeData.type] : null;
  const inputsForSelected = selectedNodeData
    ? connections.filter((c) => c.target === selectedNode).map((c) => nodes.find((n) => n.id === c.source)).filter(Boolean)
    : [];

  const coreTypes = Object.values(CORE_ENTITY_TYPES)
    .filter((t) => t.id !== "roll_table")
    .map((t) => entityTypes[t.id])
    .filter(Boolean);
  const missingCoreTypes = Object.values(CORE_ENTITY_TYPES)
    .filter((t) => t.id !== "roll_table" && !entityTypes[t.id])
    .map((t) => t.name);
  const customTypes = Object.values(entityTypes).filter((t) => t.isCustom);
  const rollTableType = entityTypes.roll_table;
  const filteredSavedEntities = folderFilter === "all"
    ? savedEntities
    : savedEntities.filter((ent) => (ent.folderIds || []).includes(folderFilter));
  const modelOptions = apiProvider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", fontFamily: "'Source Sans 3', sans-serif", background: "#0D0D12", color: "#D4CFC4", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Fira+Code:wght@400;500&family=Source+Sans+3:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a24; }
        ::-webkit-scrollbar-thumb { background: #3a3a4a; border-radius: 3px; }
        .node-card { transition: box-shadow 0.2s; }
        .port { cursor: crosshair; transition: transform 0.15s; }
        .port:hover { transform: scale(1.4); }
        .entity-btn { transition: all 0.15s; cursor: pointer; border: 1px solid #2a2a3a; }
        .entity-btn:hover { border-color: #4a4a5a; background: #1a1a2a !important; }
        .tab-btn { cursor: pointer; transition: all 0.15s; }
        .gen-pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        textarea:focus, input:focus, select:focus { outline: none; border-color: #D4A843 !important; }
        .conn-line:hover { opacity: 0.5; }
      `}</style>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div style={{ width: 270, minWidth: 270, background: "#12121C", borderRight: "1px solid #1E1E2E", display: "flex", flexDirection: "column", zIndex: 10 }}>
        {/* Logo + Ruleset */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #1E1E2E" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 17, fontWeight: 700, color: "#D4A843", letterSpacing: 1 }}>⚒ Entity Forge</div>
            <button
              onClick={() => setShowSettings((s) => !s)}
              style={{ background: "transparent", border: "1px solid #2a2a3a", borderRadius: 5, color: "#8a8a9a", width: 28, height: 24, cursor: "pointer", fontSize: 13 }}
              title="API Settings"
            >
              ⚙️
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <select value={ruleset} onChange={(e) => setRuleset(e.target.value)} style={{ flex: 1, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 4, padding: "3px 6px", color: "#8a8a9a", fontSize: 10, fontFamily: "'Source Sans 3'" }}>
              <option value="dnd5e-srd">D&D 5e SRD 5.1</option>
              <option value="dnd5e-2024" disabled>D&D 5e 2024 (coming)</option>
              <option value="pf2e" disabled>Pathfinder 2e (coming)</option>
            </select>
          </div>
          {showSettings && (
            <div className="fade-in" style={{ marginTop: 8, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 6, padding: 8, display: "grid", gap: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: "#6a6a7a", marginBottom: 3 }}>Provider</div>
                <select value={apiProvider} onChange={(e) => persistProvider(e.target.value)}
                  style={{ width: "100%", background: "#12121C", border: "1px solid #2a2a3a", borderRadius: 4, padding: "4px 6px", color: "#D4CFC4", fontSize: 11 }}>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#6a6a7a", marginBottom: 3 }}>Model</div>
                <select value={model} onChange={(e) => persistModel(e.target.value)}
                  style={{ width: "100%", background: "#12121C", border: "1px solid #2a2a3a", borderRadius: 4, padding: "4px 6px", color: "#D4CFC4", fontSize: 11 }}>
                  {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <div style={{ fontSize: 9, color: "#6a6a7a" }}>Anthropic API Key</div>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: anthropicApiKey.trim() ? "#5B8C5A" : "#C44536", display: "inline-block" }} />
                </div>
                <input type="password" value={anthropicApiKey} onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{ width: "100%", background: "#12121C", border: "1px solid #2a2a3a", borderRadius: 4, padding: "5px 6px", color: "#D4CFC4", fontSize: 11 }} />
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button onClick={saveAnthropicKey} style={{ flex: 1, padding: "4px 0", background: "#1a2a1a", border: "1px solid #2f5a2f", borderRadius: 4, color: "#82B881", fontSize: 10, cursor: "pointer" }}>Save</button>
                  <button onClick={clearAnthropicKey} style={{ flex: 1, padding: "4px 0", background: "#2a1a1a", border: "1px solid #5a2f2f", borderRadius: 4, color: "#E8785F", fontSize: 10, cursor: "pointer" }}>Clear</button>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <div style={{ fontSize: 9, color: "#6a6a7a" }}>OpenAI API Key</div>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: openaiApiKey.trim() ? "#5B8C5A" : "#C44536", display: "inline-block" }} />
                </div>
                <input type="password" value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{ width: "100%", background: "#12121C", border: "1px solid #2a2a3a", borderRadius: 4, padding: "5px 6px", color: "#D4CFC4", fontSize: 11 }} />
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button onClick={saveOpenaiKey} style={{ flex: 1, padding: "4px 0", background: "#1a2a1a", border: "1px solid #2f5a2f", borderRadius: 4, color: "#82B881", fontSize: 10, cursor: "pointer" }}>Save</button>
                  <button onClick={clearOpenaiKey} style={{ flex: 1, padding: "4px 0", background: "#2a1a1a", border: "1px solid #5a2f2f", borderRadius: 4, color: "#E8785F", fontSize: 10, cursor: "pointer" }}>Clear</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1E1E2E" }}>
          {[{ id: "palette", label: "Nodes" }, { id: "saved", label: "Vault" }, { id: "orch", label: "Orch" }].map((t) => (
            <div key={t.id} className="tab-btn" onClick={() => setPanel(t.id)}
              style={{ flex: 1, padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: panel === t.id ? "#D4A843" : "#6a6a7a", borderBottom: panel === t.id ? "2px solid #D4A843" : "2px solid transparent" }}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Panel Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 10 }}>

          {/* ── PALETTE ── */}
          {panel === "palette" && (
            <div>
              {/* Sub-tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {[{ id: "entities", label: "SRD" }, { id: "tables", label: "🎲 Tables" }, { id: "custom", label: "Custom" }].map((t) => (
                  <div key={t.id} className="tab-btn" onClick={() => setPaletteTab(t.id)}
                    style={{ padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: paletteTab === t.id ? "#D4A84320" : "transparent", color: paletteTab === t.id ? "#D4A843" : "#555", border: `1px solid ${paletteTab === t.id ? "#D4A84340" : "transparent"}` }}>
                    {t.label}
                  </div>
                ))}
              </div>

              {paletteTab === "entities" && (
                <>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 6, fontWeight: 600 }}>SRD Entity Types</div>
                  {missingCoreTypes.length > 0 && (
                    <div style={{ marginBottom: 8, fontSize: 10, color: "#E8785F", background: "#2a1a1a", border: "1px solid #5a2f2f", borderRadius: 6, padding: "6px 8px" }}>
                      Missing core types: {missingCoreTypes.join(", ")}
                    </div>
                  )}
                  {coreTypes.length === 0 && (
                    <div style={{ fontSize: 11, color: "#4a4a5a", padding: 8 }}>No SRD entity types available.</div>
                  )}
                  {coreTypes.map((et) => (
                    <div key={et.id} className="entity-btn" onClick={() => addNode(et.id)}
                      style={{ background: "#16162250", borderRadius: 7, padding: "8px 10px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: et.color + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{et.icon}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: et.accent }}>{et.name}</div>
                        <div style={{ fontSize: 9, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          ← {et.acceptsInputs.map((a) => entityTypes[a]?.icon || a).join(" ")}
                        </div>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setShowSchema(showSchema === et.id ? null : et.id); }}
                        style={{ fontSize: 10, color: "#555", cursor: "pointer", padding: "2px 5px", borderRadius: 3, background: "#1a1a24" }}>{"{}"}</div>
                    </div>
                  ))}
                  {showSchema && entityTypes[showSchema] && (
                    <div className="fade-in" style={{ background: "#1a1a24", borderRadius: 6, padding: 10, marginTop: 6, border: `1px solid ${entityTypes[showSchema].color}40` }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: entityTypes[showSchema].accent, marginBottom: 6 }}>{entityTypes[showSchema].name} Schema</div>
                      <pre style={{ fontFamily: "'Fira Code', monospace", fontSize: 9, color: "#7a7a8a", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {JSON.stringify(entityTypes[showSchema].schema, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}

              {paletteTab === "tables" && (
                <>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 6, fontWeight: 600 }}>Roll Table Node</div>
                  <div className="entity-btn" onClick={() => addNode("roll_table")}
                    style={{ background: "#16162250", borderRadius: 7, padding: "8px 10px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: rollTableType.color + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎲</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: rollTableType.accent }}>New Roll Table</div>
                      <div style={{ fontSize: 9, color: "#555" }}>Custom or LLM-generated</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 6, marginTop: 10, fontWeight: 600 }}>SRD Pre-loaded Tables</div>
                  {SRD_ROLL_TABLES.map((tbl, i) => (
                    <div key={i} className="entity-btn" onClick={() => {
                      const nid = genId();
                      setNodes((p) => [...p, { id: nid, type: "roll_table", x: 300 + Math.random() * 100 - canvasOffset.x, y: 200 + Math.random() * 100 - canvasOffset.y, result: tbl }]);
                      const res = resolveRollTable(tbl);
                      setRollResults((p) => ({ ...p, [nid]: res }));
                    }}
                      style={{ background: "#16162250", borderRadius: 7, padding: "6px 10px", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12 }}>📜</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#C39BD3" }}>{tbl.name}</div>
                        <div style={{ fontSize: 9, color: "#555" }}>{tbl.dice} · {tbl.entries.length} entries</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {paletteTab === "custom" && (
                <>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 6, fontWeight: 600 }}>Custom Node Types</div>
                  {customTypes.length === 0 && <div style={{ fontSize: 11, color: "#4a4a5a", padding: 8 }}>No custom nodes yet.</div>}
                  {customTypes.map((ct) => (
                    <div key={ct.id} className="entity-btn" onClick={() => addNode(ct.id)}
                      style={{ background: "#16162250", borderRadius: 7, padding: "8px 10px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: ct.color + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{ct.icon}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: ct.accent }}>{ct.name}</div>
                        <div style={{ fontSize: 9, color: "#555" }}>{ct.description?.substring(0, 40)}</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setShowCustomBuilder(true)}
                    style={{ width: "100%", marginTop: 8, padding: "8px 0", background: "transparent", border: "1px dashed #3a3a4a", borderRadius: 6, color: "#6a6a7a", fontSize: 11, cursor: "pointer" }}>
                    + Create Custom Node
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── VAULT ── */}
          {panel === "saved" && (
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 6, fontWeight: 600 }}>
                Saved Entities ({filteredSavedEntities.length}/{savedEntities.length})
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#6a6a7a", marginBottom: 4 }}>Filter by folder</div>
                <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}
                  style={{ width: "100%", background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 6, padding: "6px 8px", color: "#D4CFC4", fontSize: 11 }}>
                  <option value="all">All folders</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10, background: "#16162250", border: "1px solid #2a2a3a", borderRadius: 7, padding: 8 }}>
                <div style={{ fontSize: 10, color: "#6a6a7a", marginBottom: 6 }}>Create folder/tag</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    placeholder="e.g. Arc 1"
                    style={{ flex: 1, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 5, padding: "5px 7px", color: "#D4CFC4", fontSize: 11 }} />
                  <input type="color" value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)}
                    style={{ width: 36, height: 30, border: "1px solid #2a2a3a", borderRadius: 5, background: "none", cursor: "pointer" }} />
                  <button onClick={createFolder}
                    style={{ padding: "0 10px", background: "#D4A84320", border: "1px solid #D4A84340", borderRadius: 5, color: "#D4A843", fontSize: 11, cursor: "pointer" }}>
                    Add
                  </button>
                </div>
              </div>

              {folders.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {folders.map((folder) => (
                    <span key={folder.id}
                      onClick={() => setFolderFilter(folder.id)}
                      style={{ padding: "2px 7px", borderRadius: 999, border: `1px solid ${folder.color}55`, background: folderFilter === folder.id ? `${folder.color}2A` : "#1a1a24", color: folder.color, fontSize: 10, cursor: "pointer" }}>
                      {folder.name}
                    </span>
                  ))}
                </div>
              )}

              {savedEntities.length === 0 && <div style={{ fontSize: 11, color: "#4a4a5a", padding: 8 }}>Generate and save entities to your vault.</div>}
              {savedEntities.length > 0 && filteredSavedEntities.length === 0 && (
                <div style={{ fontSize: 11, color: "#4a4a5a", padding: 8 }}>No entities found for this folder.</div>
              )}

              {filteredSavedEntities.map((ent) => {
                const et = entityTypes[ent.type];
                const assignedFolders = folders.filter((folder) => (ent.folderIds || []).includes(folder.id));
                return (
                  <div key={ent.id} className="entity-btn" style={{ background: "#16162250", borderRadius: 7, padding: "8px 10px", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12 }}>{et?.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: et?.accent }}>{ent.data?.name || et?.name}</span>
                      <span onClick={() => deleteEntity(ent.id)} style={{ marginLeft: "auto", fontSize: 9, color: "#C44536", cursor: "pointer" }}>✕</span>
                    </div>
                    <div style={{ fontSize: 8, color: "#555", marginBottom: 4 }}>
                      {ent.savedAt ? new Date(ent.savedAt).toLocaleString() : "Unknown save date"}
                    </div>
                    <div style={{ fontSize: 9, color: "#555", fontFamily: "'Fira Code', monospace", maxHeight: 40, overflow: "hidden" }}>
                      {JSON.stringify(ent.data).substring(0, 100)}...
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {assignedFolders.map((folder) => (
                        <span key={folder.id}
                          style={{ padding: "1px 6px", borderRadius: 999, border: `1px solid ${folder.color}55`, color: folder.color, fontSize: 9 }}>
                          {folder.name}
                        </span>
                      ))}
                    </div>
                    {folders.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {folders.map((folder) => {
                          const active = (ent.folderIds || []).includes(folder.id);
                          return (
                            <span key={folder.id} onClick={() => toggleEntityFolder(ent.id, folder.id)}
                              style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, cursor: "pointer", background: active ? `${folder.color}22` : "#1a1a24", border: `1px solid ${active ? folder.color : "#2a2a3a"}`, color: active ? folder.color : "#6a6a7a" }}>
                              {active ? "✓ " : "+ "}{folder.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ORCHESTRATOR ── */}
          {panel === "orch" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 8, fontWeight: 600 }}>Orchestration Mode</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {[{ id: "sequential", label: "Sequential", desc: "Dependency order" }, { id: "orchestrated", label: "Orchestrated", desc: "LLM-planned" }, { id: "conversational", label: "Chat", desc: "Interactive" }].map((m) => (
                  <div key={m.id} className="tab-btn" onClick={() => setOrchMode(m.id)}
                    style={{ flex: 1, padding: "6px 4px", borderRadius: 5, textAlign: "center", fontSize: 9, fontWeight: 600, background: orchMode === m.id ? "#D4A84320" : "#16162250", color: orchMode === m.id ? "#D4A843" : "#555", border: `1px solid ${orchMode === m.id ? "#D4A84340" : "#2a2a3a"}` }}>
                    {m.label}
                    <div style={{ fontSize: 8, fontWeight: 400, marginTop: 1 }}>{m.desc}</div>
                  </div>
                ))}
              </div>

              {orchMode === "conversational" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: 1, overflow: "auto", marginBottom: 8 }}>
                    {orchChat.length === 0 && <div style={{ fontSize: 11, color: "#4a4a5a", padding: 8 }}>Ask the Orchestrator about your graph. It can suggest nodes, themes, and improvements.</div>}
                    {orchChat.map((msg, i) => (
                      <div key={i} style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 6, background: msg.role === "user" ? "#1a1a2e" : "#16162A", border: `1px solid ${msg.role === "user" ? "#2a2a4a" : "#D4A84320"}` }}>
                        <div style={{ fontSize: 9, color: msg.role === "user" ? "#6a6a8a" : "#D4A843", marginBottom: 2, fontWeight: 600 }}>
                          {msg.role === "user" ? "You" : "⚒ Orchestrator"}
                        </div>
                        <div style={{ fontSize: 11, color: "#B0ACA0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input value={orchInput} onChange={(e) => setOrchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendOrchChat()}
                      placeholder="Ask the Orchestrator..."
                      style={{ flex: 1, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 6, padding: "6px 8px", color: "#D4CFC4", fontSize: 11, fontFamily: "'Source Sans 3'" }} />
                    <button onClick={sendOrchChat} style={{ padding: "6px 10px", background: "#D4A84330", border: "1px solid #D4A84350", borderRadius: 6, color: "#D4A843", fontSize: 11, cursor: "pointer" }}>→</button>
                  </div>
                </div>
              )}

              {orchMode !== "conversational" && (
                <div>
                  <div style={{ fontSize: 11, color: "#6a6a7a", lineHeight: 1.5, padding: 6 }}>
                    {orchMode === "sequential"
                      ? "Nodes are generated in dependency order. Upstream results feed downstream prompts."
                      : "An LLM pre-pass analyzes your graph to produce a coherent generation plan with narrative themes and mechanical constraints before generating each node."}
                  </div>
                  {orchPlan && (
                    <div className="fade-in" style={{ background: "#16162A", border: "1px solid #D4A84330", borderRadius: 6, padding: 8, marginTop: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#D4A843", marginBottom: 4 }}>GENERATION PLAN</div>
                      <div style={{ fontSize: 10, color: "#B0ACA0", lineHeight: 1.5 }}>
                        {orchPlan.theme && <div><strong>Theme:</strong> {orchPlan.theme}</div>}
                        {orchPlan.tone && <div><strong>Tone:</strong> {orchPlan.tone}</div>}
                        {orchPlan.narrative_threads?.map((t, i) => <div key={i} style={{ marginTop: 2 }}>• {t}</div>)}
                        {orchPlan.mechanical_notes && <div style={{ marginTop: 4 }}><strong>Mechanical Notes:</strong> {orchPlan.mechanical_notes}</div>}
                        {Array.isArray(orchPlan.node_directives) && orchPlan.node_directives.length > 0 && (
                          <div style={{ marginTop: 5 }}>
                            <strong>Node Directives:</strong>
                            {orchPlan.node_directives.map((entry, i) => {
                              const [k, v] = Object.entries(entry || {})[0] || [];
                              return <div key={i} style={{ marginTop: 2 }}>• {k || "Node"}: {v || ""}</div>;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: 10, borderTop: "1px solid #1E1E2E", display: "flex", gap: 4 }}>
          <button onClick={generateAll} disabled={generating || nodes.length === 0}
            style={{ flex: 1, padding: "9px 0", background: generating ? "#333" : "linear-gradient(135deg, #D4A843, #B5651D)", border: "none", borderRadius: 7, color: generating ? "#666" : "#0D0D12", fontWeight: 700, fontSize: 11, cursor: generating ? "not-allowed" : "pointer", fontFamily: "'Cinzel', serif" }}>
            {generating ? "⏳ Forging..." : orchMode === "orchestrated" ? "🧠 Orchestrate" : "⚡ Forge All"}
          </button>
          <button onClick={clearCanvas} style={{ padding: "9px 12px", background: "transparent", border: "1px solid #2a2a3a", borderRadius: 7, color: "#6a6a7a", fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <div ref={canvasRef} onMouseDown={handleCanvasMouseDown}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : connecting ? "crosshair" : "grab" }}>
        <svg className="canvas-bg" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse" x={canvasOffset.x % 30} y={canvasOffset.y % 30}><circle cx="15" cy="15" r="0.7" fill="#1E1E2E" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Connections */}
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
          {connections.map((conn) => {
            const src = nodes.find((n) => n.id === conn.source);
            const tgt = nodes.find((n) => n.id === conn.target);
            if (!src || !tgt) return null;
            const from = getOutputPos(src), to = getInputPos(tgt);
            const dx = Math.abs(to.x - from.x) * 0.5;
            const srcColor = entityTypes[src.type]?.color || "#555";
            const tgtColor = entityTypes[tgt.type]?.color || "#555";
            return (
              <g key={conn.id} style={{ pointerEvents: "auto" }}>
                <defs><linearGradient id={`g-${conn.id}`}><stop offset="0%" stopColor={srcColor} /><stop offset="100%" stopColor={tgtColor} /></linearGradient></defs>
                <path d={`M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`} fill="none" stroke="transparent" strokeWidth={12} className="conn-line" onClick={() => removeConnection(conn.id)} style={{ cursor: "pointer" }} />
                <path d={`M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`} fill="none" stroke={`url(#g-${conn.id})`} strokeWidth={2} strokeDasharray={src.result ? "none" : "6 4"} opacity={0.7} style={{ pointerEvents: "none" }} />
                <circle cx={to.x} cy={to.y} r={4} fill={tgtColor} opacity={0.7} style={{ pointerEvents: "none" }} />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const et = entityTypes[node.type];
          if (!et) return null;
          const isSelected = selectedNode === node.id;
          const isGen = generatingNodeId === node.id;
          const hasResult = !!node.result;
          const isRollTable = node.type === "roll_table";
          const rollRes = rollResults[node.id];
          const inCount = connections.filter((c) => c.target === node.id).length;
          const outCount = connections.filter((c) => c.source === node.id).length;

          return (
            <div key={node.id} className={`node-card ${isGen ? "gen-pulse" : ""}`} onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
              style={{ position: "absolute", left: node.x + canvasOffset.x, top: node.y + canvasOffset.y, width: NODE_W, minHeight: NODE_H, background: "#16162A", borderRadius: 9, border: `1.5px solid ${isSelected ? et.accent : isGen ? "#D4A843" : hasResult ? et.color + "60" : "#2a2a3a"}`, zIndex: isSelected ? 5 : 2, cursor: dragging === node.id ? "grabbing" : "grab", userSelect: "none", boxShadow: isSelected ? `0 0 16px ${et.color}30` : "0 2px 8px rgba(0,0,0,0.3)" }}>
              {/* Input port */}
              {!et.isSource && (
                <div className="port" onMouseUp={(e) => endConnection(node.id, e)}
                  style={{ position: "absolute", left: -6, top: NODE_H / 2 - 6, width: 12, height: 12, borderRadius: "50%", background: inCount > 0 ? et.color : "#2a2a3a", border: `2px solid ${connecting ? et.accent : "#1a1a24"}`, zIndex: 10 }} />
              )}
              {/* Output port */}
              <div className="port" onMouseDown={(e) => startConnection(node.id, e)}
                style={{ position: "absolute", right: -6, top: NODE_H / 2 - 6, width: 12, height: 12, borderRadius: "50%", background: outCount > 0 ? et.color : "#2a2a3a", border: `2px solid ${et.color}60`, zIndex: 10 }} />
              {/* Header */}
              <div style={{ padding: "8px 10px 6px", display: "flex", alignItems: "center", gap: 6, borderBottom: `1px solid ${et.color}20` }}>
                <div style={{ width: 26, height: 26, borderRadius: 5, background: `${et.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{et.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: et.accent, fontFamily: "'Cinzel', serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {hasResult && node.result.name ? node.result.name : et.name}
                  </div>
                  {hasResult && node.result.name && <div style={{ fontSize: 8, color: "#6a6a7a" }}>{et.name}{et.isCustom ? " (custom)" : ""}</div>}
                </div>
                <div onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} style={{ fontSize: 9, color: "#4a4a5a", cursor: "pointer", padding: "2px 3px" }}>✕</div>
              </div>
              {/* Status */}
              <div style={{ padding: "6px 10px" }}>
                {isGen ? <div style={{ fontSize: 9, color: "#D4A843" }}>⚡ Forging...</div>
                  : isRollTable && rollRes ? (
                    <div style={{ fontSize: 9 }}>
                      <span style={{ color: "#9B59B6" }}>🎲 {rollRes.roll.total}</span>
                      <span style={{ color: "#6a6a7a" }}> → </span>
                      <span style={{ color: "#C39BD3" }}>{rollRes.entry.result?.substring(0, 30)}{rollRes.entry.result?.length > 30 ? "..." : ""}</span>
                    </div>
                  )
                    : hasResult ? <div style={{ fontSize: 9, color: "#5B8C5A" }}>✓ Generated</div>
                      : <div style={{ fontSize: 9, color: "#4a4a5a" }}>{inCount > 0 ? `${inCount} input${inCount > 1 ? "s" : ""}` : "Ready"}</div>}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: "#3a3a4a", pointerEvents: "none" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚒</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: "#4a4a5a", marginBottom: 6 }}>The Forge Awaits</div>
            <div style={{ fontSize: 12 }}>Add entity nodes from the palette. Connect outputs → inputs.<br />Roll tables inject randomness. Use the Orchestrator for coherent generation.</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="fade-in" style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#C4453620", border: "1px solid #C44536", borderRadius: 7, padding: "8px 14px", color: "#E8785F", fontSize: 11, zIndex: 20, maxWidth: 380 }}>
            {error}<span onClick={() => setError(null)} style={{ marginLeft: 10, cursor: "pointer", opacity: 0.7 }}>✕</span>
          </div>
        )}

        {/* Connection hint */}
        {connecting && (
          <div style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", background: "#D4A84320", border: "1px solid #D4A843", borderRadius: 7, padding: "6px 14px", color: "#D4A843", fontSize: 11, zIndex: 100, fontWeight: 500 }}>
            Click an input port on a compatible node · Click canvas to cancel
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      {selectedNodeData && selectedEntityType && (
        <div className="fade-in" style={{ width: 310, minWidth: 310, background: "#12121C", borderLeft: "1px solid #1E1E2E", display: "flex", flexDirection: "column", zIndex: 10 }}>
          {/* Header */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${selectedEntityType.color}30`, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: `${selectedEntityType.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{selectedEntityType.icon}</div>
            <div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 600, color: selectedEntityType.accent }}>
                {selectedNodeData.result?.name || selectedEntityType.name}
              </div>
              <div style={{ fontSize: 9, color: "#6a6a7a" }}>{selectedEntityType.description?.substring(0, 50)}</div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {/* Roll table controls */}
            {selectedNodeData.type === "roll_table" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 4, fontWeight: 600 }}>Roll Table Controls</div>
                {selectedNodeData.result ? (
                  <div>
                    <div style={{ fontSize: 11, color: "#C39BD3", marginBottom: 6 }}>
                      {selectedNodeData.result.name} ({selectedNodeData.result.dice})
                    </div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      <button onClick={() => { setLockedRolls((p) => ({ ...p, [selectedNode]: false })); executeRollTable(selectedNode); }}
                        disabled={lockedRolls[selectedNode]}
                        style={{ flex: 1, padding: "6px", background: lockedRolls[selectedNode] ? "#222" : "#9B59B620", border: `1px solid ${lockedRolls[selectedNode] ? "#333" : "#9B59B640"}`, borderRadius: 5, color: lockedRolls[selectedNode] ? "#555" : "#C39BD3", fontSize: 10, cursor: lockedRolls[selectedNode] ? "not-allowed" : "pointer" }}>
                        🎲 Re-roll
                      </button>
                      <button onClick={() => toggleLockRoll(selectedNode)}
                        style={{ padding: "6px 10px", background: lockedRolls[selectedNode] ? "#D4A84320" : "transparent", border: `1px solid ${lockedRolls[selectedNode] ? "#D4A84340" : "#2a2a3a"}`, borderRadius: 5, color: lockedRolls[selectedNode] ? "#D4A843" : "#6a6a7a", fontSize: 10, cursor: "pointer" }}>
                        {lockedRolls[selectedNode] ? "🔒" : "🔓"}
                      </button>
                    </div>
                    {rollResults[selectedNode] && (
                      <div style={{ background: "#0D0D12", border: "1px solid #9B59B630", borderRadius: 6, padding: 8 }}>
                        <div style={{ fontSize: 10, color: "#9B59B6" }}>Rolled: {rollResults[selectedNode].roll.total} ({rollResults[selectedNode].roll.notation})</div>
                        <div style={{ fontSize: 11, color: "#D4CFC4", marginTop: 4, lineHeight: 1.4 }}>→ {rollResults[selectedNode].entry.result}</div>
                      </div>
                    )}
                    <div style={{ marginTop: 8, maxHeight: 150, overflow: "auto" }}>
                      {selectedNodeData.result.entries?.map((entry, i) => (
                        <div key={i} style={{ fontSize: 9, color: "#6a6a7a", padding: "2px 0", borderBottom: "1px solid #1a1a24", display: "flex", gap: 4 }}>
                          <span style={{ color: "#9B59B6", minWidth: 30 }}>{entry.range_min === entry.range_max ? entry.range_min : `${entry.range_min}-${entry.range_max}`}</span>
                          <span>{entry.result}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#555" }}>Enter a prompt below and forge to generate a roll table via LLM.</div>
                )}
              </div>
            )}

            {/* Context prompt */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 4, fontWeight: 600 }}>
                {selectedNodeData.type === "roll_table" ? "Table Generation Prompt" : "Generation Prompt"}
              </div>
              <textarea value={contextPrompts[selectedNode] || ""} onChange={(e) => setContextPrompts({ ...contextPrompts, [selectedNode]: e.target.value })}
                placeholder={selectedNodeData.type === "roll_table" ? 'e.g. "Random encounters for a haunted forest, d12"' : 'e.g. "A fire genasi blacksmith with a dark secret"'}
                style={{ width: "100%", minHeight: 55, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 6, padding: 8, color: "#D4CFC4", fontSize: 11, fontFamily: "'Source Sans 3'", resize: "vertical", lineHeight: 1.4 }} />
            </div>

            {/* Connected inputs */}
            {inputsForSelected.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 4, fontWeight: 600 }}>Connected Inputs</div>
                {inputsForSelected.map((inp) => {
                  const iet = entityTypes[inp.type];
                  const isRT = inp.type === "roll_table";
                  return (
                    <div key={inp.id} style={{ background: "#0D0D12", border: `1px solid ${iet?.color || "#333"}30`, borderRadius: 5, padding: "4px 8px", marginBottom: 3, display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                      <span>{iet?.icon}</span>
                      <span style={{ color: iet?.accent }}>
                        {isRT && rollResults[inp.id] ? `🎲 ${rollResults[inp.id].entry.result?.substring(0, 25)}` : inp.result?.name || iet?.name}
                      </span>
                      {(inp.result || rollResults[inp.id]) ? <span style={{ color: "#5B8C5A", marginLeft: "auto" }}>✓</span> : <span style={{ color: "#C44536", marginLeft: "auto" }}>○</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Accepts */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", marginBottom: 4, fontWeight: 600 }}>Accepts From</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {selectedEntityType.acceptsInputs.map((tid) => {
                  const t = entityTypes[tid];
                  return t ? (
                    <span key={tid} style={{ background: `${t.color}15`, border: `1px solid ${t.color}30`, borderRadius: 3, padding: "2px 6px", fontSize: 9, color: t.accent }}>{t.icon} {t.name}</span>
                  ) : null;
                })}
              </div>
            </div>

            {/* Generate */}
            <button onClick={() => generateNode(selectedNode)} disabled={generating}
              style={{ width: "100%", padding: "8px 0", background: generating ? "#333" : `linear-gradient(135deg, ${selectedEntityType.color}, ${selectedEntityType.accent})`, border: "none", borderRadius: 7, color: generating ? "#666" : "#0D0D12", fontWeight: 700, fontSize: 11, cursor: generating ? "not-allowed" : "pointer", fontFamily: "'Cinzel', serif", marginBottom: 12 }}>
              {generatingNodeId === selectedNode ? "⏳ Forging..." : selectedNodeData.result ? "🔄 Re-forge" : `⚡ Forge ${selectedEntityType.name}`}
            </button>

            {/* Result */}
            {selectedNodeData.result && selectedNodeData.type !== "roll_table" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#444", fontWeight: 600 }}>Result</div>
                  <button onClick={() => saveEntity(selectedNode)}
                    style={{ background: "#D4A84320", border: "1px solid #D4A84340", borderRadius: 3, padding: "2px 8px", color: "#D4A843", fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                    💾 Save
                  </button>
                </div>
                <div style={{ background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 6, padding: 10 }}>
                  {Object.entries(selectedNodeData.result).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: selectedEntityType.accent, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{key.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 11, color: "#B0ACA0", lineHeight: 1.4 }}>
                        {typeof value === "object" ? (
                          Array.isArray(value) ? (
                            value.map((item, i) => (
                              <div key={i} style={{ padding: "1px 0", borderBottom: i < value.length - 1 ? "1px solid #1a1a24" : "none" }}>
                                {typeof item === "object" ? Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(" · ") : `• ${item}`}
                              </div>
                            ))
                          ) : (
                            <pre style={{ fontFamily: "'Fira Code', monospace", fontSize: 9, whiteSpace: "pre-wrap", color: "#7a7a8a" }}>{JSON.stringify(value, null, 2)}</pre>
                          )
                        ) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CUSTOM NODE BUILDER MODAL ═══ */}
      {showCustomBuilder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCustomBuilder(); }}>
          <div className="fade-in" style={{ background: "#12121C", border: "1px solid #2a2a3a", borderRadius: 12, width: 480, maxHeight: "80vh", overflow: "auto", padding: 24 }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: "#D4A843", marginBottom: 16 }}>⚙️ Custom Node Builder</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: "#6a6a7a", display: "block", marginBottom: 3 }}>Name *</label>
                <input value={customDraft.name} onChange={(e) => setCustomDraft({ ...customDraft, name: e.target.value })}
                  placeholder="Quest" style={{ width: "100%", background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 5, padding: "6px 8px", color: "#D4CFC4", fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#6a6a7a", display: "block", marginBottom: 3 }}>Icon (emoji)</label>
                <input value={customDraft.icon} onChange={(e) => setCustomDraft({ ...customDraft, icon: e.target.value })}
                  style={{ width: "100%", background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 5, padding: "6px 8px", color: "#D4CFC4", fontSize: 12 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: "#6a6a7a", display: "block", marginBottom: 3 }}>Color</label>
                <input type="color" value={customDraft.color} onChange={(e) => setCustomDraft({ ...customDraft, color: e.target.value })}
                  style={{ width: "100%", height: 32, background: "none", border: "1px solid #2a2a3a", borderRadius: 5, cursor: "pointer" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#6a6a7a", display: "block", marginBottom: 3 }}>Accent</label>
                <input type="color" value={customDraft.accent} onChange={(e) => setCustomDraft({ ...customDraft, accent: e.target.value })}
                  style={{ width: "100%", height: 32, background: "none", border: "1px solid #2a2a3a", borderRadius: 5, cursor: "pointer" }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#6a6a7a", display: "block", marginBottom: 3 }}>Description</label>
              <input value={customDraft.description} onChange={(e) => setCustomDraft({ ...customDraft, description: e.target.value })}
                placeholder="A multi-stage quest with branching outcomes"
                style={{ width: "100%", background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 5, padding: "6px 8px", color: "#D4CFC4", fontSize: 12 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#6a6a7a", display: "block", marginBottom: 3 }}>Accepts Inputs From</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Object.values(CORE_ENTITY_TYPES).filter((t) => t.id !== "roll_table").map((t) => {
                  const isActive = customDraft.acceptsInputs.includes(t.id);
                  return (
                    <span key={t.id} onClick={() => setCustomDraft({ ...customDraft, acceptsInputs: isActive ? customDraft.acceptsInputs.filter((x) => x !== t.id) : [...customDraft.acceptsInputs, t.id] })}
                      style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer", background: isActive ? `${t.color}30` : "#1a1a24", border: `1px solid ${isActive ? t.color : "#2a2a3a"}`, color: isActive ? t.accent : "#555" }}>
                      {t.icon} {t.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 10, color: "#6a6a7a", display: "block" }}>Schema (JSON) *</label>
                <button onClick={() => setShowCustomAi((s) => !s)}
                  style={{ background: showCustomAi ? "#D4A84320" : "transparent", border: `1px solid ${showCustomAi ? "#D4A84340" : "#2a2a3a"}`, borderRadius: 4, color: showCustomAi ? "#D4A843" : "#8a8a9a", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>
                  Use AI ✨
                </button>
              </div>

              {showCustomAi && (
                <div style={{ marginBottom: 8, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 6, padding: 8 }}>
                  <div style={{ fontSize: 10, color: "#6a6a7a", marginBottom: 6 }}>Describe the node schema you want and AI will generate the JSON.</div>
                  <div style={{ maxHeight: 120, overflow: "auto", marginBottom: 6 }}>
                    {customAiChat.length === 0 && (
                      <div style={{ fontSize: 10, color: "#4a4a5a" }}>Try: "A weather system node with season, intensity, and effects."</div>
                    )}
                    {customAiChat.map((msg, i) => (
                      <div key={i} style={{ marginBottom: 4, border: `1px solid ${msg.role === "user" ? "#2a2a4a" : "#3a3a2a"}`, background: msg.role === "user" ? "#141428" : "#1a1a24", borderRadius: 5, padding: "5px 6px" }}>
                        <div style={{ fontSize: 9, color: msg.role === "user" ? "#6a6a8a" : "#D4A843", marginBottom: 2, fontWeight: 600 }}>{msg.role === "user" ? "You" : "AI"}</div>
                        <div style={{ fontSize: 10, color: "#B0ACA0", whiteSpace: "pre-wrap" }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input value={customAiInput} onChange={(e) => setCustomAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generateCustomSchemaWithAi()}
                      placeholder="Describe your custom node..."
                      style={{ flex: 1, background: "#12121C", border: "1px solid #2a2a3a", borderRadius: 5, padding: "6px 7px", color: "#D4CFC4", fontSize: 11 }} />
                    <button onClick={generateCustomSchemaWithAi} disabled={customAiGenerating}
                      style={{ padding: "0 10px", background: customAiGenerating ? "#333" : "#D4A84320", border: `1px solid ${customAiGenerating ? "#333" : "#D4A84340"}`, borderRadius: 5, color: customAiGenerating ? "#666" : "#D4A843", fontSize: 11, cursor: customAiGenerating ? "not-allowed" : "pointer" }}>
                      {customAiGenerating ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              )}

              <textarea value={customDraft.schemaText} onChange={(e) => setCustomDraft({ ...customDraft, schemaText: e.target.value })}
                placeholder={`{\n  "name": "string",\n  "stages": "{ name, description, skill_checks }[]",\n  "reward": "string"\n}`}
                style={{ width: "100%", minHeight: 120, background: "#0D0D12", border: "1px solid #2a2a3a", borderRadius: 5, padding: 8, color: "#D4CFC4", fontSize: 11, fontFamily: "'Fira Code', monospace", resize: "vertical", lineHeight: 1.4 }} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={closeCustomBuilder} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2a2a3a", borderRadius: 6, color: "#6a6a7a", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveCustomNode} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #D4A843, #B5651D)", border: "none", borderRadius: 6, color: "#0D0D12", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Cinzel', serif" }}>Create Node</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
