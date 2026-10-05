import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('index.html has the #app mount point', () => {
  expect(readFileSync('index.html', 'utf8')).toContain('<div id="app"></div>')
})
