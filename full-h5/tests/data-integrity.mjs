import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { questions, DIMENSIONS } from '../src/quiz-data.js'
import { calculate, buildTeamProfile } from '../src/profile-engine.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const payload = JSON.parse(fs.readFileSync(path.join(root, 'data/heroes.json'), 'utf8'))
const heroes = payload.heroes
const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(payload.count === 320 && heroes.length === 320, '英雄数量必须为320')
assert(new Set(heroes.map(hero => hero.code)).size === 320, '股票代码必须唯一')
for (const hero of heroes) {
  assert(/^\d{6}$/.test(hero.code), `股票代码格式错误: ${hero.code}`)
  for (const field of ['name', 'pool', 'archetype', 'mission', 'tradeoff', 'resultCopy', 'detailCopy', 'imagePath', 'thumbnailPath']) {
    assert(String(hero[field] || '').trim(), `${hero.code} 缺少字段 ${field}`)
  }
  const main = path.join(root, 'public', hero.imagePath.replace(/^\//, ''))
  const thumb = path.join(root, 'public', hero.thumbnailPath.replace(/^\//, ''))
  assert(fs.existsSync(main), `${hero.code} 主图不存在`)
  assert(fs.existsSync(thumb), `${hero.code} 缩略图不存在`)
}

assert(questions.length >= 15, '题量不足15题')
assert(DIMENSIONS.length === 8, '必须为8维画像')
questions.forEach((question, index) => assert(question.options?.length === 3, `第${index + 1}题不是3个选项`))

const answers = questions.map((_, index) => index % 3)
const result = calculate(answers, heroes)
assert(result?.primary?.code, '个人画像没有匹配公司')
assert(result?.top5?.length === 5, '个人画像Top5不完整')
assert(result?.profile?.title || result?.title, '个人画像标题缺失')
assert(/^[A-Z]{4}$/.test(result?.typeCode || ''), '四字人格代码格式错误')
assert(result?.typeAxes?.length === 4, '四字人格代码解释缺失')

const team = buildTeamProfile(heroes.slice(0, 5).map(hero => hero.code), heroes)
assert(team?.archetype && team?.chemistry && team?.strengths && team?.blindSpot, '团队画像字段不完整')

console.log(JSON.stringify({ heroes: heroes.length, questions: questions.length, optionsPerQuestion: 3, dimensions: DIMENSIONS.length, matched: result.primary.code, team: team.archetype }))
