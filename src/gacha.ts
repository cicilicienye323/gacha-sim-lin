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

export const PRICE_PER_PULL = 8_000 // rupiah, integer
// Fixed display values; a test checks them against expectedPullsTo6().
export const AVG_PULLS_TO_6 = 34.59
export const AVG_COST_TO_6 = 276_756

const todo = (): never => {
  throw new Error('not implemented')
}

export const newSession = (budget: number | null = 500_000): Session => ({
  budget,
  spent: 0,
  pity: 0,
  totalPulls: 0,
  count6: 0,
  count5: 0,
})

const pickRarity = (pity: number, r: number): Rarity => {
  const { r6, r5, r4 } = rates(pity)
  if (r < r6) return 6
  if (r < r6 + r5) return 5
  if (r < r6 + r5 + r4) return 4
  return 3
}
// pity = pulls without a 6★ so far. From pull 51 the 6★ rate rises 2% per pull, reaching 100% at pull 99.
// The rest is split 8:50:40 across 5★, 4★, 3★ (decided 2026-10-05, option A).
export const rates = (pity: number): Rates => {
  const next = pity + 1
  const r6 = Math.min(1, next <= 50 ? 0.02 : 0.02 + 0.02 * (next - 50))
  const rest = 1 - r6
  return { r6, r5: (rest * 8) / 98, r4: (rest * 50) / 98, r3: (rest * 40) / 98 }
}
// Returns a new session; the input is never mutated.
export const pull = (s: Session, count: 1 | 10, rng: () => number): { session: Session; results: PullResult[] } => {
  const session = { ...s, spent: s.spent + count * PRICE_PER_PULL }
  const results: PullResult[] = []
  for (let i = 0; i < count; i++) {
    const rarity = pickRarity(session.pity, rng())
    session.totalPulls++
    results.push({ rarity, pullNumber: session.totalPulls, pullsTo6: null })
    if (rarity === 6) {
      session.count6++
      session.pity = 0
    } else {
      session.pity++
      if (rarity === 5) session.count5++
    }
  }
  return { session, results }
}
// Exact expectation: sum of n × P(first 6★ on pull n), n = 1..99.
export const expectedPullsTo6 = (): number => {
  let noSixYet = 1
  let expected = 0
  for (let pity = 0; pity < 99; pity++) {
    const { r6 } = rates(pity)
    expected += (pity + 1) * noSixYet * r6
    noSixYet *= 1 - r6
  }
  return expected
}
export const overBudget = (_s: Session, _count: 1 | 10): number => todo()
