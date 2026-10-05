// GACHA-1: money tests (workflow 5.11), adapted for a simulated budget. Always committed.
import { expect, test } from 'vitest'
import { PRICE_PER_PULL, newSession, overBudget, pull } from './gacha'

// Rule 3: the same command on the same session charges once, never twice.
test('pulling from the same session snapshot charges once per call', () => {
  const s = newSession(500_000)
  const a = pull(s, 10, () => 0.5).session
  const b = pull(s, 10, () => 0.5).session
  expect(s.spent).toBe(0)
  expect(a.spent).toBe(80_000)
  expect(b.spent).toBe(80_000)
})

// Rule 2: spent always equals pulls times price, in whole rupiah.
test('spent equals totalPulls times price after 100 mixed pull actions', () => {
  let s = newSession(500_000)
  for (let i = 0; i < 100; i++) s = pull(s, i % 2 ? 10 : 1, Math.random).session
  expect(s.totalPulls).toBe(50 * 10 + 50 * 1)
  expect(s.spent).toBe(s.totalPulls * PRICE_PER_PULL)
  expect(Number.isInteger(s.spent)).toBe(true)
})

// Replaces "concurrent withdrawals": checking the budget never charges anything.
test('budget check does not change the session', () => {
  const s = { ...newSession(500_000), spent: 464_000 }
  const before = structuredClone(s)
  expect(overBudget(s, 10)).toBe(44_000)
  expect(s).toEqual(before)
})
