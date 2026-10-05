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
  type Session,
} from './gacha'

const MAX_BUDGET = 100_000_000
const CARD_MS = 1000 // 10 cards + one 6★ pause + last flip = 13.7 s, under the 14 s limit (AC-9)
const HERO_MS = 2500
const STARS = { 3: '★★★', 4: '★★★★', 5: '★★★★★', 6: '★★★★★★' } as const

const rp = (n: number) => (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID')
const pct = (x: number) => (x * 100).toFixed(2).replace('.', ',') + '%'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="screen">
  <h1>GACHA SIM</h1>
  <p class="sub">Simulasi headhunting gaya Arknights. Uangnya pura-pura, peluangnya sungguhan.</p>
  <div class="layout">
    <div class="main">
      <div class="stage" id="stage"><div class="empty">Tekan Pull untuk mulai</div></div>
      <div class="actions">
        <button class="btn" id="pull1">Pull x1 <small>${rp(PRICE_PER_PULL)}</small></button>
        <button class="btn primary" id="pull10">Pull x10 <small>${rp(PRICE_PER_PULL * 10)}</small></button>
        <span class="spacer"></span>
        <button class="btn ghost" id="reset">Reset sesi</button>
      </div>
    </div>
    <div class="side">
      <div class="panel">
        <h3>Budget</h3>
        <label class="field">Rp <input id="budget" aria-label="Budget" inputmode="numeric" value="500000"></label>
        <div class="stat"><span>Terpakai</span><b data-testid="spent"></b></div>
        <div class="stat"><span>Sisa</span><b data-testid="remaining"></b></div>
      </div>
      <div class="panel">
        <h3>Pity</h3>
        <div class="stat"><span>Tanpa 6★</span><b data-testid="pity"></b></div>
        <div class="bar" data-testid="pity-bar"><span></span><i></i></div>
        <div class="bar-cap"><span>0</span><span>50</span><span>99</span></div>
      </div>
      <div class="panel">
        <h3>Peluang pull berikutnya</h3>
        <div class="rate" id="rate-6-row"><span class="s6">${STARS[6]}</span><b data-testid="rate-6"></b></div>
        <div class="rate"><span class="s5">${STARS[5]}</span><b data-testid="rate-5"></b></div>
        <div class="rate"><span class="s4">${STARS[4]}</span><b data-testid="rate-4"></b></div>
        <div class="rate"><span class="s3">${STARS[3]}</span><b data-testid="rate-3"></b></div>
      </div>
      <div class="panel">
        <h3>Ringkasan sesi</h3>
        <div class="stat"><span>Total pull</span><b data-testid="total-pulls"></b></div>
        <div class="stat"><span class="s6">6★</span><b data-testid="count-6"></b></div>
        <div class="stat"><span class="s5">5★</span><b data-testid="count-5"></b></div>
      </div>
      <div class="panel">
        <h3>Rata-rata dapat 6★</h3>
        <div class="stat big"><span data-testid="avg-pulls">${String(AVG_PULLS_TO_6).replace('.', ',')} pull</span><b data-testid="avg-cost">${rp(AVG_COST_TO_6)}</b></div>
      </div>
    </div>
  </div>
</div>
<dialog id="warn">
  <h2>Melewati budget</h2>
  <div class="stat"><span id="warn-label"></span><b id="warn-cost"></b></div>
  <div class="stat"><span>Sisa budget</span><b id="warn-left"></b></div>
  <div class="stat over"><span>Lewat budget</span><b data-testid="over"></b></div>
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

const cardHtml = (r: PullResult) =>
  `<div class="card c${r.rarity}" data-testid="card" data-open="false"><span class="st s${r.rarity}">${STARS[r.rarity]}</span><span class="nm">Operator ${r.rarity}★</span></div>`

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
  stage.innerHTML = `<div class="cards">${results.map(cardHtml).join('')}</div>
    <div class="skip"><button class="btn ghost small" id="skip">Lewati ⏭</button></div>`
  const cards = [...stage.querySelectorAll<HTMLElement>('.card')]
  let skipped = false
  const finish = () => {
    stage.querySelector('.hero')?.remove()
    cards.forEach((c) => (c.dataset.open = 'true'))
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
      stage.insertAdjacentHTML('beforeend', `<div class="hero" data-testid="hero">${cardHtml(r).replace('data-open="false"', 'data-open="true"').replace(' data-testid="card"', '')}
        <p>6★ di pull ke-${r.pullNumber}. Biaya sampai dapat: ${rp(r.pullsTo6! * PRICE_PER_PULL)}</p></div>`)
      await sleep(HERO_MS)
      if (skipped) return
      stage.querySelector('.hero')?.remove()
    }
    cards[i].dataset.open = 'true'
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
  stage.innerHTML = '<div class="empty">Tekan Pull untuk mulai</div>'
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
