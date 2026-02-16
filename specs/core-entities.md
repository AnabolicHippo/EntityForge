# Core Entity Types

## SRD 5.1 Entity Definitions

The application must support these SRD-compliant entity types with full schema validation:

### 1. Creature
**Icon:** 🐉 | **Color:** #C44536

- Roles: monster, npc, boss, minion, companion
- Full D&D 5e stat block: AC, HP, speed, ability scores (1-30), saves, skills
- Damage types: vulnerabilities, resistances, immunities (SRD types)
- Senses: darkvision, blindsight, tremorsense, truesight, passive perception
- Challenge Rating: 0-30 with derived proficiency bonus
- Actions, bonus actions, reactions, legendary actions (boss role)
- Lair actions (boss role)
- Spellcasting with spell slots and DC
- Personality traits (NPC/boss): ideals, bonds, flaws, backstory, appearance

### 2. Encounter
**Icon:** ⚔️ | **Color:** #D4A843

- Types: combat, social, exploration, puzzle, trap, mixed
- Difficulty: easy, medium, hard, deadly (SRD XP thresholds)
- Party level and size (default 4)
- Environment: terrain, lighting, weather, special features
- Creature placements with tactics
- Objectives: primary, secondary, hidden
- XP budget with multipliers and adjusted XP
- Rewards: XP, gold, items, story rewards
- Scaling rules for easier/harder variants

### 3. Dungeon
**Icon:** 🏰 | **Color:** #6B5B95

- Multi-room environment with theme and level range
- Room definitions: ID, name, description, dimensions, exits, contents
- Entry points and boss room
- Wandering monsters with patrol routes
- Environmental hazards (type, location, effect, DC, damage)
- Treasure hoard (SRD tables by CR)
- Secrets with detection DC and rewards
- Adventure hooks

### 4. Location
**Icon:** 🗺️ | **Color:** #3D7EA6

- Types: city, town, village, hamlet, wilderness, ruin, landmark, planar
- Population demographics
- Government and economy
- Points of interest with NPC references
- Faction presence with influence and goals
- Rumors with truth values
- Dangers and history
- Adventure hooks

### 5. Trap
**Icon:** 🪤 | **Color:** #B5651D

- Types: mechanical, magical, natural, hybrid
- Severity: setback, dangerous, deadly (SRD severity table)
- Trigger and effect
- Damage dice, type, and average (per SRD severity)
- Save DC and ability (per SRD trap DC table)
- Attack bonus (SRD trap attack table)
- Detection and disarm: skill, DC, tools required
- Countermeasures
- Reset: automatic, manual, one-shot

### 6. Faction
**Icon:** 🏛️ | **Color:** #4A6741

- Types: guild, cult, government, military, mercenary, religious, criminal, arcane, noble house
- Alignment tendency and motto
- Goals with priority and progress tracking
- Hierarchy: ranks, titles, responsibilities, NPC references
- Resources (type, quantity, description)
- Headquarters and territory
- Allies and enemies with relationship descriptions
- Secrets, joining requirements, reputation

### 7. Loot
**Icon:** 💎 | **Color:** #C9A227

- Categories: weapon, armor, potion, ring, rod, scroll, staff, wand, wondrous, mundane
- Rarity: common, uncommon, rare, very rare, legendary, artifact (SRD)
- Attunement requirements
- Properties and mechanics
- Charges with recharge rules
- Cursed items with removal conditions
- Lore and value (GP by rarity)

### 8. Roll Table
**Icon:** 🎲 | **Color:** #9B59B6

**Special:** Data source node — generates random inputs for other entities

- Dice notation: d4, d6, d8, d10, d12, d20, d100, XdY format
- Entries with range_min, range_max, result text
- Optional weights
- Cascade flag for nested rolls
- Reroll duplicates option
- Source attribution

## SRD Reference Data

The application must include these SRD lookups:

- **Sizes:** Tiny, Small, Medium, Large, Huge, Gargantuan
- **Creature Types:** Aberration, Beast, Celestial, Construct, Dragon, Elemental, Fey, Fiend, Giant, Humanoid, Monstrosity, Ooze, Plant, Undead
- **Alignments:** LG, NG, CG, LN, TN, CN, LE, NE, CE, Unaligned
- **Damage Types:** acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
- **Conditions:** blinded, charmed, deafened, exhaustion, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
- **Skills:** Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival
- **CR XP Table:** CR 0 = 10 XP, 1/8 = 25, 1/4 = 50, 1/2 = 100, 1 = 200, etc.
- **Hit Dice by Size:** Tiny d4, Small d6, Medium d8, Large d10, Huge d12, Gargantuan d20

## Pre-loaded SRD Roll Tables

Ship with these SRD tables ready to use:

1. **NPC Appearance (d20):** distinctive jewelry, piercings, scars, tattoos, unusual features
2. **NPC Interaction Trait (d12):** argumentative, arrogant, curious, friendly, suspicious, etc.
3. **Dungeon Noises (d12):** bang/slam, buzzing, chanting, footsteps, screaming, etc.

## Validation Rules

- Ability scores: 1-30
- Proficiency bonus: derived from CR (CR 0-4: +2, 5-8: +3, 9-12: +4, etc.)
- Hit dice size must match creature size
- CR must have valid XP value from SRD table
- Damage types, conditions, skills must be from SRD lists
- Rarity levels must be SRD-compliant
