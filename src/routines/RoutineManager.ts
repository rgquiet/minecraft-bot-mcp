import type { Bot } from 'mineflayer'
import { botState } from '../server.js'
import type {
  ActiveRoutineState,
  RoutineManagerState,
  TrackedListener,
} from '../types/routines.js'

// Get or initialize routine manager state in botState
function getManagerState(): RoutineManagerState {
  if (!botState.routineManager) {
    botState.routineManager = {
      activeRoutine: null,
      listeners: [],
      attackIntervalId: null,
    }
  }
  return botState.routineManager as RoutineManagerState
}

// Register an event listener and track it for cleanup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerListener(
  bot: Bot,
  event: string,
  handler: (...args: any[]) => void
): void {
  const state = getManagerState()
  bot.on(event as any, handler as any)
  state.listeners.push({ event, handler })
}

// Remove all registered listeners
export function cleanupListeners(bot: Bot): void {
  const state = getManagerState()
  for (const listener of state.listeners) {
    bot.removeListener(listener.event as any, listener.handler as any)
  }
  state.listeners = []
}

// Clear the attack interval if running
export function clearAttackInterval(): void {
  const state = getManagerState()
  if (state.attackIntervalId) {
    clearInterval(state.attackIntervalId)
    state.attackIntervalId = null
  }
}

// Set the attack interval
export function setAttackInterval(
  intervalId: ReturnType<typeof setInterval>
): void {
  const state = getManagerState()
  state.attackIntervalId = intervalId
}

// Get current active routine state
export function getActiveRoutine(): ActiveRoutineState | null {
  const state = getManagerState()
  return state.activeRoutine
}

// Set active routine state
export function setActiveRoutine(routine: ActiveRoutineState | null): void {
  const state = getManagerState()
  state.activeRoutine = routine
}

// Stop current routine and clean up
export function stopCurrentRoutine(bot: Bot): void {
  clearAttackInterval()
  cleanupListeners(bot)
  bot.pathfinder.stop()
  setActiveRoutine(null)
}

// Full cleanup on bot disconnect
export function onBotDisconnect(): void {
  const state = getManagerState()

  // Clear interval without needing bot reference
  if (state.attackIntervalId) {
    clearInterval(state.attackIntervalId)
    state.attackIntervalId = null
  }

  // Reset all state
  state.activeRoutine = null
  state.listeners = []
}

// Check if a routine is active
export function isRoutineActive(): boolean {
  const state = getManagerState()
  return state.activeRoutine !== null
}

// Update routine stats (for guard mode)
export function updateRoutineStats(
  update: Partial<{ mobsKilled: number; damageTaken: number }>
): void {
  const state = getManagerState()
  if (state.activeRoutine && state.activeRoutine.type === 'guard') {
    if (update.mobsKilled !== undefined) {
      state.activeRoutine.stats.mobsKilled += update.mobsKilled
    }
    if (update.damageTaken !== undefined) {
      state.activeRoutine.stats.damageTaken += update.damageTaken
    }
  }
}
