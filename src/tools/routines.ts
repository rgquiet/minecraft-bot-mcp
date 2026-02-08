import { z } from 'zod'
import { botState, server } from '../server.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'
import {
  startGuardMode,
  getActiveRoutine,
  stopCurrentRoutine,
  isRoutineActive,
} from '../routines/index.js'

// Register routine-related MCP tools
export function registerRoutineTools() {
  // Start guard mode tool
  server.tool(
    'startGuardMode',
    'Start guard mode: protect a player by following them and attacking hostile mobs within range',
    {
      playerUsername: z
        .string()
        .describe('Username of the player to protect'),
      attackRange: z
        .number()
        .optional()
        .default(16)
        .describe('Range in blocks to detect and attack hostile mobs (default: 16)'),
      followDistance: z
        .number()
        .optional()
        .default(4)
        .describe('Distance in blocks to maintain while following the player (default: 4)'),
    },
    async ({ playerUsername, attackRange, followDistance }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const result = startGuardMode(
          botState.bot,
          playerUsername,
          attackRange,
          followDistance
        )

        if (result.success) {
          return createSuccessResponse(result.message)
        } else {
          return createSuccessResponse(result.message)
        }
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Stop current routine tool
  server.tool(
    'stopRoutine',
    'Stop the currently active routine (guard mode, etc.)',
    {},
    async () => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        if (!isRoutineActive()) {
          return createSuccessResponse('No routine is currently active.')
        }

        const routine = getActiveRoutine()
        const routineType = routine?.type || 'unknown'

        stopCurrentRoutine(botState.bot)

        return createSuccessResponse(
          `Stopped ${routineType} routine. Bot is now idle.`
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Get routine status tool
  server.tool(
    'getRoutineStatus',
    'Get the status of the currently active routine, including statistics',
    {},
    async () => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const routine = getActiveRoutine()

        if (!routine) {
          return createSuccessResponse('No routine is currently active.')
        }

        const runningTime = Math.floor((Date.now() - routine.startedAt) / 1000)
        const minutes = Math.floor(runningTime / 60)
        const seconds = runningTime % 60

        if (routine.type === 'guard') {
          const status = [
            `Active Routine: Guard Mode`,
            `Protected Player: ${routine.protectedPlayerUsername}`,
            `Attack Range: ${routine.attackRange} blocks`,
            `Follow Distance: ${routine.followDistance} blocks`,
            `Running Time: ${minutes}m ${seconds}s`,
            ``,
            `Statistics:`,
            `- Mobs Killed: ${routine.stats.mobsKilled}`,
            `- Damage Taken: ${routine.stats.damageTaken.toFixed(1)} HP`,
          ].join('\n')

          return createSuccessResponse(status)
        }

        // Generic routine status (for future routine types)
        return createSuccessResponse(
          `Active Routine: ${routine.type}\nRunning Time: ${minutes}m ${seconds}s`
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
