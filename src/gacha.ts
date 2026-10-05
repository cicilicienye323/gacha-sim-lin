// Gacha rules: rates, pity, cost. Pure, no DOM; randomness comes in as a parameter.
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
  roll: number // position inside the rarity band, [0, 1)
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

export const newSession = (budget: number | null = 500_000): Session => ({
  budget,
  spent: 0,
  pity: 0,
  totalPulls: 0,
  count6: 0,
  count5: 0,
})

// Also returns where r falls inside its rarity band, so callers can pick within a pool
// without drawing another random number.
const pickRarity = (pity: number, r: number): { rarity: Rarity; roll: number } => {
  const { r6, r5, r4 } = rates(pity)
  const bands: [Rarity, number][] = [[6, r6], [5, r5], [4, r4]]
  let lo = 0
  for (const [rarity, width] of bands) {
    if (r < lo + width) return { rarity, roll: (r - lo) / width }
    lo += width
  }
  return { rarity: 3, roll: (r - lo) / (1 - lo) }
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
    const { rarity, roll } = pickRarity(session.pity, rng())
    session.totalPulls++
    results.push({ rarity, roll, pullNumber: session.totalPulls, pullsTo6: rarity === 6 ? session.pity + 1 : null })
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
// Rupiah the action would go over budget by; 0 when it fits or there is no budget.
export const overBudget = (s: Session, count: 1 | 10): number =>
  s.budget === null ? 0 : Math.max(0, s.spent + count * PRICE_PER_PULL - s.budget)
