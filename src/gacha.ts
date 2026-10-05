// Stub for GACHA-1 03-SKENARIO BUILDING: signatures only, filled in 04-DEVELOPMENT CODE.
export type Rarity = 3 | 4 | 5 | 6

export interface Session {
  budget: number | null
  spent: number
  pity: number
  totalPulls: number
  count6: number
  count5: number
}

export interface PullResult {
  rarity: Rarity
  pullNumber: number
  pullsTo6: number | null
}

export interface Rates {
  r6: number
  r5: number
  r4: number
  r3: number
}

export const PRICE_PER_PULL = 0
export const AVG_PULLS_TO_6 = 0
export const AVG_COST_TO_6 = 0

const todo = (): never => {
  throw new Error('not implemented')
}

export const newSession = (_budget: number | null = 500_000): Session => todo()
// pity = pulls without a 6★ so far. From pull 51 the 6★ rate rises 2% per pull, reaching 100% at pull 99.
// The rest is split 8:50:40 across 5★, 4★, 3★ (decided 2026-10-05, option A).
export const rates = (pity: number): Rates => {
  const next = pity + 1
  const r6 = Math.min(1, next <= 50 ? 0.02 : 0.02 + 0.02 * (next - 50))
  const rest = 1 - r6
  return { r6, r5: (rest * 8) / 98, r4: (rest * 50) / 98, r3: (rest * 40) / 98 }
}
export const pull = (_s: Session, _count: 1 | 10, _rng: () => number): { session: Session; results: PullResult[] } => todo()
export const expectedPullsTo6 = (): number => todo()
export const overBudget = (_s: Session, _count: 1 | 10): number => todo()
