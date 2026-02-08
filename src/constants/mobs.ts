// Shared constants for hostile mob types
// Used by guard mode and future combat routines

export const HOSTILE_MOBS: readonly string[] = [
    'zombie',
    'skeleton',
    'creeper',
    'spider',
    'cave_spider',
    'enderman',
    'witch',
    'slime',
    'magma_cube',
    'blaze',
    'ghast',
    'wither_skeleton',
    'zombie_villager',
    'husk',
    'stray',
    'phantom',
    'drowned',
    'pillager',
    'vindicator',
    'ravager',
    'evoker',
    'vex',
    'hoglin',
    'zoglin',
    'piglin_brute',
    'warden',
]

export type HostileMob = (typeof HOSTILE_MOBS)[number]

// Combat timing constants
export const BOT_MELEE_ATTACK_RANGE = 4
export const COMBAT_LOOP_INTERVAL_MS = 500
