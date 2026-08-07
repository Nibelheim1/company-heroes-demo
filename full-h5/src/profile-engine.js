import { DIMENSIONS, dimensionIds, questions } from './quiz-data.js'

const LEGACY_AXIS_DIMENSIONS = [
  'exploration',
  'execution',
  'depth',
  'collaboration',
  'userFocus',
  'systems',
  'adaptability',
  'resilience',
]

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round = (value) => Math.round(Number.isFinite(value) ? value : 0)
const mean = (values, fallback = 0) => {
  const usable = values.filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : fallback
}
const average = (values, fallback = 50) => round(mean(values, fallback))
const cleanKey = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_\-./:：|]+/g, '')

const firstString = (...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() || ''
const asArray = (value) => (Array.isArray(value) ? value : [])
const flattenText = (value) => {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (Array.isArray(value)) return value.flatMap((item) => flattenText(item))
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) => flattenText(item))
  }
  return []
}

/** Convert either 0..1 ratios or 0..100 scores into a comparable 0..100 value. */
const scalar = (value, fallback = 50) => {
  if (typeof value === 'object' && value !== null) {
    value = value.score ?? value.value ?? value.percent ?? value.rating
  }
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (!Number.isFinite(number)) return fallback
  return clamp(number >= 0 && number <= 1 ? number * 100 : number)
}

const dimensionAliases = new Map()
DIMENSIONS.forEach((dimension) => {
  dimensionAliases.set(cleanKey(dimension.id), dimension.id)
  dimensionAliases.set(cleanKey(dimension.label), dimension.id)
  dimensionAliases.set(cleanKey(dimension.shortLabel), dimension.id)
  dimension.aliases.forEach((alias) => dimensionAliases.set(cleanKey(alias), dimension.id))
})

const aliasesFor = (id) => {
  const dimension = DIMENSIONS.find((item) => item.id === id)
  return dimension ? [dimension.id, dimension.label, dimension.shortLabel, ...dimension.aliases] : [id]
}

const emptyVector = (value = 50) => Object.fromEntries(dimensionIds.map((id) => [id, value]))

const vectorArray = (vector) => dimensionIds.map((id) => clamp(Number(vector[id]) || 0))

/**
 * The old mini demo used ten axes.  Full H5 uses eight; this map preserves
 * useful signal when an older heroes.js/JSON file is passed to the new UI.
 */
const fromLegacyAxes = (values) => {
  const source = values.map((value) => scalar(value))
  const at = (index) => source[index] ?? 50
  return {
    exploration: at(0),
    execution: average([at(1), at(7)]),
    depth: at(2),
    collaboration: average([at(3), at(6)]),
    userFocus: at(4),
    systems: average([at(5), at(7)]),
    adaptability: at(6),
    resilience: average([at(8), at(9)]),
  }
}

const objectEntries = (source) => {
  if (!source || typeof source !== 'object') return []
  if (Array.isArray(source)) {
    return source.flatMap((item, index) => {
      if (item && typeof item === 'object') {
        const key = item.id ?? item.key ?? item.name ?? item.dimension
        const value = item.score ?? item.value ?? item.percent ?? item.rating
        return key !== undefined ? [[key, value]] : [[index, item]]
      }
      return [[index, item]]
    })
  }
  return Object.entries(source)
}

/**
 * Normalize axes from arrays, named dimensions, nested `scores`/`profile`
 * objects, or a mixture of the above. Missing dimensions intentionally land
 * at 50: a partial company record should still be matchable without a NaN.
 */
export function normalizeVector(input, fallback = 50) {
  const vector = emptyVector(fallback)
  if (input === null || input === undefined) return vector

  if (Array.isArray(input)) {
    if (input.length >= 10) return { ...vector, ...fromLegacyAxes(input) }
    if (input.length >= 8) {
      dimensionIds.forEach((id, index) => {
        vector[id] = scalar(input[index], fallback)
      })
      return vector
    }
    // A compact named list such as [{id: 'depth', score: 80}] is common in
    // hand-authored JSON; parse it through the same object path below.
  }

  const sources = [input]
  if (input && typeof input === 'object') {
    ;['scores', 'vector', 'dimensions', 'axes', 'profile', 'traits', 'personality'].forEach((key) => {
      if (input[key] !== undefined && !sources.includes(input[key])) sources.push(input[key])
    })
  }

  const found = new Set()
  const visit = (source) => {
    if (source === null || source === undefined || found.has(source)) return
    if (typeof source === 'object') found.add(source)
    if (Array.isArray(source)) {
      objectEntries(source).forEach(([key, value]) => {
        const id = typeof key === 'number' ? dimensionIds[key] : dimensionAliases.get(cleanKey(key))
        if (id && value !== undefined && typeof value !== 'object') {
          vector[id] = scalar(value, fallback)
        } else if (id && value && typeof value === 'object') {
          vector[id] = scalar(value, fallback)
        } else if (value && typeof value === 'object') {
          visit(value)
        }
      })
      return
    }
    if (typeof source !== 'object') return
    Object.entries(source).forEach(([key, value]) => {
      const canonical = cleanKey(key)
      const id = dimensionAliases.get(canonical)
      // axis0..axis9 is the compact form used by a few generated records.
      const axisIndex = /^axis(\d+)$/.exec(canonical)?.[1]
      const axisId = axisIndex !== undefined
        ? (Number(axisIndex) < 8 ? LEGACY_AXIS_DIMENSIONS[Number(axisIndex)] : null)
        : null
      if (id && value !== undefined) {
        vector[id] = scalar(value, fallback)
      } else if (axisId && value !== undefined) {
        vector[axisId] = scalar(value, fallback)
      } else if (value && typeof value === 'object') {
        visit(value)
      }
    })
  }
  sources.forEach(visit)
  return vector
}

const heroSource = (hero) => {
  if (!hero || typeof hero !== 'object') return {}
  // Permit {hero: {...}} and {company: {...}} wrappers without requiring the
  // caller to know which asset pipeline produced the record.
  return hero.hero && typeof hero.hero === 'object' ? hero.hero : hero.company && typeof hero.company === 'object' ? hero.company : hero
}

const fallbackRecord = (index = 0) => ({
  id: `unknown-${index + 1}`,
  name: index ? `未命名英雄 ${index + 1}` : '未命名英雄',
  role: '待补全的经营样本',
  industry: '未知行业',
  motto: '信息尚未完整，但每个选择都可以重新开始。',
  mission: '等待更多公司画像资料接入。',
  strengths: ['资料待补全'],
  tradeoff: '当前记录缺少足够的事实字段。',
  tags: ['fallback'],
  quizTags: ['资料待补全'],
  axes: dimensionIds.map(() => 50),
  vector: emptyVector(50),
  color: '#8A8FA3',
  light: '#F0F1F5',
  icon: '？',
  facts: [],
})

// The generated hero catalogue contains rich prose and an archetype but some
// older exports do not carry numeric axes.  These archetype priors keep those
// records matchable without pretending that the prose is a precise score.
const ARCHETYPE_PRIORS = [
  { keys: ['探索者', '破局者', '探路者', '先锋', '创新'], vector: [88, 62, 70, 68, 64, 62, 86, 58] },
  { keys: ['工程师', '精工', '科学家', '技术'], vector: [72, 84, 92, 58, 44, 92, 66, 86] },
  { keys: ['经营者', '复利', '守城', '运营'], vector: [62, 84, 72, 82, 78, 78, 58, 88] },
  { keys: ['资源整合者', '连接者', '协同', '生态'], vector: [68, 70, 66, 92, 82, 72, 76, 74] },
  { keys: ['服务者', '用户', '生活'], vector: [62, 76, 64, 78, 94, 68, 62, 78] },
  { keys: ['制造者', '工程建造', '重器'], vector: [58, 86, 78, 70, 42, 94, 56, 90] },
]

const inferVectorFromText = (raw) => {
  const text = flattenText([
    raw.archetype,
    raw.role,
    raw.industry,
    raw.sector,
    raw.answerTags,
    raw.tags,
    raw.quizTags,
    raw.strengths,
    raw.companyFact,
    raw.mission,
  ]).join(' ')
  const matched = ARCHETYPE_PRIORS.find((prior) => prior.keys.some((key) => text.includes(key)))
  if (matched) return Object.fromEntries(dimensionIds.map((id, index) => [id, matched.vector[index]]))
  // A conservative industry prior is preferable to every company collapsing
  // to a 50/50 tie when a record has only name + industry text.
  if (/科技|软件|芯片|医药|新能源|人工智能/i.test(text)) return Object.fromEntries(dimensionIds.map((id, index) => [id, [78, 68, 78, 64, 55, 76, 78, 66][index]]))
  if (/消费|零售|食品|家电|服务/i.test(text)) return Object.fromEntries(dimensionIds.map((id, index) => [id, [58, 78, 66, 76, 88, 68, 56, 80][index]]))
  if (/银行|保险|证券|金融/i.test(text)) return Object.fromEntries(dimensionIds.map((id, index) => [id, [52, 82, 74, 78, 70, 76, 48, 92][index]]))
  return null
}

/** Normalize one company record while preserving UI-friendly display fields. */
export function normalizeHero(hero, index = 0) {
  const raw = heroSource(hero)
  if (!Object.keys(raw).length) return fallbackRecord(index)
  const rawAxes = raw.axes ?? raw.axis ?? raw.scores ?? raw.vector ?? raw.dimensions
  const explicitVector = normalizeVector(rawAxes ?? raw)
  const explicitFields = rawAxes !== undefined || dimensionIds.some((id) => raw[id] !== undefined)
  const vector = explicitFields ? explicitVector : (inferVectorFromText(raw) ?? explicitVector)
  const id = firstString(raw.id, raw.code, raw.symbol, raw.ts_code, raw.stockCode, raw.stock_code, `hero-${index + 1}`)
  const name = firstString(raw.name, raw.heroName, raw.companyName, raw.company, raw.title, id)
  const strengths = flattenText([raw.strengths, raw.strength, raw.highlights]).slice(0, 8)
  const tags = flattenText([raw.tags, raw.quizTags, raw.answerTags, raw.answer_tags, raw.traits, raw.archetype]).slice(0, 16)
  const facts = flattenText([raw.facts, raw.evidence, raw.proof]).slice(0, 8)
  return {
    ...raw,
    id,
    code: firstString(raw.code, raw.id, id),
    name,
    heroName: firstString(raw.heroName, name),
    role: firstString(raw.role, raw.archetype, raw.persona, '经营英雄'),
    industry: firstString(raw.industry, raw.sector, '综合行业'),
    motto: firstString(raw.motto, raw.tagline, raw.slogan, '把选择做成长期能力。'),
    mission: firstString(raw.mission, raw.description, raw.summary, ''),
    strengths: strengths.length ? strengths : ['经营能力待观察'],
    tradeoff: firstString(raw.tradeoff, raw.risk, raw.caveat, '不同路径都有自己的时间成本。'),
    tags,
    quizTags: tags,
    facts,
    vector,
    // Keep `axes` as an array so old cards that render hero.axes still work.
    axes: Array.isArray(rawAxes) ? rawAxes : vectorArray(vector),
    dimensions: DIMENSIONS.map((dimension) => ({ ...dimension, score: vector[dimension.id] })),
  }
}

/** Normalize array/object hero payloads and ignore malformed entries safely. */
export function normalizeHeroes(input) {
  let records = input
  if (input && !Array.isArray(input) && typeof input === 'object') {
    records = input.heroes ?? input.companies ?? input.items ?? input.data ?? input.default ?? []
  }
  if (!Array.isArray(records)) records = []
  const normalized = records.map((hero, index) => normalizeHero(hero, index)).filter(Boolean)
  return normalized.length ? normalized : [fallbackRecord(0)]
}

const answerIndex = (answer, question) => {
  if (typeof answer === 'number' && Number.isInteger(answer)) return answer
  if (typeof answer === 'string') {
    const trimmed = answer.trim().toLowerCase()
    if (/^[abc]$/.test(trimmed)) return trimmed.charCodeAt(0) - 97
    const byId = question?.options?.findIndex((optionItem) => optionItem.id === answer || optionItem.value === answer)
    if (byId >= 0) return byId
    const numeric = Number(trimmed)
    if (Number.isInteger(numeric)) return numeric
  }
  if (answer && typeof answer === 'object') {
    if (answer.optionId !== undefined) return answerIndex(answer.optionId, question)
    if (answer.choice !== undefined) return answerIndex(answer.choice, question)
    if (answer.index !== undefined) return answerIndex(answer.index, question)
    if (answer.answer !== undefined) return answerIndex(answer.answer, question)
    if (answer.value !== undefined) return answerIndex(answer.value, question)
  }
  return -1
}

const deltaVector = (optionItem) => {
  const source = optionItem?.delta ?? optionItem?.scores ?? optionItem?.score ?? []
  if (Array.isArray(source)) {
    if (source.length >= 10) return fromLegacyAxes(source)
    return Object.fromEntries(dimensionIds.map((id, index) => [id, Number(source[index]) || 0]))
  }
  if (source && typeof source === 'object') {
    const normalized = normalizeVector(source, 0)
    return Object.fromEntries(dimensionIds.map((id) => [id, Number(normalized[id]) || 0]))
  }
  return Object.fromEntries(dimensionIds.map((id) => [id, 0]))
}

/**
 * Score answer indices deterministically.  The denominator is the best
 * available option for each answered question, then a 20..100 range leaves
 * room for a neutral result when a user picks a mixed set of trade-offs.
 */
export function scoreQuiz(answers = [], questionSet = questions) {
  const list = Array.isArray(answers) ? answers : answers?.answers ?? answers?.selections ?? []
  const qs = Array.isArray(questionSet) && questionSet.length ? questionSet : questions
  const raw = Object.fromEntries(dimensionIds.map((id) => [id, 0]))
  const potential = Object.fromEntries(dimensionIds.map((id) => [id, 0]))
  const selections = []

  qs.forEach((quizQuestion, questionIndex) => {
    const answer = list[questionIndex]
    const index = answerIndex(answer, quizQuestion)
    const options = asArray(quizQuestion?.options)
    if (index < 0 || index >= options.length) return
    const selectedDelta = deltaVector(options[index])
    const maxima = dimensionIds.map((id) => Math.max(...options.map((item) => deltaVector(item)[id]), 0))
    dimensionIds.forEach((id, dimensionIndex) => {
      raw[id] += selectedDelta[id]
      potential[id] += maxima[dimensionIndex]
    })
    selections.push({ questionId: quizQuestion.id ?? questionIndex, optionId: options[index].id ?? index, index })
  })

  const answered = selections.length
  const scores = Object.fromEntries(dimensionIds.map((id) => {
    if (!answered || potential[id] <= 0) return [id, 50]
    const ratio = clamp(raw[id] / potential[id], 0, 1)
    return [id, round(20 + ratio * 80)]
  }))
  const total = qs.length
  const coverage = total ? round((answered / total) * 100) : 0
  return {
    scores,
    vector: scores,
    userVector: scores,
    raw,
    potential,
    answered,
    total,
    coverage,
    selections,
  }
}

const vectorFromInput = (input) => {
  if (Array.isArray(input)) {
    const numericVector = input.length === dimensionIds.length && input.every((value) => Number(value) >= 0 && Number(value) <= 100)
    return numericVector ? { vector: normalizeVector(input), answered: 0, coverage: 0 } : scoreQuiz(input)
  }
  if (input && typeof input === 'object') {
    const vectorInput = input.userVector ?? input.vector ?? input.scores ?? input.dimensions
    if (vectorInput && !Array.isArray(vectorInput?.[0])) {
      return {
        ...input,
        vector: normalizeVector(vectorInput),
        answered: input.answered ?? 0,
        coverage: input.coverage ?? 0,
      }
    }
    // Also accept a plain named vector: matchCompany({ exploration: 80, ... })
    // is convenient in tests and for small integrations that do not retain the
    // scoreQuiz wrapper object.
    if (dimensionIds.some((id) => input[id] !== undefined) || DIMENSIONS.some((dimension) => input[dimension.label] !== undefined)) {
      return { ...input, vector: normalizeVector(input), answered: input.answered ?? 0, coverage: input.coverage ?? 100 }
    }
    if (Array.isArray(input.answers) || Array.isArray(input.selections)) return scoreQuiz(input.answers ?? input.selections)
  }
  return { vector: emptyVector(50), answered: 0, coverage: 0 }
}

const archetypeFor = (vector) => {
  const v = vector
  if (v.exploration >= 78 && v.adaptability >= 74 && v.exploration >= v.resilience + 8) return {
    title: '破局探路者',
    subtitle: '先找到下一条路，再把它走成地图',
    copy: '你对未知有耐心，也对反馈很敏感。比起等待确定答案，你更愿意用小步实验换来下一次更好的选择。',
  }
  if (v.depth >= 78 && v.systems >= 76 && v.depth + v.systems >= v.exploration + v.adaptability + 4) return {
    title: '深度筑城者',
    subtitle: '把复杂问题做成可复用的底座',
    copy: '你会把问题拆深、把流程做实，相信专业积累和可靠系统能在时间里形成真正的复利。',
  }
  if (v.collaboration >= 78 && v.userFocus >= 76) return {
    title: '生态连接者',
    subtitle: '让分散的能力在真实场景里相遇',
    copy: '你习惯从用户和伙伴出发，把一家公司放进更大的网络里理解。好的连接，对你来说不是热闹，而是共同交付。',
  }
  if (v.execution >= 78 && v.resilience >= 78 && v.exploration <= 76) return {
    title: '稳态复利者',
    subtitle: '把每一次交付都变成下一次的起点',
    copy: '你不急着追逐每个新风口，更在意承诺能否兑现、能力能否沉淀，以及系统能否穿越变化。',
  }
  if (v.userFocus >= 80 && v.userFocus >= v.systems + 6) return {
    title: '场景观察家',
    subtitle: '从日常细节里找到真正的需求',
    copy: '你会先进入真实场景，再决定做什么。对你而言，用户愿意反复使用，是比漂亮方案更有说服力的答案。',
  }
  if (v.execution >= 74 && v.adaptability >= 72) return {
    title: '敏捷经营者',
    subtitle: '在变化里保持清醒的行动节奏',
    copy: '你既愿意调整，也知道什么不能随意牺牲。快速试错和关键纪律，在你这里是同一套经营方法的两面。',
  }
  return {
    title: '均衡进化者',
    subtitle: '给增长留空间，也给长期留底盘',
    copy: '你不把自己锁在单一标签里：会探索、会复盘，也愿意和伙伴把答案做成可持续的系统。',
  }
}

const tagRules = [
  ['exploration', 74, '愿意给未知机会'],
  ['execution', 74, '把节奏做稳'],
  ['depth', 74, '专业深挖'],
  ['collaboration', 74, '相信协同网络'],
  ['userFocus', 74, '从真实场景出发'],
  ['systems', 74, '重视能力底座'],
  ['adaptability', 74, '拥抱变化反馈'],
  ['resilience', 74, '偏好长期复利'],
]

const dimensionProfiles = {
  exploration: '把未知变成可验证的下一步',
  execution: '让想法在稳定节奏里落地',
  depth: '愿意把问题拆到足够深',
  collaboration: '善于把人和资源接成网络',
  userFocus: '从使用场景而不是口号出发',
  systems: '先搭底座，再放大结果',
  adaptability: '用反馈及时改变路径',
  resilience: '愿意让时间参与答案',
}

/** Build the post-quiz personality card from a score object or answer list. */
export function buildQuizProfile(input = {}) {
  const scored = vectorFromInput(input)
  const vector = scored.vector ?? scored.scores ?? emptyVector(50)
  const ordered = dimensionIds
    .map((id, index) => ({ ...DIMENSIONS[index], score: round(clamp(Number(vector[id]) || 50)) }))
    .sort((a, b) => b.score - a.score || dimensionIds.indexOf(a.id) - dimensionIds.indexOf(b.id))
  const archetype = archetypeFor(vector)
  const tags = tagRules.filter(([id, threshold]) => vector[id] >= threshold).map(([, , tag]) => tag)
  const fallbackTags = ['保留多种可能', '用复盘换确定性', '尊重真实取舍']
  const finalTags = [...tags, ...fallbackTags].slice(0, 5)
  const top = ordered.slice(0, 3)
  const shareText = `我的经营人格是「${archetype.title}」：${archetype.subtitle}。${top.map((item) => item.shortLabel).join(' · ')}是我的高频关键词。`
  const profile = {
    title: archetype.title,
    subtitle: archetype.subtitle,
    copy: archetype.copy,
    tags: finalTags,
    dimensions: ordered,
    radar: ordered,
    dimensionScores: vector,
    axisScores: vector,
    scores: vector,
    userVector: vector,
    primaryDimension: top[0]?.id ?? 'resilience',
    highlights: top.map((item) => ({ id: item.id, label: item.label, score: item.score, copy: dimensionProfiles[item.id] })),
    shareText,
    shareCopy: shareText,
    answered: scored.answered ?? 0,
    coverage: scored.coverage ?? 0,
    confidence: round(clamp(45 + (scored.coverage ?? 0) * 0.4 + ((top[0]?.score ?? 50) - (ordered[ordered.length - 1]?.score ?? 50)) * 0.2, 0, 100)),
  }
  return profile
}

const semanticOverlap = (vector, hero) => {
  const high = dimensionIds.filter((id) => vector[id] >= 74)
  const heroHigh = dimensionIds.filter((id) => hero.vector[id] >= 74)
  if (!high.length || !heroHigh.length) return 0
  const overlap = high.filter((id) => heroHigh.includes(id)).length
  return (overlap / Math.max(high.length, heroHigh.length)) * 100
}

const matchReasons = (vector, hero) => dimensionIds
  .map((id, index) => ({ id, index, gap: Math.abs(vector[id] - hero.vector[id]) }))
  .sort((a, b) => a.gap - b.gap || a.index - b.index)
  .slice(0, 3)
  .map(({ id }) => `在${DIMENSIONS.find((dimension) => dimension.id === id)?.label ?? id}上同频`)

/** Match a quiz vector to normalized company heroes, with stable tie breaks. */
export function matchCompany(input = {}, heroesInput = []) {
  const scored = vectorFromInput(input)
  const vector = scored.vector ?? emptyVector(50)
  const heroes = normalizeHeroes(heroesInput)
  const profileTags = flattenText(input?.tags ?? input?.profile?.tags)
  const ranked = heroes.map((hero, index) => {
    const distance = mean(dimensionIds.map((id) => Math.abs(vector[id] - hero.vector[id])), 50)
    const base = clamp(100 - distance)
    const semantic = semanticOverlap(vector, hero)
    const text = `${hero.role} ${hero.industry} ${hero.motto} ${hero.mission} ${hero.strengths.join(' ')} ${hero.tags.join(' ')} ${hero.quizTags.join(' ')}`.toLowerCase()
    const textHits = profileTags.filter((tag) => tag && text.includes(String(tag).toLowerCase())).length
    const score = round(clamp(base * 0.82 + semantic * 0.14 + Math.min(textHits, 3) * 2))
    return {
      ...hero,
      matchScore: score,
      matchReasons: matchReasons(vector, hero),
      matchDistance: round(distance),
      _rankIndex: index,
    }
  }).sort((a, b) => b.matchScore - a.matchScore || String(a.id).localeCompare(String(b.id)) || a._rankIndex - b._rankIndex)

  const top5 = ranked.slice(0, 5).map(({ _rankIndex, ...hero }) => hero)
  const primary = top5[0] ?? fallbackRecord(0)
  const companion = top5[1] ?? primary
  const contrast = top5[top5.length - 1] ?? primary
  const spread = top5.length > 1 ? primary.matchScore - top5[1].matchScore : 0
  const confidence = round(clamp(45 + (scored.coverage ?? 0) * 0.35 + spread * 0.4 + (top5.length > 1 ? 12 : 0), 0, 100))
  return {
    primary,
    companion,
    contrast,
    top5,
    matches: top5,
    confidence,
    coverage: scored.coverage ?? 0,
    answered: scored.answered ?? 0,
    userVector: vector,
  }
}

/** Single call used by the H5 app: score, profile, and company match together. */
export function calculate(answers = [], heroes = []) {
  const scored = scoreQuiz(answers)
  const profile = buildQuizProfile(scored)
  const matches = matchCompany({ ...scored, tags: profile.tags }, heroes)
  return {
    ...profile,
    profile,
    scores: scored.scores,
    userVector: scored.scores,
    answered: scored.answered,
    coverage: scored.coverage,
    primary: matches.primary,
    companion: matches.companion,
    contrast: matches.contrast,
    top5: matches.top5,
    matches: matches.matches,
    confidence: matches.confidence,
  }
}

export const defaultResult = (heroes = []) => calculate([], heroes)

const resolveTeam = (teamInput, heroes) => {
  let selected = teamInput
  if (teamInput && !Array.isArray(teamInput) && typeof teamInput === 'object') {
    selected = teamInput.team ?? teamInput.heroes ?? teamInput.selected ?? teamInput.members ?? []
  }
  if (!Array.isArray(selected)) selected = []
  const byId = new Map(heroes.map((hero) => [String(hero.id), hero]))
  return selected.map((item, index) => {
    if (item && typeof item === 'object') {
      const id = firstString(item.id, item.code, item.symbol)
      if (id && byId.has(id)) return byId.get(id)
      return normalizeHero(item, index)
    }
    const found = byId.get(String(item))
    return found ?? normalizeHero({ id: String(item || `unknown-${index + 1}`), name: String(item || '未命名英雄') }, index)
  })
}

const teamArchetype = (vector, roleCount, spread) => {
  if (vector.exploration >= 80 && vector.adaptability >= 76 && vector.resilience < 76) return ['破局突击队', '用快速试探换来下一条增长曲线。']
  if (vector.systems >= 80 && vector.execution >= 78 && vector.resilience >= 80) return ['长期筑城队', '把复杂协作变成经得起时间的基础设施。']
  if (vector.collaboration >= 80 && vector.userFocus >= 78) return ['生态协作队', '从真实场景出发，让伙伴关系变成共同交付。']
  if (vector.depth >= 80 && vector.execution >= 78) return ['精工研究队', '靠专业深度和细节纪律建立可信度。']
  if (mean(Object.values(vector)) >= 72 && spread <= 14 && roleCount >= 3) return ['均衡复利队', '不同能力同向发力，把波动变成持续积累。']
  return ['混合进化队', '保留观点张力，在一次次复盘中找到共同节奏。']
}

/** Build an explainable profile for a selected team of company heroes. */
export function buildTeamProfile(teamInput = [], heroesInput = []) {
  const heroes = normalizeHeroes(heroesInput)
  const members = resolveTeam(teamInput, heroes)
  const vector = Object.fromEntries(dimensionIds.map((id) => [id, average(members.map((hero) => hero.vector[id]), 50)]))
  const dimensions = DIMENSIONS.map((dimension) => ({ ...dimension, score: vector[dimension.id] }))
  const spread = average(dimensionIds.map((id) => {
    const values = members.map((hero) => hero.vector[id])
    const center = mean(values, 50)
    return Math.sqrt(mean(values.map((value) => (value - center) ** 2), 0))
  }), 0)
  const roleCount = new Set(members.map((hero) => hero.role || hero.industry).filter(Boolean)).size
  const [archetype, archetypeCopy] = teamArchetype(vector, roleCount, spread)
  const pairSimilarity = members.length > 1
    ? average(members.flatMap((left, leftIndex) => members.slice(leftIndex + 1).map((right) => 100 - mean(dimensionIds.map((id) => Math.abs(left.vector[id] - right.vector[id])), 50))), 50)
    : 50
  let chemistry = '同频推进：队伍的判断标准相近，适合把一条路线做深。'
  if (roleCount >= 4 && vector.collaboration >= 72) chemistry = '互补协同：探路、交付与守成有人接力，适合处理长链条问题。'
  else if (pairSimilarity < 68) chemistry = '张力共创：成员视角差异明显，关键是给争论设置小试验和复盘点。'
  else if (vector.userFocus >= 78) chemistry = '场景共振：大家会回到用户和实际使用，适合把复杂需求翻译成体验。'

  const ranked = dimensionIds.map((id, index) => ({ id, index, score: vector[id] })).sort((a, b) => b.score - a.score || a.index - b.index)
  const strengthDimensions = ranked.slice(0, 3)
  const weakest = ranked[ranked.length - 1] ?? { id: 'resilience', score: 50 }
  const strengths = strengthDimensions.map(({ id, score }) => {
    const dimension = DIMENSIONS.find((item) => item.id === id)
    return `${dimension?.label ?? id} ${score}：${dimensionProfiles[id]}`
  })
  const weakLabel = DIMENSIONS.find((item) => item.id === weakest.id)?.label ?? weakest.id
  const blindSpot = `${weakLabel}（${weakest.score}）是这支队伍的盲区：遇到压力时，记得补一位在「${dimensionProfiles[weakest.id]}」上更强的伙伴。`
  const names = members.slice(0, 5).map((hero) => hero.name).join('、') || '尚未锁定英雄'
  const shareCopy = `我的英雄队是「${archetype}」：${chemistry.split('：')[1] ?? chemistry} 优势在${strengthDimensions.map(({ id }) => DIMENSIONS.find((item) => item.id === id)?.shortLabel ?? id).join('、')}，需要留意${weakLabel}。`
  const craft = average([vector.depth, vector.systems], 50)
  return {
    archetype,
    title: archetype,
    copy: archetypeCopy,
    chemistry,
    chemistryScore: round(clamp((pairSimilarity * 0.55) + (Math.min(roleCount, 5) / 5) * 45)),
    strengths,
    strengthDimensions,
    blindSpot,
    shareCopy,
    shareText: shareCopy,
    dimensions,
    radar: dimensions,
    vector,
    teamVector: vector,
    // Legacy card aliases: the first demo called these four aggregates
    // innovation/stability/connection/craft. Keep them alongside the richer
    // eight-axis result so an older embed can upgrade without a data shim.
    avg: average(Object.values(vector), 50),
    innovation: vector.exploration,
    stability: vector.resilience,
    connection: vector.collaboration,
    craft,
    members,
    heroes: members,
    memberNames: names,
    roleCount,
    coverage: members.length ? 100 : 0,
    tags: [archetype, `协同 ${round(vector.collaboration)}`, `长期 ${round(vector.resilience)}`],
  }
}

export const buildProfile = buildTeamProfile
export const calculateTeamProfile = buildTeamProfile

export default {
  DIMENSIONS,
  normalizeVector,
  normalizeHero,
  normalizeHeroes,
  scoreQuiz,
  buildQuizProfile,
  matchCompany,
  calculate,
  defaultResult,
  buildTeamProfile,
}
