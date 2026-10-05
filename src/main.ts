import './style.css'
import {
  AVG_COST_TO_6,
  AVG_PULLS_TO_6,
  PRICE_PER_PULL,
  newSession,
  overBudget,
  pull,
  rates,
  type PullResult,
  type Rarity,
  type Session,
} from './gacha'
import { TIERS, pokemonFor } from './pokemon'

const MAX_BUDGET = 100_000_000
const CARD_MS = 1000 // 10 cards + one 6★ pause + last flip = 13.7 s, under the 14 s limit (AC-9)
const HERO_MS = 2500
const STARS = { 3: '★★★', 4: '★★★★', 5: '★★★★★', 6: '★★★★★★' } as const
const EMPTY = '<div class="empty"><span class="hint">Lempar Poké Ball untuk mulai!</span></div>'

const rp = (n: number) => (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID')
const pct = (x: number) => (x * 100).toFixed(2).replace('.', ',') + '%'

// Images may be missing (public/pokemon/ is gitignored): a failed <img> removes itself, text stays.
const IMG_FALLBACK = 'onerror="this.remove()"'
const BALL = `<img class="ball" src="/pokemon/pokeball.png" alt="" ${IMG_FALLBACK}>`
const tierChip = (r: Rarity) => `<span class="tierchip t${r}">${STARS[r]} ${TIERS[r]}</span>`

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="screen">
  <h1 class="logo">${BALL}GACHA SIM</h1>
  <p class="sub">Lempar Poké Ball, kumpulkan Pokémon, dan lihat berapa biayanya sampai dapat Legendary.</p>
  <div class="layout">
    <div class="main">
      <div class="dex">
        <div class="dex-top"><span class="lens"></span><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="dex-title">POKÉDEX GACHA</span></div>
        <div class="stage" id="stage">${EMPTY}</div>
      </div>
      <div class="actions">
        <button class="btn" id="pull1">${BALL}<span>Pull x1 <small>${rp(PRICE_PER_PULL)}</small></span></button>
        <button class="btn primary" id="pull10">${BALL}<span>Pull x10 <small>${rp(PRICE_PER_PULL * 10)}</small></span></button>
        <span class="spacer"></span>
        <button class="btn ghost" id="reset">Reset sesi</button>
      </div>
    </div>
    <div class="side">
      <div class="panel"><h3>Budget</h3><div class="body">
        <label class="field">Rp <input id="budget" aria-label="Budget" inputmode="numeric" value="500000"></label>
        <div class="stat"><span>Terpakai</span><b data-testid="spent"></b></div>
        <div class="stat"><span>Sisa</span><b data-testid="remaining"></b></div>
      </div></div>
      <div class="panel"><h3>Pity</h3><div class="body">
        <div class="stat"><span>Tanpa Legendary</span><b data-testid="pity"></b></div>
        <div class="hp"><span class="lbl">HP</span><div class="bar" data-testid="pity-bar"><span></span><i></i></div></div>
        <div class="bar-cap"><span>0</span><span>50</span><span>99</span></div>
      </div></div>
      <div class="panel"><h3>Peluang pull berikutnya</h3><div class="body">
        <div class="rate" id="rate-6-row">${tierChip(6)}<b data-testid="rate-6"></b></div>
        <div class="rate">${tierChip(5)}<b data-testid="rate-5"></b></div>
        <div class="rate">${tierChip(4)}<b data-testid="rate-4"></b></div>
        <div class="rate">${tierChip(3)}<b data-testid="rate-3"></b></div>
      </div></div>
      <div class="panel"><h3>Ringkasan sesi</h3><div class="body">
        <div class="stat"><span>Total pull</span><b data-testid="total-pulls"></b></div>
        <div class="stat"><span>Legendary</span><b data-testid="count-6"></b></div>
        <div class="stat"><span>Rare</span><b data-testid="count-5"></b></div>
      </div></div>
      <div class="panel"><h3>Rata-rata dapat Legendary</h3><div class="body">
        <div class="stat big"><span data-testid="avg-pulls">${String(AVG_PULLS_TO_6).replace('.', ',')} pull</span><b data-testid="avg-cost">${rp(AVG_COST_TO_6)}</b></div>
      </div></div>
    </div>
  </div>
</div>
<dialog id="warn">
  <h2>Melewati budget</h2>
  <div class="stat"><span id="warn-label"></span><b id="warn-cost"></b></div>
  <div class="stat"><span>Sisa budget</span><b id="warn-left"></b></div>
  <div class="stat over"><span>Lewat budget</span><b data-testid="over"></b></div>
  <p class="ask">Tetap lempar Poké Ball?</p>
  <div class="actions">
    <button class="btn" id="cancel">Batal</button>
    <span class="spacer"></span>
    <button class="btn primary" id="confirm">Tetap pull</button>
  </div>
</dialog>`

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const tid = (id: string) => $(`[data-testid="${id}"]`)
const stage = $('#stage')
const budgetInput = $<HTMLInputElement>('#budget')
const dialog = $<HTMLDialogElement>('#warn')
const buttons = [$<HTMLButtonElement>('#pull1'), $<HTMLButtonElement>('#pull10'), $<HTMLButtonElement>('#reset')]

let session = newSession()
let shown = session // what the side panel shows; lags behind `session` while cards open
let pendingCount: 1 | 10 = 1
let skip: (() => void) | null = null

function renderSide() {
  const s = shown
  tid('spent').textContent = rp(s.spent)
  const remaining = tid('remaining')
  remaining.textContent = s.budget === null ? '—' : rp(s.budget - s.spent)
  remaining.classList.toggle('neg', s.budget !== null && s.budget < s.spent)
  tid('pity').textContent = `${s.pity} / 99`
  const hot = s.pity >= 50
  tid('pity-bar').dataset.hot = String(hot)
  $('[data-testid="pity-bar"] span').style.width = `${(s.pity / 99) * 100}%`
  $('#rate-6-row').classList.toggle('hot', hot)
  const r = rates(s.pity)
  tid('rate-6').textContent = pct(r.r6)
  tid('rate-5').textContent = pct(r.r5)
  tid('rate-4').textContent = pct(r.r4)
  tid('rate-3').textContent = pct(r.r3)
  tid('total-pulls').textContent = String(s.totalPulls)
  tid('count-6').textContent = String(s.count6)
  tid('count-5').textContent = String(s.count5)
}

const closedCard = (r: PullResult) => `<div class="card c${r.rarity}" data-testid="card" data-open="false">${BALL}</div>`

// Legendary uses full artwork as background; other tiers use a sprite <img>.
const faceHtml = (r: PullResult) => {
  const p = pokemonFor(r.rarity, r.roll)
  const pic = r.rarity === 6
    ? `<div class="art" data-art="${p.img}" style="background-image:url(${p.img})"></div>`
    : `<img src="${p.img}" alt="" ${IMG_FALLBACK}>`
  return `<div class="face">${pic}<span class="nm">${p.name}</span>${tierChip(r.rarity)}</div>`
}

const openCard = (el: HTMLElement, r: PullResult) => {
  if (el.dataset.open === 'true') return
  el.innerHTML = faceHtml(r)
  el.dataset.open = 'true'
}

const setBusy = (busy: boolean) => buttons.forEach((b) => (b.disabled = busy))

// Sleeps, but wakes early when Lewati is pressed.
let wake: (() => void) | null = null
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    wake = () => { clearTimeout(t); resolve() }
  })

async function reveal(results: PullResult[]) {
  setBusy(true)
  stage.innerHTML = `<div class="cards">${results.map(closedCard).join('')}</div>
    <div class="skip"><button class="btn ghost small" id="skip">Lewati ⏭</button></div>`
  const cards = [...stage.querySelectorAll<HTMLElement>('.card')]
  let skipped = false
  const finish = () => {
    stage.querySelector('.hero')?.remove()
    cards.forEach((c, i) => openCard(c, results[i]))
    $('.skip').dataset.done = 'true'
    skip = null
    shown = session
    renderSide()
    setBusy(false)
  }
  stage.classList.remove('skipped')
  skip = () => { skipped = true; stage.classList.add('skipped'); wake?.(); finish() }

  for (let i = 0; i < results.length; i++) {
    await sleep(CARD_MS)
    if (skipped) return
    const r = results[i]
    if (r.rarity === 6) {
      stage.insertAdjacentHTML('beforeend', `<div class="hero" data-testid="hero"><div class="card c6" data-open="true">${faceHtml(r)}</div>
        <p>6★ di pull ke-${r.pullNumber}. Biaya sampai dapat: ${rp(r.pullsTo6! * PRICE_PER_PULL)}</p></div>`)
      await sleep(HERO_MS)
      if (skipped) return
      stage.querySelector('.hero')?.remove()
    }
    openCard(cards[i], r)
  }
  finish()
}

function doPull(count: 1 | 10) {
  const out = pull(session, count, Math.random)
  session = out.session
  void reveal(out.results)
}

function onPull(count: 1 | 10) {
  const over = overBudget(session, count)
  if (over === 0) return doPull(count)
  pendingCount = count
  $('#warn-label').textContent = `Pull x${count}`
  $('#warn-cost').textContent = rp(count * PRICE_PER_PULL)
  $('#warn-left').textContent = rp(session.budget! - session.spent)
  tid('over').textContent = rp(over)
  dialog.showModal()
}

$('#pull1').addEventListener('click', () => onPull(1))
$('#pull10').addEventListener('click', () => onPull(10))
$('#cancel').addEventListener('click', () => dialog.close())
$('#confirm').addEventListener('click', () => { dialog.close(); doPull(pendingCount) })
stage.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('#skip')) skip?.() })

$('#reset').addEventListener('click', () => {
  session = shown = newSession(session.budget)
  stage.innerHTML = EMPTY
  renderSide()
})

// Budget: whole rupiah 0..100.000.000, empty = no budget. Anything else keeps the old value.
budgetInput.addEventListener('input', () => {
  const v = budgetInput.value.trim()
  if (v !== '' && !(/^\d+$/.test(v) && Number(v) <= MAX_BUDGET)) return
  session.budget = shown.budget = v === '' ? null : Number(v)
  renderSide()
})
budgetInput.addEventListener('change', () => {
  budgetInput.value = session.budget === null ? '' : String(session.budget)
})

renderSide()
