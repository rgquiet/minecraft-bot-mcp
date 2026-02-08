// Base state for all routines
export interface RoutineState {
  type: string
  startedAt: number
}

// Guard routine specific state
export interface GuardRoutineState extends RoutineState {
  type: 'guard'
  protectedPlayerUsername: string
  attackRange: number
  followDistance: number
  stats: {
    mobsKilled: number
    damageTaken: number
  }
}

// Union type for all routine states
export type ActiveRoutineState = GuardRoutineState

// Tracked event listener for cleanup
export interface TrackedListener {
  event: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => void
}

// State stored in botState.routineManager
export interface RoutineManagerState {
  activeRoutine: ActiveRoutineState | null
  listeners: TrackedListener[]
  attackIntervalId: ReturnType<typeof setInterval> | null
}
