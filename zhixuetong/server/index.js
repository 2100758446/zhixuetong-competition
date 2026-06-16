require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { initDatabase } = require('./db')
const {
  ensureDemoUser, register, login,
  migrateNotes, getNotes, getNoteTree, getNoteById, searchNotes, getBacklinks, getNoteGraph, getNoteGraphEnhanced,
  getAIAnalysis, saveAIAnalysis,
  addNote, updateNote, deleteNote, moveNote,
  getSubjects, addSubject, updateSubject, deleteSubject,
  getAllTasks, getTodayTasks, getWeekTasks, addTask, updateTask, deleteTask,
  toggleTaskDone, getTaskStats,
  getDeadlines, addDeadline, deleteDeadline,
  getCheckins, getTodayCheckin, doCheckin, cancelTodayCheckin, getCheckinStats,
} = require('./userStore')

const app = express()
const PORT = 3000

// ── 中间件 ──
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// ── 异步启动：先初始化数据库，再确保 demo 账号 + 迁移旧数据 ──
async function start() {
  await initDatabase()
  ensureDemoUser()
  migrateNotes()

// ── 注册 ──
app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body
  const result = register(username, password, email)
  if (result.error) return res.status(400).json(result)
  res.json({ success: true })
})

// ── 登录 ──
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  const result = login(username, password)
  if (result.error) return res.status(401).json(result)
  res.json({ success: true, username: result.username })
})

// ── 聊天接口（支持 messages 数组和 message 字符串两种格式） ──
const DEFAULT_SYSTEM = '你是"智学通"AI学习助手，专门帮助学生解答学习问题。请用清晰、友好的语言回答，适当使用Markdown格式排版。'

app.post('/api/chat', async (req, res) => {
  const { message, messages: msgArray } = req.body

  // 构造 messages：优先用 messages 数组，否则兼容单条 message
  let apiMessages
  if (Array.isArray(msgArray) && msgArray.length > 0) {
    // 如果第一条不是 system，自动补上默认 system
    if (msgArray[0].role !== 'system') {
      apiMessages = [{ role: 'system', content: DEFAULT_SYSTEM }, ...msgArray]
    } else {
      apiMessages = msgArray
    }
  } else if (message && typeof message === 'string') {
    apiMessages = [
      { role: 'system', content: DEFAULT_SYSTEM },
      { role: 'user', content: message },
    ]
  } else {
    return res.status(400).json({ error: '请提供 messages 数组或 message 字符串' })
  }

  // 检查 API Key 是否已配置
  if (!process.env.API_KEY || process.env.API_KEY === 'sk-your-api-key-here') {
    return res.status(503).json({
      error: 'AI 功能未配置',
      detail: '请将 server/.env.example 复制为 server/.env 并填入你的大模型 API Key。',
    })
  }

  try {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/chat/completions`,
      {
        model: process.env.MODEL_NAME,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2048,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        timeout: 30000,
      },
    )

    const reply = response.data.choices[0].message.content
    res.json({ reply })
  } catch (err) {
    console.error('API 调用失败:', err.response?.data || err.message)
    res.status(500).json({
      error: 'AI 服务暂时不可用，请检查 API 配置或稍后重试',
      detail: err.response?.data?.error?.message || err.message,
    })
  }
})

// ── 笔记 ──
app.get('/api/notes/tree', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getNoteTree(username))
})

app.get('/api/notes/search', (req, res) => {
  const { username, q } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(searchNotes(username, q || ''))
})

app.get('/api/notes/graph', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getNoteGraphEnhanced(username))
})

app.get('/api/notes', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getNotes(username))
})

app.get('/api/notes/:id/backlinks', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getBacklinks(username, req.params.id))
})

// 获取某篇笔记的 AI 分析结果（概念 + 关联）
app.get('/api/notes/:id/concepts', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const ai = getAIAnalysis(username)
  if (!ai) return res.json({ concepts: [], relatedLinks: [] })
  const noteConcepts = (ai.concepts || []).find((c) => c.noteId === req.params.id)
  const relatedLinks = (ai.links || []).filter(
    (l) => l.source === req.params.id || l.target === req.params.id,
  )
  const allNotes = getNotes(username)
  const noteMap = new Map(allNotes.map((n) => ({ id: n.id, title: n.title })).map((n) => [n.id, n]))
  res.json({
    concepts: noteConcepts?.items || [],
    relatedLinks: relatedLinks.map((l) => ({
      ...l,
      sourceTitle: noteMap.get(l.source)?.title || '',
      targetTitle: noteMap.get(l.target)?.title || '',
    })),
  })
})

app.get('/api/notes/:id', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const note = getNoteById(username, req.params.id)
  if (!note) return res.status(404).json({ error: '笔记不存在' })
  res.json(note)
})

app.post('/api/notes', (req, res) => {
  const { username, ...note } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(addNote(username, note))
})

app.put('/api/notes/:id', (req, res) => {
  const { username, ...updates } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const result = updateNote(username, req.params.id, updates)
  if (!result) return res.status(404).json({ error: '笔记不存在' })
  res.json(result)
})

app.put('/api/notes/:id/move', (req, res) => {
  const { username, parentId, sort } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const result = moveNote(username, req.params.id, parentId, sort)
  if (!result) return res.status(404).json({ error: '笔记不存在' })
  res.json(result)
})

app.delete('/api/notes/:id', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  if (!deleteNote(username, req.params.id)) return res.status(404).json({ error: '笔记不存在' })
  res.json({ success: true })
})

// ── AI 知识图谱分析（增量：只分析新增/修改的笔记） ──
app.post('/api/notes/analyze', async (req, res) => {
  const { username, force } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })

  // 检查 API Key
  if (!process.env.API_KEY || process.env.API_KEY === 'sk-your-api-key-here') {
    return res.status(503).json({
      error: 'AI 功能未配置',
      detail: '请将 server/.env.example 复制为 server/.env 并填入你的大模型 API Key。',
    })
  }

  const allNotes = getNotes(username).filter((n) => n.content && n.content.trim().length > 0)
  if (allNotes.length === 0) {
    saveAIAnalysis(username, { concepts: [], links: [] })
    return res.json(getNoteGraphEnhanced(username))
  }

  const prev = getAIAnalysis(username)
  const lastAnalyzedAt = prev?.analyzedAt ? new Date(prev.analyzedAt) : null

  // 增量模式：只分析上次分析之后新增/修改的笔记
  let newNotes = allNotes
  if (!force && lastAnalyzedAt && prev?.concepts?.length > 0) {
    const prevNoteIds = new Set(prev.concepts.map((c) => c.noteId))
    newNotes = allNotes.filter((n) => {
      if (!prevNoteIds.has(n.id)) return true // 新笔记
      if (new Date(n.updatedAt) > lastAnalyzedAt) return true // 修改过
      return false
    })
    if (newNotes.length === 0) {
      console.log('[AI analysis] 没有新笔记，跳过分析')
      return res.json({ ...getNoteGraphEnhanced(username), skipped: true })
    }
    console.log(`[AI analysis] 增量模式：${newNotes.length}/${allNotes.length} 篇需要分析`)
  } else {
    console.log(`[AI analysis] 全量模式：${allNotes.length} 篇`)
  }

  const BATCH_SIZE = 12
  // 保留旧数据中未变更笔记的概念
  const prevConcepts = prev?.concepts || []
  const prevLinks = prev?.links || []
  const newNoteIds = new Set(newNotes.map((n) => n.id))
  // 保留未变更笔记的旧概念
  const allConcepts = prevConcepts.filter((c) => !newNoteIds.has(c.noteId))
  // 保留不涉及变更笔记的旧链接
  const allLinks = prevLinks.filter((l) => !newNoteIds.has(l.source) && !newNoteIds.has(l.target))
  let batchErrors = 0

  try {
    // 分批：只分析新增/修改的笔记
    for (let i = 0; i < newNotes.length; i += BATCH_SIZE) {
      const batch = newNotes.slice(i, i + BATCH_SIZE)
      const noteSummaries = batch.map((n) => {
        const snippet = n.content.replace(/\n/g, ' ').slice(0, 80)
        return `[${n.id}]《${n.title}》${snippet ? ': ' + snippet : ''}`
      }).join('\n')

      const prompt = `分析以下学习笔记，为每篇提取1-2个核心概念。

笔记：
${noteSummaries}

直接输出JSON（不要markdown代码块标记，不要任何解释文字）：
{"concepts":[{"noteId":"ID","items":[{"name":"概念","summary":"一句话"}]}]}`

      try {
        const response = await axios.post(
          `${process.env.API_BASE_URL}/chat/completions`,
          {
            model: process.env.MODEL_NAME,
            messages: [
              { role: 'system', content: '你是知识图谱分析专家。直接输出JSON，不要任何其他文字。' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.API_KEY}`,
            },
            timeout: 120000,
          },
        )

        const msg = response.data.choices[0].message
        const reply = msg.content || msg.reasoning_content || ''
        let parsed
        try {
          parsed = JSON.parse(reply)
        } catch {
          const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (jsonMatch) parsed = JSON.parse(jsonMatch[1])
          else {
            const braceMatch = reply.match(/\{[\s\S]*\}/)
            if (braceMatch) parsed = JSON.parse(braceMatch[0])
            else throw new Error('无法解析 JSON')
          }
        }
        if (parsed.concepts) allConcepts.push(...parsed.concepts)
        console.log(`[AI batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newNotes.length / BATCH_SIZE)}] ${batch.length} notes, ${parsed.concepts?.length || 0} concepts extracted`)
      } catch (err) {
        batchErrors++
        console.error(`[AI batch ${Math.floor(i / BATCH_SIZE) + 1} failed]:`, err.message)
      }
    }

    // 第二阶段：分析跨笔记关联（只找涉及新笔记的关联）
    if (newNotes.length > 0) {
      const LINK_BATCH = 15
      const allTitles = allNotes.map((n) => `[${n.id}]《${n.title}》`).join('\n')
      for (let i = 0; i < newNotes.length; i += LINK_BATCH) {
        const linkBatch = newNotes.slice(i, i + LINK_BATCH)
      const linkPrompt = `从以下笔记中找出与这批「焦点笔记」有知识关联的其他笔记。

全部笔记：
${allTitles}

焦点笔记（需要为它们找关联）：
${linkBatch.map((n) => `[${n.id}]《${n.title}》`).join('\n')}

直接输出JSON（只要涉及焦点笔记的关联）：
{"links":[{"source":"笔记ID","target":"笔记ID","type":"prerequisite|extends|related|application","label":"关联说明"}]}
type: prerequisite=前置知识, extends=延伸扩展, related=相关概念, application=应用场景`

      try {
        const linkResponse = await axios.post(
          `${process.env.API_BASE_URL}/chat/completions`,
          {
            model: process.env.MODEL_NAME,
            messages: [
              { role: 'system', content: '你是知识图谱分析专家。直接输出JSON。' },
              { role: 'user', content: linkPrompt },
            ],
            temperature: 0.3,
            max_tokens: 16384,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.API_KEY}`,
            },
            timeout: 300000,
          },
      )

      const msg = linkResponse.data.choices[0].message
      const reply = msg.content || msg.reasoning_content || ''
      let parsed
      try {
        parsed = JSON.parse(reply)
      } catch {
        const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1])
        else {
          const braceMatch = reply.match(/\{[\s\S]*\}/)
          if (braceMatch) parsed = JSON.parse(braceMatch[0])
          else throw new Error('无法解析 JSON')
        }
      }
        if (parsed.links) allLinks.push(...parsed.links)
        console.log(`[AI links batch ${Math.floor(i / LINK_BATCH) + 1}/${Math.ceil(newNotes.length / LINK_BATCH)}] ${parsed.links?.length || 0} links found`)
      } catch (err) {
        batchErrors++
        console.error(`[AI links batch ${Math.floor(i / LINK_BATCH) + 1} failed]:`, err.message)
      }
    }
    } // end if (newNotes.length > 0)

    // 去重链接
    const seenLinks = new Set()
    const uniqueLinks = []
    for (const l of allLinks) {
      const key = [l.source, l.target].sort().join('->') + '|' + l.type
      if (!seenLinks.has(key)) {
        seenLinks.add(key)
        uniqueLinks.push(l)
      }
    }

    saveAIAnalysis(username, { concepts: allConcepts, links: uniqueLinks })
    console.log(`[AI analysis done] ${allConcepts.length} concept groups, ${uniqueLinks.length} links (${allLinks.length - uniqueLinks.length} dupes removed), ${batchErrors} errors`)
    res.json(getNoteGraphEnhanced(username))
  } catch (err) {
    console.error('AI 图谱分析失败:', err.code || '', err.message)
    res.status(500).json({
      error: 'AI 分析失败，请稍后重试',
      detail: err.response?.data?.error?.message || err.message,
    })
  }
})

// ── 学科 CRUD ──
app.get('/api/subjects', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getSubjects(username))
})
app.post('/api/subjects', (req, res) => {
  const { username, ...data } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(addSubject(username, data))
})
app.put('/api/subjects/:id', (req, res) => {
  const { username, ...updates } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const result = updateSubject(username, req.params.id, updates)
  if (!result) return res.status(404).json({ error: '学科不存在' })
  res.json(result)
})
app.delete('/api/subjects/:id', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  if (!deleteSubject(username, req.params.id)) return res.status(404).json({ error: '学科不存在' })
  res.json({ success: true })
})

// ── 任务查询 ──
app.get('/api/tasks/today', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getTodayTasks(username))
})
app.get('/api/tasks/week', (req, res) => {
  const { username, startDate } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getWeekTasks(username, startDate || new Date().toISOString().slice(0, 10)))
})
app.get('/api/tasks/stats', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getTaskStats(username))
})

// ── 任务 CRUD ──
app.post('/api/tasks', (req, res) => {
  const { username, ...data } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(addTask(username, data))
})
app.put('/api/tasks/:id', (req, res) => {
  const { username, ...updates } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const result = updateTask(username, req.params.id, updates)
  if (!result) return res.status(404).json({ error: '任务不存在' })
  res.json(result)
})
app.delete('/api/tasks/:id', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  if (!deleteTask(username, req.params.id)) return res.status(404).json({ error: '任务不存在' })
  res.json({ success: true })
})

// ── 任务打卡（toggle 时全部完成→自动打卡，取消勾选→取消自动打卡）──
app.post('/api/tasks/:id/toggle', (req, res) => {
  const { username, date } = req.body
  if (!username || !date) return res.status(400).json({ error: '缺少 username 或 date' })
  const result = toggleTaskDone(username, req.params.id, date)

  // 仅当天操作才影响打卡（用本地日期比较）
  const localToday = new Date()
  const localTodayStr = localToday.getFullYear() + '-' + String(localToday.getMonth() + 1).padStart(2, '0') + '-' + String(localToday.getDate()).padStart(2, '0')
  if (date === localTodayStr) {
    const todayTasks = getTodayTasks(username)
    const allDone = todayTasks.length > 0 && todayTasks.every((t) => t.done)

    if (allDone) {
      // 全部完成 → 自动打卡
      doCheckin(username, 'auto', '', todayTasks.filter((t) => t.done).length, todayTasks.length)
    } else if (!result.done) {
      // 取消勾选 → 如果之前是自动打卡，就取消
      const todayCheckin = getTodayCheckin(username)
      if (todayCheckin && todayCheckin.type === 'auto') {
        cancelTodayCheckin(username)
      }
    }
  }

  res.json(result)
})

// ── 倒计时 CRUD ──
app.get('/api/deadlines', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getDeadlines(username))
})
app.post('/api/deadlines', (req, res) => {
  const { username, ...data } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(addDeadline(username, data))
})
app.delete('/api/deadlines/:id', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  if (!deleteDeadline(username, req.params.id)) return res.status(404).json({ error: '倒计时不存在' })
  res.json({ success: true })
})

// ── 打卡 ──
app.get('/api/checkins/stats', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })

  const stats = getCheckinStats(username)
  // 合并今日任务完成情况
  const todayTasks = getTodayTasks(username)
  const todayTotal = todayTasks.length
  const todayDone = todayTasks.filter((t) => t.done).length
  res.json({ ...stats, todayTotal, todayDone, todayAllDone: todayTotal > 0 && todayDone === todayTotal })
})

app.get('/api/checkins', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  res.json(getCheckins(username))
})

app.post('/api/checkin', (req, res) => {
  const { username, note, date } = req.body
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const todayTasks = getTodayTasks(username)
  const done = todayTasks.filter((t) => t.done).length
  const result = doCheckin(username, 'manual', note || '', done, todayTasks.length, date || undefined)
  res.json({ ...result, stats: getCheckinStats(username) })
})

app.delete('/api/checkins/today', (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: '缺少 username' })
  const ok = cancelTodayCheckin(username)
  res.json({ success: ok, stats: getCheckinStats(username) })
})

// ── 健康检查 ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

  app.listen(PORT, () => {
    console.log(`✅ 后端服务已启动: http://localhost:${PORT}`)
  })
}

start()
