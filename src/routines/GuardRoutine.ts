import type { Bot } from 'mineflayer'
import type { Entity } from 'prismarine-entity'
import pkg from 'mineflayer-pathfinder'
const { goals } = pkg
import type { GuardRoutineState } from '../types/routines.js'
import {
  registerListener,
  setActiveRoutine,
  setAttackInterval,
  stopCurrentRoutine,
  updateRoutineStats,
  getActiveRoutine,
} from './RoutineManager.js'
import {
  HOSTILE_MOBS,
  BOT_MELEE_ATTACK_RANGE,
  COMBAT_LOOP_INTERVAL_MS,
} from '../constants/mobs.js'

// Track entities that the bot has attacked (for accurate kill counting)
let attackedEntities: Set<number> = new Set()

// Find the nearest hostile mob within range of a position
function findNearestHostileMob(
  bot: Bot,
  centerEntity: Entity,
  range: number
): Entity | null {
  let nearestMob: Entity | null = null
  let nearestDistance = range + 1

  for (const entity of Object.values(bot.entities)) {
    if (!entity || !entity.position || !entity.name) continue

    // Check if it's a hostile mob
    if (!HOSTILE_MOBS.includes(entity.name)) continue

    // Calculate distance from the protected player (or center position)
    const distance = entity.position.distanceTo(centerEntity.position)

    if (distance <= range && distance < nearestDistance) {
      nearestMob = entity
      nearestDistance = distance
    }
  }

  return nearestMob
}

// Find player entity by username
function findPlayerByUsername(bot: Bot, username: string): Entity | null {
  for (const entity of Object.values(bot.entities)) {
    if (entity.type === 'player' && entity.username === username) {
      return entity
    }
  }
  return null
}

// Start guard mode
export function startGuardMode(
  bot: Bot,
  playerUsername: string,
  attackRange: number = 16,
  followDistance: number = 4
): { success: boolean; message: string } {
  // Stop any existing routine first
  stopCurrentRoutine(bot)

  // Find the player to protect
  const playerEntity = findPlayerByUsername(bot, playerUsername)
  if (!playerEntity) {
    return {
      success: false,
      message: `Player '${playerUsername}' not found nearby. Make sure they are in visual range.`,
    }
  }

  // Initialize guard routine state
  const guardState: GuardRoutineState = {
    type: 'guard',
    startedAt: Date.now(),
    protectedPlayerUsername: playerUsername,
    attackRange,
    followDistance,
    stats: {
      mobsKilled: 0,
      damageTaken: 0,
    },
  }
  setActiveRoutine(guardState)

  // Track previous health for damage detection
  let previousHealth = bot.health

  // Reset attacked entities tracking for this routine
  attackedEntities = new Set()

  // Start following the player
  bot.pathfinder.setGoal(new goals.GoalFollow(playerEntity, followDistance))

  // Set up attack loop
  const attackLoop = setInterval(() => {
    const routine = getActiveRoutine()
    if (!routine || routine.type !== 'guard') {
      clearInterval(attackLoop)
      return
    }

    // Re-find player in case entity changed
    const protectedPlayer = findPlayerByUsername(
      bot,
      routine.protectedPlayerUsername
    )
    if (!protectedPlayer) {
      // Player went out of range, keep trying to find them
      return
    }

    // Update follow goal to keep tracking the player
    bot.pathfinder.setGoal(
      new goals.GoalFollow(protectedPlayer, routine.followDistance)
    )

    // Find and attack nearest hostile mob
    const hostileMob = findNearestHostileMob(
      bot,
      protectedPlayer,
      routine.attackRange
    )
    if (hostileMob) {
      // Check if mob is within bot's melee attack range
      const distanceToMob = bot.entity.position.distanceTo(hostileMob.position)
      if (distanceToMob <= BOT_MELEE_ATTACK_RANGE) {
        try {
          bot.attack(hostileMob)
          // Track this entity for accurate kill counting
          attackedEntities.add(hostileMob.id)
        } catch {
          // Ignore attack errors (entity may have died)
        }
      }
    }
  }, COMBAT_LOOP_INTERVAL_MS)

  setAttackInterval(attackLoop)

  // Register health change listener to track damage
  registerListener(bot, 'health', () => {
    const currentHealth = bot.health
    if (currentHealth < previousHealth) {
      const damage = previousHealth - currentHealth
      updateRoutineStats({ damageTaken: damage })
    }
    previousHealth = currentHealth
  })

  // Register entity dead listener to count mob kills (only count entities we attacked)
  registerListener(bot, 'entityDead', (entity: Entity) => {
    if (entity && attackedEntities.has(entity.id)) {
      updateRoutineStats({ mobsKilled: 1 })
      attackedEntities.delete(entity.id)
    }
  })

  // Handle bot death - pause attack but maintain routine
  registerListener(bot, 'death', () => {
    bot.pathfinder.stop()
  })

  // Handle respawn - resume guard behavior
  registerListener(bot, 'spawn', () => {
    const routine = getActiveRoutine()
    if (routine && routine.type === 'guard') {
      const player = findPlayerByUsername(bot, routine.protectedPlayerUsername)
      if (player) {
        bot.pathfinder.setGoal(
          new goals.GoalFollow(player, routine.followDistance)
        )
      }
    }
  })

  return {
    success: true,
    message: `Guard mode started. Protecting ${playerUsername} (attack range: ${attackRange} blocks, follow distance: ${followDistance} blocks)`,
  }
}

// Get guard routine status
export function getGuardStatus(): GuardRoutineState | null {
  const routine = getActiveRoutine()
  if (routine && routine.type === 'guard') {
    return routine
  }
  return null
}
