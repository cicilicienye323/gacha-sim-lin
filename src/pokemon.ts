// Pokémon per rarity. Images live in public/pokemon/ (gitignored, collected from Pinterest).
import type { Rarity } from './gacha'

export interface Pokemon {
  name: string
  img: string
}

const p = (name: string, file: string): Pokemon => ({ name, img: `/pokemon/${file}` })

export const TIERS: Record<Rarity, string> = { 3: 'Common', 4: 'Uncommon', 5: 'Rare', 6: 'Legendary' }

export const POOLS: Record<Rarity, Pokemon[]> = {
  3: [p('Pikachu', 'pikachu.png'), p('Squirtle', 'squirtle.png'), p('Charmander', 'charmander.png'), p('Mimikyu', 'mimikyu.png')],
  4: [p('Leafeon', 'leafeon.png'), p('Flareon', 'flareon.png'), p('Sylveon', 'sylveon.png'), p('Espeon', 'espeon.png'), p('Umbreon', 'umbreon.png')],
  5: [p('Mew', 'mew.png'), p('Charizard', 'charizard.png'), p('Gengar', 'gengar.png')],
  6: [p('Rayquaza', 'rayquaza.jpg'), p('Groudon', 'groudon.jpg'), p('Lugia', 'lugia.jpg'), p('Rayquaza Hitam', 'rayquaza-black.jpg')],
}

export const pokemonFor = (rarity: Rarity, roll: number): Pokemon => {
  const pool = POOLS[rarity]
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))]
}
