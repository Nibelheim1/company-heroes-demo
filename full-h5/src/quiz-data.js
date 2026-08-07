/**
 * Data for the operating-personality quiz.
 *
 * The quiz deliberately uses trade-offs instead of "right" answers.  Every
 * question has exactly three plausible choices and every choice contributes
 * to the same eight dimensions.  Keeping the deltas in a fixed order makes
 * the data usable by both the browser build and small, framework-free tests.
 */

export const DIMENSIONS = [
  {
    id: 'exploration',
    label: '探索锋芒',
    shortLabel: '探索',
    aliases: ['innovation', 'discovery', 'explorationIntent', '探索力', '探索意愿', '前沿探索'],
  },
  {
    id: 'execution',
    label: '执行精度',
    shortLabel: '执行',
    aliases: ['precision', 'discipline', 'efficiency', 'executionPower', '精益力', '执行力', '精密制造'],
  },
  {
    id: 'depth',
    label: '专业深度',
    shortLabel: '深度',
    aliases: ['focus', 'craft', 'specialisation', 'specialization', '专注度', '专业深度', '深耕'],
  },
  {
    id: 'collaboration',
    label: '协同连接',
    shortLabel: '协同',
    aliases: ['connection', 'network', 'ecosystem', 'synergy', '产业协同', '协同度', '网络协同'],
  },
  {
    id: 'userFocus',
    label: '用户洞察',
    shortLabel: '用户',
    aliases: ['user_focus', 'userProximity', 'customer', 'customerFocus', 'userCentric', '生活贴近度', '用户贴近'],
  },
  {
    id: 'systems',
    label: '系统筑基',
    shortLabel: '底座',
    aliases: ['foundation', 'engineering', 'infrastructure', 'industryFoundation', '产业底座', '工程建造度', '系统能力'],
  },
  {
    id: 'adaptability',
    label: '变化应对',
    shortLabel: '应变',
    aliases: ['agility', 'adaptation', 'globalConnection', 'change', '变化应对', '全球连接度', '灵活性'],
  },
  {
    id: 'resilience',
    label: '长期韧性',
    shortLabel: '长期',
    aliases: ['stability', 'durability', 'longTerm', 'demandStability', 'longTermConstruction', '需求稳定度', '长期建设度'],
  },
]

export const dimensionIds = DIMENSIONS.map((dimension) => dimension.id)

const option = (id, text, delta) => ({
  id,
  text,
  // `delta` is kept as an array for compatibility with the original mini
  // demo.  `scores` is easier to consume when a caller wants named axes.
  delta: [...delta],
  scores: Object.fromEntries(dimensionIds.map((dimensionId, index) => [dimensionId, delta[index] ?? 0])),
})

const question = (id, caption, text, options) => ({
  id,
  caption,
  text,
  prompt: text,
  options,
})

/**
 * Sixteen scenario questions.  The answer order is intentionally mixed: a
 * high exploration choice is not always A, and a stable choice is not always
 * the conservative-sounding one.  This keeps the quiz from feeling like a
 * disguised good/bad test.
 */
export const questions = [
  question('q01', 'LONG HORIZON', '接手一个三年后才见效的项目，你会先做什么？', [
    option('q01-a', '画出里程碑，按固定节奏滚动投入', [3, 9, 6, 4, 5, 8, 3, 10]),
    option('q01-b', '先做一轮小实验，用反馈改写假设', [10, 4, 5, 3, 4, 3, 9, 4]),
    option('q01-c', '找最懂场景的人，联合做一个试点', [6, 5, 4, 10, 9, 5, 7, 6]),
  ]),
  question('q02', 'OPPOSING SIGNALS', '产品上线后反馈两极分化，你更想先做哪件事？', [
    option('q02-a', '跟踪高频用户，把真实使用路径挖深', [5, 5, 10, 4, 10, 4, 5, 7]),
    option('q02-b', '拆成几个版本，快速跑一轮对照实验', [9, 5, 4, 5, 6, 4, 10, 5]),
    option('q02-c', '先稳住服务流程，再划清承诺边界', [4, 9, 5, 5, 8, 8, 3, 9]),
  ]),
  question('q03', 'LIMITED RESOURCES', '资源只够押一条线，你会把筹码放在哪里？', [
    option('q03-a', '最擅长的核心能力，做到别人难以替代', [4, 8, 10, 3, 3, 8, 4, 9]),
    option('q03-b', '找一位互补伙伴，把能力接成更大系统', [6, 5, 5, 10, 6, 6, 8, 7]),
    option('q03-c', '先守住现金流，让下一次选择更从容', [4, 7, 4, 4, 7, 6, 4, 10]),
  ]),
  question('q04', 'NEW PROPOSAL', '队友提出一条陌生路线，你的第一反应是？', [
    option('q04-a', '约一个最小原型，明天就看真实反馈', [9, 5, 4, 5, 5, 3, 10, 4]),
    option('q04-b', '把验收标准写清楚，拉他一起设计方案', [5, 8, 6, 10, 6, 7, 7, 7]),
    option('q04-c', '先塞进已有流程，确认它不会破坏稳定性', [3, 9, 7, 4, 5, 9, 3, 10]),
  ]),
  question('q05', 'VAGUE NEED', '客户只说“想要更好用”，你会怎样打开局面？', [
    option('q05-a', '跟着客户观察一天，先看他如何完成任务', [5, 5, 7, 8, 10, 4, 7, 6]),
    option('q05-b', '列出几种假设，约客户一起做小测试', [9, 6, 6, 5, 7, 4, 9, 5]),
    option('q05-c', '拿一套成熟方案，先把交付节奏跑起来', [3, 9, 5, 4, 7, 8, 3, 9]),
  ]),
  question('q06', 'RISING RIVAL', '同行突然提速，你更可能采用哪种打法？', [
    option('q06-a', '重新定义赛道，让对方追不上问题本身', [10, 5, 3, 4, 5, 4, 9, 4]),
    option('q06-b', '把交付和服务做到更稳，让客户留下来', [4, 10, 6, 5, 9, 8, 4, 8]),
    option('q06-c', '锁定一项难复制的底层能力，慢慢拉开差距', [5, 8, 10, 6, 4, 9, 5, 10]),
  ]),
  question('q07', 'FIVE-YEAR WIN', '如果五年后只能留下一种成就，你会选哪一种？', [
    option('q07-a', '创造一个以前不存在的新类别', [10, 4, 5, 4, 5, 4, 8, 6]),
    option('q07-b', '让很多人反复使用、愿意托付的服务', [5, 8, 6, 8, 10, 8, 4, 9]),
    option('q07-c', '带出一支能解决难题的专业队伍', [6, 7, 10, 9, 5, 9, 6, 9]),
  ]),
  question('q08', 'FAST CHANGE', '计划在一周内被改了三次，你倾向于怎样应对？', [
    option('q08-a', '接受变化，先调小步快跑的下一版', [9, 6, 4, 4, 6, 4, 10, 5]),
    option('q08-b', '先评估影响，守住关键流程再调整', [4, 9, 6, 6, 5, 9, 4, 9]),
    option('q08-c', '把受影响的伙伴叫到一起重新排优先级', [6, 6, 5, 10, 9, 6, 7, 7]),
  ]),
  question('q09', 'YOUR SEAT', '在一支新团队里，你最愿意坐哪把椅子？', [
    option('q09-a', '探路者：不断找到下一个可能', [10, 4, 4, 5, 4, 3, 9, 5]),
    option('q09-b', '质量官：让每个细节经得起复盘', [4, 9, 10, 4, 5, 8, 3, 9]),
    option('q09-c', '连接者：把分散的人和资源串成一体', [6, 6, 5, 10, 8, 8, 7, 8]),
  ]),
  question('q10', 'DEADLINE', '离上线只剩两周，你会怎样处理取舍？', [
    option('q10-a', '先交付最小可用版本，边用边学', [9, 6, 5, 5, 6, 4, 10, 4]),
    option('q10-b', '宁可晚一点，也要把关键可靠性补齐', [3, 10, 7, 5, 5, 9, 3, 10]),
    option('q10-c', '邀请一批用户共创，把优先级交给场景', [6, 6, 5, 10, 10, 5, 7, 7]),
  ]),
  question('q11', 'ONE EXTRA BUDGET', '突然多出一笔预算，你最想投入在哪里？', [
    option('q11-a', '培训和工具，让团队的手艺继续变深', [6, 8, 10, 5, 3, 8, 5, 9]),
    option('q11-b', '新渠道和新场景，换来更多增长选项', [8, 5, 4, 8, 9, 5, 9, 6]),
    option('q11-c', '冗余与维护，把坏天气也纳入计划', [3, 9, 6, 5, 5, 10, 3, 10]),
  ]),
  question('q12', 'DISAGREEMENT', '团队对路线争执不下，你会把讨论带向哪里？', [
    option('q12-a', '回到证据，先验证各自最关键的假设', [8, 7, 8, 4, 4, 5, 8, 6]),
    option('q12-b', '回到共同目标，重新分配彼此能承担的部分', [5, 6, 5, 10, 8, 5, 7, 7]),
    option('q12-c', '两条路都做小样，交给结果来投票', [10, 5, 4, 6, 5, 4, 10, 5]),
  ]),
  question('q13', 'WHAT TO MEASURE', '复盘一项工作时，哪种结果最能说服你？', [
    option('q13-a', '用户愿不愿意回来、继续使用', [4, 6, 6, 6, 10, 5, 5, 9]),
    option('q13-b', '流程是否更稳定、交付是否更准时', [4, 10, 6, 5, 5, 9, 4, 9]),
    option('q13-c', '有没有多出一个此前没有的解法', [10, 5, 5, 4, 4, 4, 10, 5]),
  ]),
  question('q14', 'NEW MARKET', '进入陌生市场，你会先选择哪条路径？', [
    option('q14-a', '找本地伙伴，一起画出生态地图', [7, 5, 5, 10, 8, 6, 10, 6]),
    option('q14-b', '复制最成熟的标准，把交付先做稳', [4, 9, 7, 6, 6, 9, 5, 9]),
    option('q14-c', '先跟当地用户相处，重新理解需求', [8, 5, 8, 7, 10, 5, 9, 6]),
  ]),
  question('q15', 'A SETBACK', '一次重要尝试失败后，你最先保护什么？', [
    option('q15-a', '把过程拆开复盘，留下可复用的能力', [5, 8, 9, 7, 4, 8, 5, 10]),
    option('q15-b', '修改原先假设，再找一条更轻的路径', [10, 5, 5, 4, 5, 4, 10, 5]),
    option('q15-c', '先把客户和伙伴的信任补回来', [5, 6, 5, 10, 10, 7, 5, 8]),
  ]),
  question('q16', 'YOUR MOTTO', '下面哪句话最像你想留下的工作印记？', [
    option('q16-a', '永远保留下一个问题，别让好奇心熄灭', [10, 4, 6, 4, 5, 4, 9, 6]),
    option('q16-b', '把复杂事情做成可靠的日常', [4, 9, 8, 6, 5, 10, 4, 10]),
    option('q16-c', '让更多人因为我们的连接而受益', [6, 6, 5, 10, 10, 7, 7, 8]),
  ]),
]

export const QUIZ_QUESTIONS = questions
export const dimensions = DIMENSIONS
export const quizData = { dimensions: DIMENSIONS, questions }

export default quizData
