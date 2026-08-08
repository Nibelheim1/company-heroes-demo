import './styles.css'
import { questions, DIMENSIONS } from './quiz-data.js'
import { calculate, buildTeamProfile } from './profile-engine.js'

const app = document.querySelector('#app')
const STORAGE_KEY = 'ths-heroes-full-v1'
const state = {
  heroes: [], screen: 'home', loading: true, error: '',
  answers: [], quizIndex: 0, result: null, detail: null,
  search: '', pool: '全部', archetype: '全部', visible: 40,
  team: [], friendView: false, battleDay: 2, toast: '',
}

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
const imageUrl = path => path?.startsWith('/') ? `.${path}` : path
const heroByCode = code => state.heroes.find(hero => hero.code === String(code))
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: state.answers, team: state.team, result: state.result, screen: state.screen }))
const restore = () => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved) Object.assign(state, { answers: saved.answers || [], team: saved.team || [], result: saved.result || null }) } catch {} }
const go = (screen, options = {}) => { Object.assign(state, options, { screen }); window.scrollTo({ top: 0, behavior: 'smooth' }); save(); render() }
const toast = message => { state.toast = message; render(); setTimeout(() => { state.toast = ''; render() }, 1800) }
const copyText = async text => { try { await navigator.clipboard.writeText(text); toast('分享文案已复制') } catch { window.prompt('复制这段文案', text) } }
const share = async (title, text) => { if (navigator.share) { try { await navigator.share({ title, text, url: location.href }) } catch {} } else copyText(text) }

const nav = () => `<nav class="bottom-nav" aria-label="主导航">
  ${[['home','发现','✦'],['heroes','群英录','◈'],['team','组队','⚔']].map(([id,label,icon]) => `<button data-action="go" data-screen="${id}" class="${state.screen===id?'active':''}"><span>${icon}</span>${label}</button>`).join('')}
</nav>`

const portrait = (hero, className = 'portrait', thumb = true) => `<img class="${className}" src="${imageUrl(thumb ? hero.thumbnailPath : hero.imagePath)}" alt="${escapeHtml(hero.name)}英雄立绘" ${thumb?'loading="lazy" decoding="async"':''}>`
const heroCard = (hero, compact = false) => `<article class="hero-card ${compact?'compact':''}" data-action="detail" data-code="${hero.code}">
  <div class="hero-card-art">${portrait(hero, 'hero-card-image')}<span class="pool-chip">${escapeHtml(hero.pool)}</span></div>
  <div class="hero-card-copy"><span class="role">${escapeHtml(hero.archetype)}</span><h3>${escapeHtml(hero.name)}</h3><p>${escapeHtml(hero.mission)}</p><div class="hero-tags">${(hero.strengths||[]).slice(0,2).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div></div>
</article>`

const shell = content => `<div class="app-shell">${content}${['quiz','result','detail','lobby','battle'].includes(state.screen)?'':nav()}${state.toast?`<div class="toast">${escapeHtml(state.toast)}</div>`:''}</div>`

function renderLoading() {
  app.innerHTML = shell(`<main class="loading-screen"><div class="logo-mark">TH</div><h1>英雄正在集结</h1><div class="loading-bar"><i></i></div><p>正在读取320位公司英雄与立绘资料……</p></main>`)
}

function renderHome() {
  const featured = state.heroes.filter(h => ['300750','600519','688256'].includes(h.code));
  const picks = featured.length === 3 ? featured : state.heroes.slice(0,3)
  const resume = state.result ? `<button class="resume-card" data-action="go" data-screen="result"><span>继续查看</span><strong>${escapeHtml(state.result.title)}</strong><small>你的经营人格与契合英雄 →</small></button>` : ''
  app.innerHTML = shell(`<main>
    <header class="home-hero"><div class="noise"></div><div class="topline"><b>同花顺英雄</b><span>COMPANY HEROES · FULL H5</span></div>
      <div class="hero-stage"><div class="hero-copy"><span class="eyebrow">320 A-SHARE HEROES</span><h1>如果公司都有灵魂，<br>你会和谁并肩作战？</h1><p>16道经营抉择，找到与你做事方式最契合的公司英雄；组建3—5人战队，与朋友开启盲选PK。</p><div class="cta-row"><button class="btn primary" data-action="start-quiz">开始人格测试</button><button class="btn glass" data-action="go" data-screen="heroes">浏览群英录</button></div></div>
      <div class="featured-stack">${picks.map((h,i)=>`<button class="featured-card f${i}" data-action="detail" data-code="${h.code}">${portrait(h,'featured-image')}<span>${escapeHtml(h.name)}</span></button>`).join('')}</div></div>
    </header>
    <section class="home-body">${resume}<div class="metrics"><div><strong>320</strong><span>位英雄</span></div><div><strong>16×3</strong><span>场景选择</span></div><div><strong>8</strong><span>人格维度</span></div><div><strong>3—5</strong><span>人盲选战队</span></div></div>
      <div class="section-heading"><div><span class="eyebrow dark">HEROES IN FOCUS</span><h2>先认识几位英雄</h2></div><button data-action="go" data-screen="heroes">查看全部 →</button></div>
      <div class="featured-grid">${state.heroes.slice(8,14).map(h=>heroCard(h,true)).join('')}</div>
      <div class="safety-note"><b>这是一场经营人格游戏</b><p>所有契合度与PK分数只用于内容探索，不预测收益，不提供买卖建议。</p></div>
    </section></main>`)
}

function renderQuiz() {
  const q = questions[state.quizIndex]
  const percent = Math.round((state.quizIndex / questions.length) * 100)
  app.innerHTML = shell(`<main class="quiz-screen"><header class="quiz-top"><button data-action="quiz-back" aria-label="返回">←</button><div><span>经营人格测试</span><b>${state.quizIndex+1} / ${questions.length}</b></div></header><div class="quiz-progress"><i style="width:${percent}%"></i></div>
    <section class="quiz-panel"><span class="eyebrow dark">${escapeHtml(q.caption)}</span><h1>${escapeHtml(q.text || q.prompt)}</h1><p class="quiz-hint">没有标准答案，选最接近你真实反应的一项。</p><div class="answer-list">${q.options.map((option,index)=>`<button class="answer-option" data-action="answer" data-index="${index}"><b>${String.fromCharCode(65+index)}</b><span>${escapeHtml(option.text)}</span><i>→</i></button>`).join('')}</div></section>
    <footer class="quiz-footer">点击选项后自动进入下一题 · 你的答案只保存在本机</footer></main>`)
}

function dimensionBars(profile) {
  const byId = new Map((profile.dimensions||[]).map(item=>[item.id,item]))
  return DIMENSIONS.map(dim=>{const item=byId.get(dim.id)||{score:50};return `<div class="dimension-row"><span>${escapeHtml(dim.shortLabel)}</span><div><i style="width:${item.score}%"></i></div><b>${Math.round(item.score)}</b></div>`}).join('')
}

function renderResult() {
  if (!state.result) return go('home')
  const r = state.result, h = r.primary
  app.innerHTML = shell(`<main class="result-screen"><header class="result-hero"><button class="back-float" data-action="go" data-screen="home">←</button><div class="result-art">${portrait(h,'result-portrait',false)}<div class="result-glow"></div></div><div class="result-copy"><span class="eyebrow">YOUR OPERATING PERSONA</span><h1>${escapeHtml(r.title)}</h1><p class="subtitle">${escapeHtml(r.subtitle)}</p><p>${escapeHtml(r.copy)}</p><div class="tag-row">${r.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div></div></header>
    <section class="result-body"><div class="profile-card"><div class="section-heading"><div><span class="eyebrow dark">8-DIMENSION PROFILE</span><h2>你的能力雷达</h2></div><b>${r.confidence}% 置信度</b></div>${dimensionBars(r)}</div>
      <div class="team-cta"><div class="team-cta-art">${portrait(h,'team-cta-image',true)}</div><div><span class="eyebrow dark">NEXT MOVE</span><h2>画像完成，组建你的英雄队</h2><p>把与你同频的英雄拉到一起，看看不同公司人格会碰撞出什么化学反应。</p></div><button class="btn primary" data-action="go" data-screen="team">用英雄组建战队</button></div>
      <div class="match-card"><span class="eyebrow dark">YOUR COMPANY HERO</span><div class="match-head"><div><h2>${escapeHtml(h.name)}</h2><p>${escapeHtml(h.resultCopy || h.mission)}</p></div><strong>${h.matchScore}<small>/100</small></strong></div><div class="match-reasons">${(h.matchReasons||[]).map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join('')}</div><button class="btn dark" data-action="detail" data-code="${h.code}">查看英雄完整档案</button></div>
      <div class="top-match"><div class="section-heading"><div><span class="eyebrow dark">TOP 5 MATCH</span><h2>你的同频英雄</h2></div></div><div class="horizontal-heroes">${r.top5.map(hero=>heroCard(hero,true)).join('')}</div></div>
      <div class="action-grid"><button class="btn soft" data-action="share-result">分享我的人格</button><button class="text-link" data-action="start-quiz">重新测试</button></div>
      <div class="safety-note"><b>契合度解释</b><p>契合度表示你的回答与公司经营人格文案的相似程度，不代表投资价值、收益或上涨概率。</p></div>
    </section></main>`)
}

const poolOptions = () => ['全部', ...new Set(state.heroes.map(h=>h.pool))]
const archetypeOptions = () => ['全部', ...new Set(state.heroes.map(h=>h.archetype))]
function filteredHeroes() {
  const q = state.search.trim().toLowerCase()
  return state.heroes.filter(h => (state.pool==='全部'||h.pool===state.pool) && (state.archetype==='全部'||h.archetype===state.archetype) && (!q || `${h.name}${h.code}${h.archetype}${h.answerTags?.join('')}`.toLowerCase().includes(q)))
}

function renderFilters() {
  return `<div class="filters"><label class="search-box">⌕<input data-action="search" value="${escapeHtml(state.search)}" placeholder="搜索公司名称或6位代码"></label><div class="filter-row"><select data-action="pool">${poolOptions().map(x=>`<option ${x===state.pool?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select><select data-action="archetype">${archetypeOptions().map(x=>`<option ${x===state.archetype?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select></div></div>`
}

function renderHeroes() {
  const list = filteredHeroes(), shown = list.slice(0,state.visible)
  app.innerHTML = shell(`<main><header class="archive-head"><span class="eyebrow">COMPANY HERO ARCHIVE</span><h1>320位英雄，<br>320种做事方式。</h1><p>按市场、人格或名称寻找英雄。每一张卡片都使用完整文案与专属立绘。</p></header><section class="archive-body">${renderFilters()}<div class="result-count"><b>${list.length}</b> 位英雄符合条件</div><div class="archive-grid">${shown.map(h=>heroCard(h)).join('')}</div>${shown.length<list.length?`<button class="btn soft load-more" data-action="more">再加载 ${Math.min(40,list.length-shown.length)} 位</button>`:''}</section></main>`)
}

function renderDetail() {
  const h = state.detail || state.heroes[0]
  const selected = state.team.includes(h.code)
  app.innerHTML = shell(`<main class="detail-screen"><header class="detail-hero"><button class="back-float" data-action="back">←</button>${portrait(h,'detail-portrait',false)}<div class="detail-overlay"><span>${escapeHtml(h.pool)} · ${h.code}</span><h1>${escapeHtml(h.name)}</h1><p>${escapeHtml(h.archetype)}</p></div></header><section class="detail-body"><div class="quote-card"><span>“</span><p>${escapeHtml(h.resultCopy || h.mission)}</p></div><div class="detail-section"><span class="eyebrow dark">HERO MISSION</span><h2>${escapeHtml(h.mission)}</h2><p>${escapeHtml(h.detailCopy)}</p></div><div class="detail-section"><span class="eyebrow dark">STRENGTHS</span><div class="big-tags">${h.strengths.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div></div><div class="tradeoff-card"><b>这位英雄的真实取舍</b><p>${escapeHtml(h.tradeoff)}</p></div><div class="detail-section"><span class="eyebrow dark">VISUAL IDENTITY</span><p>${escapeHtml(h.visualKeywords)}</p></div><div class="sticky-action"><button class="btn ${selected?'soft':'primary'}" data-action="toggle-team" data-code="${h.code}">${selected?'已加入战队 · 点击移除':'加入我的战队'}</button></div><div class="safety-note"><p>${escapeHtml(h.avoidExpression || '不暗示股价走势，不给出投资建议。')}</p></div></section></main>`)
}

function teamMember(hero, index) { return `<button class="team-member" data-action="toggle-team" data-code="${hero.code}">${portrait(hero,'team-member-image')}<span>${index+1}</span><b>${escapeHtml(hero.name)}</b><i>×</i></button>` }
function renderTeam() {
  const team = state.team.map(heroByCode).filter(Boolean), list = filteredHeroes().slice(0,80)
  app.innerHTML = shell(`<main><header class="team-head"><span class="eyebrow">TEAM BUILDER · 3—5 HEROES</span><h1>组建你的公司英雄队</h1><p>不同的人格组合，会生成不同的团队化学反应、优势和盲点。</p></header><section class="team-body"><div class="team-status"><div><span>YOUR ROSTER</span><strong>${team.length}<small>/5</small></strong></div><p>${team.length<3?'至少选择3位英雄才能进入盲选大厅':team.length===5?'阵容已满，可以锁定':'还可以继续补充阵容'}</p></div><div class="selected-team">${team.length?team.map(teamMember).join(''):`<div class="empty-roster">从下面选择3—5位英雄<br><small>试着混合不同人格，画像会更有趣</small></div>`}</div><button class="btn primary lock-team" data-action="lock-team" ${team.length<3?'disabled':''}>锁定阵容 · 进入盲选大厅</button><div class="section-heading"><div><span class="eyebrow dark">SELECT HEROES</span><h2>选择队员</h2></div></div>${renderFilters()}<div class="team-pick-grid">${list.map(h=>`<button class="team-pick ${state.team.includes(h.code)?'selected':''}" data-action="toggle-team" data-code="${h.code}">${portrait(h,'team-pick-image')}<span><b>${escapeHtml(h.name)}</b><small>${escapeHtml(h.archetype)}</small></span><i>${state.team.includes(h.code)?'✓':'+'}</i></button>`).join('')}</div></section></main>`)
}

function rivalTeam() { return state.heroes.filter(h=>!state.team.includes(h.code)).slice(27,27+state.team.length) }
function lobbySlot(hero, hidden=false) { return hidden?`<div class="lobby-slot hidden"><b>?</b><span>HIDDEN PICK</span></div>`:`<div class="lobby-slot">${portrait(hero,'lobby-image')}<span>${escapeHtml(hero.name)}</span><small>${escapeHtml(hero.archetype)}</small></div>` }
function renderLobby() {
  const own = state.team.map(heroByCode).filter(Boolean)
  app.innerHTML = shell(`<main class="lobby-screen"><header class="lobby-head"><button class="back-float" data-action="go" data-screen="team">←</button><span class="eyebrow">THE MARKET ARENA · BLIND PICK</span><h1>英雄已经就位</h1><p>开局之前，双方只能看到自己的阵容。</p></header><section class="lobby-board"><div class="team-lane blue"><div class="lane-title"><span>我的战队</span><b>READY · ${own.length}/${own.length}</b></div><div class="lobby-slots">${own.map(h=>lobbySlot(h)).join('')}</div></div><div class="versus-core"><i></i><b>VS</b><span>BLIND PICK</span></div><div class="team-lane red"><div class="lane-title"><span>好友未知阵容</span><b>HIDDEN · ${own.length}/${own.length}</b></div><div class="lobby-slots">${own.map(()=>lobbySlot(null,true)).join('')}</div></div><div class="lobby-note"><b>盲选对战</b><p>你的阵容已经锁定，邀请好友选择 3—5 位英雄后开始 PK。</p></div><button class="btn primary" data-action="start-battle">邀请好友组队PK</button></section></main>`)
}

const hashScore = (code, day) => { let n = [...`${code}-${day}`].reduce((sum,c)=>sum+c.charCodeAt(0),0); return Number((((n*17)%510-220)/100).toFixed(2)) }
function battleData() {
  const own=state.team.map(heroByCode).filter(Boolean), rival=rivalTeam();
  const days=[0,1,2,3,4].map(day=>{const avg=list=>Number((list.reduce((s,h)=>s+hashScore(h.code,day),0)/list.length).toFixed(2));return {day:day+1,own:avg(own),rival:avg(rival)}})
  return { own, rival, days, profile:buildTeamProfile(state.team,state.heroes) }
}
function renderBattle() {
  const b=battleData(), d=b.days[state.battleDay]
  app.innerHTML = shell(`<main class="battle-screen"><header class="battle-head"><button class="back-float" data-action="go" data-screen="lobby">←</button><span class="eyebrow">5-DAY CLOSING DUEL · DEMO</span><h1>${d.own>=d.rival?`D${d.day}，你的战队占据上风`:`D${d.day}，好友战队暂时领先`}</h1><p>以下为玩法演示分，不是实时行情，也不代表投资表现。</p></header><section class="battle-body"><div class="score-board"><div><span>MY TEAM</span><strong class="${d.own>=d.rival?'win':''}">${d.own>0?'+':''}${d.own}</strong></div><b>VS</b><div><span>RIVAL TEAM</span><strong class="${d.rival>d.own?'win':''}">${d.rival>0?'+':''}${d.rival}</strong></div></div><div class="day-tabs">${b.days.map((x,i)=>`<button class="${i===state.battleDay?'active':''}" data-action="battle-day" data-index="${i}"><span>D${i+1}</span><b>${x.own>0?'+':''}${x.own}</b></button>`).join('')}</div><div class="team-profile-card"><span class="eyebrow">YOUR TEAM PERSONA</span><h2>${escapeHtml(b.profile.archetype)}</h2><p>${escapeHtml(b.profile.copy)}</p><div class="chemistry"><b>化学反应 · ${b.profile.chemistryScore}</b><p>${escapeHtml(b.profile.chemistry)}</p></div><div class="profile-strengths">${b.profile.strengths.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div><div class="blind-spot"><b>队伍盲点</b><p>${escapeHtml(b.profile.blindSpot)}</p></div><div class="team-face-row">${b.own.map(h=>portrait(h,'team-face')).join('')}</div></div><div class="action-grid"><button class="btn primary" data-action="share-team">分享战队画像</button><button class="btn soft" data-action="go" data-screen="team">重新组队</button></div><div class="safety-note"><b>PK规则说明</b><p>完整版接入合规授权行情后，可按每日收盘涨跌幅等权计算。当前页面仅用确定性模拟分展示交互。</p></div></section></main>`)
}

function render() {
  if (state.loading) return renderLoading()
  if (state.error) { app.innerHTML = shell(`<main class="error-screen"><h1>英雄集结失败</h1><p>${escapeHtml(state.error)}</p><button class="btn primary" data-action="reload">重新加载</button></main>`); return }
  const views={home:renderHome,quiz:renderQuiz,result:renderResult,heroes:renderHeroes,detail:renderDetail,team:renderTeam,lobby:renderLobby,battle:renderBattle}
  ;(views[state.screen]||renderHome)()
}

function handleAction(target) {
  const action = target.dataset.action
  if (!action) return
  if (action==='go') return go(target.dataset.screen)
  if (action==='start-quiz') { state.answers=[]; state.quizIndex=0; return go('quiz') }
  if (action==='quiz-back') { if(state.quizIndex>0){state.quizIndex--;state.answers.pop();render()}else go('home'); return }
  if (action==='answer') { state.answers[state.quizIndex]=Number(target.dataset.index); if(state.quizIndex<questions.length-1){state.quizIndex++;render()}else{state.result=calculate(state.answers,state.heroes);go('result')} return }
  if (action==='detail') { state.detail=heroByCode(target.dataset.code); return go('detail') }
  if (action==='back') return go('heroes')
  if (action==='more') { state.visible+=40; return render() }
  if (action==='toggle-team') { const code=target.dataset.code; if(state.team.includes(code)) state.team=state.team.filter(x=>x!==code); else if(state.team.length<5) state.team.push(code); else return toast('一支战队最多5位英雄'); save(); render(); return }
  if (action==='lock-team') { if(state.team.length<3)return toast('请先选择至少3位英雄'); state.friendView=false; return go('lobby') }
  if (action==='friend-view') { state.friendView=!state.friendView; return render() }
  if (action==='start-battle') { state.battleDay=2; return go('battle') }
  if (action==='battle-day') { state.battleDay=Number(target.dataset.index); return render() }
  if (action==='share-result') return share('我的同花顺英雄人格',state.result.shareText)
  if (action==='share-team') { const profile=buildTeamProfile(state.team,state.heroes); return share('我的公司英雄战队',profile.shareCopy) }
  if (action==='reload') location.reload()
}

app.addEventListener('click', event => { const target=event.target.closest('[data-action]'); if(target) handleAction(target) })
app.addEventListener('input', event => { if(event.target.dataset.action==='search'){state.search=event.target.value;state.visible=40;render()} })
app.addEventListener('change', event => { if(event.target.dataset.action==='pool'){state.pool=event.target.value;state.visible=40;render()} if(event.target.dataset.action==='archetype'){state.archetype=event.target.value;state.visible=40;render()} })
window.addEventListener('popstate',()=>{if(state.screen==='detail')go('heroes')})

async function init() {
  restore(); render()
  try {
    const response=await fetch('./data/heroes.json'); if(!response.ok)throw new Error(`数据文件返回 ${response.status}`)
    const payload=await response.json(); state.heroes=payload.heroes||payload
    if(state.heroes.length!==320)throw new Error(`期望320位英雄，实际读取${state.heroes.length}位`)
    state.team=state.team.filter(code=>heroByCode(code)); state.loading=false; render()
  } catch(error) { state.loading=false; state.error=error.message; render() }
}

init()
