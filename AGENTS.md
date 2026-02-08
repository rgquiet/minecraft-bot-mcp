# Routines System Architecture

This document describes the bot routines system and how to extend it with new routines.

## Overview

Routines are long-running behaviors that operate independently until explicitly stopped. They are:
- **Mutually exclusive**: Only one routine can be active at a time
- **Event-driven**: Use mineflayer events for reactive behavior
- **Tracked**: All event listeners are registered via the manager for automatic cleanup
- **Stateful**: Store state in `botState.routineManager`

## Architecture

```
src/
├── types/
│   └── routines.ts          # Type definitions for all routines
├── routines/
│   ├── RoutineManager.ts    # Core manager (start/stop/cleanup)
│   ├── GuardRoutine.ts      # Guard mode implementation
│   └── index.ts             # Exports all routine functions
└── tools/
    └── routines.ts          # MCP tools that expose routines to AI
```

## Key Components

### RoutineManager.ts

Central manager that handles:
- `registerListener(bot, event, handler)` - Register event listener with tracking
- `cleanupListeners(bot)` - Remove all tracked listeners
- `stopCurrentRoutine(bot)` - Stop active routine, clean up, stop pathfinder
- `onBotDisconnect()` - Full cleanup when bot disconnects
- `getActiveRoutine()` / `setActiveRoutine()` - State access
- `setAttackInterval()` / `clearAttackInterval()` - Interval management

### State Structure

State is stored in `botState.routineManager`:

```typescript
interface RoutineManagerState {
  activeRoutine: ActiveRoutineState | null  // Current routine state
  listeners: TrackedListener[]               // Registered event handlers
  attackIntervalId: NodeJS.Timeout | null   // Combat loop interval
}
```

### Routine State Types

Each routine extends `RoutineState`:

```typescript
interface RoutineState {
  type: string        // Routine identifier
  startedAt: number   // Timestamp
}

interface GuardRoutineState extends RoutineState {
  type: 'guard'
  protectedPlayerUsername: string
  attackRange: number
  followDistance: number
  stats: { mobsKilled: number; damageTaken: number }
}
```

## How to Add a New Routine

### 1. Add Type Definition

In `src/types/routines.ts`, add your routine state interface:

```typescript
interface CombatRoutineState extends RoutineState {
  type: 'combat'
  targetType: 'all' | 'hostile' | 'player'
  attackRange: number
  stats: { mobsKilled: number; damageDealt: number; damageTaken: number }
}
```

Update the union type:

```typescript
export type ActiveRoutineState = GuardRoutineState | CombatRoutineState
```

### 2. Create Routine Implementation

Create `src/routines/CombatRoutine.ts`:

```typescript
import type { Bot } from 'mineflayer'
import type { Entity } from 'prismarine-entity'
import pkg from 'mineflayer-pathfinder'
const { goals } = pkg
import type { CombatRoutineState } from '../types/routines.js'
import {
  registerListener,
  setActiveRoutine,
  setAttackInterval,
  stopCurrentRoutine,
  updateRoutineStats,
  getActiveRoutine,
} from './RoutineManager.js'

export function startCombatMode(
  bot: Bot,
  targetType: 'all' | 'hostile' | 'player' = 'hostile',
  attackRange: number = 16
): { success: boolean; message: string } {
  // 1. Stop any existing routine
  stopCurrentRoutine(bot)

  // 2. Initialize state
  const state: CombatRoutineState = {
    type: 'combat',
    startedAt: Date.now(),
    targetType,
    attackRange,
    stats: { mobsKilled: 0, damageDealt: 0, damageTaken: 0 }
  }
  setActiveRoutine(state)

  // 3. Set up combat loop
  const combatLoop = setInterval(() => {
    const routine = getActiveRoutine()
    if (!routine || routine.type !== 'combat') {
      clearInterval(combatLoop)
      return
    }
    // Find and attack targets...
  }, 500)
  setAttackInterval(combatLoop)

  // 4. Register event listeners
  registerListener(bot, 'health', () => { /* track damage */ })
  registerListener(bot, 'entityDead', (entity: Entity) => { /* count kills */ })
  registerListener(bot, 'death', () => { bot.pathfinder.stop() })
  registerListener(bot, 'spawn', () => { /* resume after respawn */ })

  return { success: true, message: 'Combat mode started' }
}

export function getCombatStatus(): CombatRoutineState | null {
  const routine = getActiveRoutine()
  return routine?.type === 'combat' ? routine : null
}
```

### 3. Export from Index

In `src/routines/index.ts`:

```typescript
export { startCombatMode, getCombatStatus } from './CombatRoutine.js'
```

### 4. Add MCP Tools

In `src/tools/routines.ts`, add tool registration:

```typescript
server.tool(
  'startCombatMode',
  'Start combat mode: actively seek and attack targets',
  {
    targetType: z.enum(['all', 'hostile', 'player']).optional().default('hostile'),
    attackRange: z.number().optional().default(16),
  },
  async ({ targetType, attackRange }) => {
    if (!botState.isConnected || !botState.bot) {
      return createNotConnectedResponse()
    }
    const result = startCombatMode(botState.bot, targetType, attackRange)
    return createSuccessResponse(result.message)
  }
)
```

### 5. Update getRoutineStatus

Add handling for the new routine type in the `getRoutineStatus` tool.

## Cleanup Integration

Routines are automatically cleaned up:
- On `disconnectFromServer` tool call
- On bot `end` event (kick/connection loss)
- When starting a new routine (stops previous)

Both paths call `onBotDisconnect()` which clears intervals and resets state.

## Combat Mode Implementation Notes

For the combat mode routine, consider:

1. **Target Selection**
   - `hostile`: Attack HOSTILE_MOBS list (already defined in GuardRoutine)
   - `player`: Attack other players (PvP)
   - `all`: Attack any entity except self

2. **Combat Behavior**
   - Use `goals.GoalFollow(target, range)` to chase targets
   - Switch targets when current dies or goes out of range
   - Consider weapon switching (sword vs bow based on distance)

3. **Stats to Track**
   - `mobsKilled` - entities that died after being attacked
   - `damageDealt` - track via `entityHurt` event when bot is attacker
   - `damageTaken` - track via `health` event

4. **Events to Handle**
   - `entitySpawn` - detect new targets
   - `entityGone` - current target disappeared
   - `death` / `spawn` - pause/resume on bot death

## Existing Hostile Mob List

From GuardRoutine.ts:

```typescript
const HOSTILE_MOBS = [
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
  'enderman', 'witch', 'slime', 'magma_cube', 'blaze',
  'ghast', 'wither_skeleton', 'zombie_villager', 'husk',
  'stray', 'phantom', 'drowned', 'pillager', 'vindicator',
  'ravager', 'evoker', 'vex', 'hoglin', 'zoglin',
  'piglin_brute', 'warden'
]
```

Consider extracting this to a shared constants file if combat mode needs it.
