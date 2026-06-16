const bcrypt = require('bcryptjs')
const { db } = require('./db')

const SALT_ROUNDS = 10

// ══════════════════════════════════════════
//  用户
// ══════════════════════════════════════════

// ── 用户（SQLite） ──
function ensureDemoUser() {
  const exists = db.prepare('SELECT username FROM users WHERE username = ?').get('demo')
  if (!exists) {
    db.prepare('INSERT INTO users (username, password, email, created_at) VALUES (?, ?, ?, ?)')
      .run('demo', bcrypt.hashSync('demo123', SALT_ROUNDS), 'demo@zhixuetong.com', new Date().toISOString())
    console.log('✅ 已创建内置演示账号 demo / demo123')
  }
}

function register(username, password, email) {
  if (!username || username.trim().length < 3) return { error: '用户名至少需要 3 个字符' }
  if (!password || password.length < 6) return { error: '密码至少需要 6 个字符' }
  const exists = db.prepare('SELECT username FROM users WHERE username = ?').get(username.trim())
  if (exists) return { error: '用户名已存在' }
  db.prepare('INSERT INTO users (username, password, email, created_at) VALUES (?, ?, ?, ?)')
    .run(username.trim(), bcrypt.hashSync(password, SALT_ROUNDS), email || '', new Date().toISOString())
  return { success: true }
}

function login(username, password) {
  const user = db.prepare('SELECT username, password FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password)) return { error: '用户名或密码错误' }
  return { success: true, username: user.username }
}

// ══════════════════════════════════════════
//  笔记（树形结构 — SQLite）
// ══════════════════════════════════════════

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// 本地日期字符串（YYYY-MM-DD），避免 UTC 时区偏移
function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// ── 迁移：旧数据按 subject 生成文件夹（改从 DB 读写） ──
function migrateNotes() {
  const done = db.prepare("SELECT value FROM meta WHERE key = ?").get('notes_migrated')
  if (done) return

  const all = db.prepare('SELECT id, username, title, content, parent_id AS parentId, sort, created_at AS createdAt, updated_at AS updatedAt FROM notes').all()
  if (all.length === 0) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('notes_migrated', '1')
    return
  }

  // 检查是否有需要迁移的旧格式（含 subject 字段但没有 parentId 的不在 SQL 列里，这里处理旧 subject 逻辑）
  let changed = false
  const subjects = new Map()
  for (const n of all) {
    if (n.parentId !== '') continue // 已有父子关系，跳过
    // 尝试从 content 或 title 推断（旧数据无 subject 字段的情况直接归入「未分类」）
    const subj = n.subject || '未分类'
    if (!subjects.has(subj)) {
      const folderId = genId()
      subjects.set(subj, folderId)
      db.prepare('INSERT INTO notes (id, username, title, content, parent_id, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(folderId, n.username, subj, '', '', 0, new Date().toISOString(), new Date().toISOString())
      changed = true
    }
    db.prepare('UPDATE notes SET parent_id = ?, sort = 0, updated_at = ? WHERE id = ? AND username = ?')
      .run(subjects.get(subj), new Date().toISOString(), n.id, n.username)
    changed = true
  }
  if (changed) console.log('✅ 笔记数据已自动迁移（按学科生成文件夹）')

  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('notes_migrated', '1')
}

// ── 获取用户所有笔记 ──
function getNotes(username) {
  return db.prepare('SELECT id, username, title, content, parent_id, sort, created_at, updated_at FROM notes WHERE username = ? ORDER BY sort, title').all(username)
}

// ── 构建树结构 ──
function getNoteTree(username) {
  const all = getNotes(username)
  const map = new Map()
  for (const n of all) map.set(n.id, { ...n, children: [] })
  const roots = []
  for (const n of all) {
    const node = map.get(n.id)
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortTree = (nodes) => {
    nodes.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.title.localeCompare(b.title))
    for (const n of nodes) sortTree(n.children)
  }
  sortTree(roots)
  return roots
}

// ── 获取单个笔记 + 面包屑父链 ──
function getNoteById(username, id) {
  const note = db.prepare('SELECT id, username, title, content, parent_id, sort, created_at, updated_at FROM notes WHERE id = ? AND username = ?').get(id, username)
  if (!note) return null
  const all = getNotes(username)
  const breadcrumb = []
  let current = note
  while (current.parentId) {
    const parent = all.find((n) => n.id === current.parentId)
    if (!parent) break
    breadcrumb.unshift({ id: parent.id, title: parent.title })
    current = parent
  }
  return { ...note, breadcrumb }
}

// ── 搜索笔记（标题模糊匹配 — SQL LIKE） ──
function searchNotes(username, query) {
  if (!query) return []
  return db.prepare("SELECT id, title, parent_id FROM notes WHERE username = ? AND title LIKE ? ORDER BY title LIMIT 20")
    .all(username, '%' + query + '%')
}

// ── 反向链接：哪些笔记引用了目标笔记 ──
function getBacklinks(username, noteId) {
  const pattern = new RegExp(`\\[\\[id:${noteId}\\|([^\\]]*)\\]\\]`, 'g')
  const candidates = db.prepare("SELECT id, title, parent_id, content FROM notes WHERE username = ? AND id != ? AND content LIKE '%[[id:' || ? || '|%'")
    .all(username, noteId, noteId)
  return candidates.map((note) => {
    const matches = [...note.content.matchAll(pattern)]
    return {
      id: note.id,
      title: note.title,
      parentId: note.parentId,
      context: matches[0]?.[1] || note.title,
    }
  })
}

// ── 知识图谱数据 ──
function getNoteGraph(username) {
  const all = getNotes(username)
  const idSet = new Set(all.map((n) => n.id))

  // 根节点（parentId 为空或指向不存在的节点）
  const rootIds = new Set(all.filter((n) => !n.parentId || !idSet.has(n.parentId)).map((n) => n.id))

  // 每个节点向上找分组
  const groupMap = new Map()
  for (const n of all) {
    let current = n
    while (current.parentId && idSet.has(current.parentId) && !rootIds.has(current.parentId)) {
      const parent = all.find((p) => p.id === current.parentId)
      if (!parent) break
      current = parent
    }
    groupMap.set(n.id, current.id)
  }

  // 提取边
  const edgeSet = new Set()
  const edges = []
  const linkCountMap = new Map()

  // 1. 父子关系边
  for (const note of all) {
    if (note.parentId && idSet.has(note.parentId)) {
      const key = `${note.parentId}->${note.id}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push({ source: note.parentId, target: note.id })
      }
      linkCountMap.set(note.id, (linkCountMap.get(note.id) || 0) + 1)
    }
  }

  // 2. Wiki [[链接]] 边
  const linkPattern = /\[\[id:([^|]+)\|[^\]]*\]\]/g
  for (const note of all) {
    if (!note.content) continue
    const matches = [...note.content.matchAll(linkPattern)]
    for (const m of matches) {
      const targetId = m[1]
      if (!idSet.has(targetId) || targetId === note.id) continue
      const key = `${note.id}->${targetId}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push({ source: note.id, target: targetId })
      }
      linkCountMap.set(targetId, (linkCountMap.get(targetId) || 0) + 1)
    }
  }

  // 有链接关系的节点
  const connectedIds = new Set()
  for (const e of edges) { connectedIds.add(e.source); connectedIds.add(e.target) }

  const nodes = all
    .filter((n) => connectedIds.has(n.id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      parentId: n.parentId,
      topId: groupMap.get(n.id),
      linkCount: linkCountMap.get(n.id) || 0,
    }))

  const groupIds = [...new Set(nodes.map((n) => n.topId))].filter((gid) => !rootIds.has(gid))
  const topFolders = groupIds.map((gid) => {
    const g = all.find((n) => n.id === gid)
    return { id: gid, title: g?.title || '未分组' }
  })

  return { nodes, edges, topFolders }
}

// ── 新建笔记 ──
function addNote(username, note) {
  const id = genId()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO notes (id, username, title, content, parent_id, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, username, note.title || '无标题', note.content || '', note.parentId || '', note.sort ?? 0, now, now)
  return db.prepare('SELECT id, username, title, content, parent_id, sort, created_at, updated_at FROM notes WHERE id = ?').get(id)
}

// ── 更新笔记（动态 SET，保护 id/username/createdAt 不被覆盖） ──
function updateNote(username, id, updates) {
  const existing = db.prepare('SELECT id FROM notes WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return null

  // 字段映射：允许更新的字段及其 SQL 列名
  const fieldMap = { title: 'title', content: 'content', parentId: 'parent_id', sort: 'sort' }
  const setClauses = []
  const params = []
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'username' || key === 'createdAt') continue
    const col = fieldMap[key]
    if (col === undefined) continue
    setClauses.push(`${col} = ?`)
    params.push(value)
  }
  if (setClauses.length === 0) return existing

  const now = new Date().toISOString()
  setClauses.push('updated_at = ?')
  params.push(now)
  params.push(id, username)

  db.prepare(`UPDATE notes SET ${setClauses.join(', ')} WHERE id = ? AND username = ?`).run(...params)
  return db.prepare('SELECT id, username, title, content, parent_id, sort, created_at, updated_at FROM notes WHERE id = ?').get(id)
}

// ── 级联删除（参数化递归遍历，安全无注入） ──
function deleteNote(username, id) {
  const existing = db.prepare('SELECT id FROM notes WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return false

  // JS 递归收集所有子孙节点 ID，再批量删除（参数化安全）
  const toDelete = new Set()
  function collect(pid) {
    toDelete.add(pid)
    const children = db.prepare('SELECT id FROM notes WHERE parent_id = ? AND username = ?').all(pid, username)
    for (const child of children) collect(child.id)
  }
  collect(id)

  // 批量删除
  const deleteStmt = db.prepare('DELETE FROM notes WHERE id = ? AND username = ?')
  for (const nid of toDelete) {
    deleteStmt.run(nid, username)
  }
  return true
}

// ── 移动笔记 ──
function moveNote(username, id, newParentId, newSort) {
  const existing = db.prepare('SELECT id FROM notes WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return null

  const now = new Date().toISOString()
  db.prepare('UPDATE notes SET parent_id = ?, sort = ?, updated_at = ? WHERE id = ? AND username = ?')
    .run(newParentId || '', newSort ?? 0, now, id, username)
  return db.prepare('SELECT id, username, title, content, parent_id, sort, created_at, updated_at FROM notes WHERE id = ?').get(id)
}

// ══════════════════════════════════════════
//  学科分组（SQLite）
// ══════════════════════════════════════════

function getSubjects(username) {
  // sort_order 是 SQL 关键字，用 AS "order" 别名对齐前端接口
  return db.prepare('SELECT id, username, name, color, sort_order AS "order", created_at FROM subjects WHERE username = ? ORDER BY sort_order')
    .all(username)
}

function addSubject(username, data) {
  const id = genId()
  // 自动计算下一个 sort_order
  const max = db.prepare('SELECT MAX(sort_order) AS maxOrder FROM subjects WHERE username = ?').get(username)
  const nextOrder = (max?.maxOrder ?? -1) + 1
  db.prepare('INSERT INTO subjects (id, username, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, username, data.name || '未命名', data.color || '#6366f1', nextOrder, new Date().toISOString())
  return db.prepare('SELECT id, username, name, color, sort_order AS "order", created_at FROM subjects WHERE id = ?').get(id)
}

function updateSubject(username, id, updates) {
  const existing = db.prepare('SELECT id FROM subjects WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return null

  const fieldMap = { name: 'name', color: 'color', order: 'sort_order' }
  const setClauses = []
  const params = []
  for (const [key, value] of Object.entries(updates)) {
    const col = fieldMap[key]
    if (!col) continue
    setClauses.push(`${col} = ?`)
    params.push(value)
  }
  if (setClauses.length === 0) return existing
  params.push(id, username)

  db.prepare(`UPDATE subjects SET ${setClauses.join(', ')} WHERE id = ? AND username = ?`).run(...params)
  return db.prepare('SELECT id, username, name, color, sort_order AS "order", created_at FROM subjects WHERE id = ?').get(id)
}

function deleteSubject(username, id) {
  const existing = db.prepare('SELECT id FROM subjects WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return false

  // 级联删除顺序：task_done → tasks → subject
  db.prepare('DELETE FROM task_done WHERE task_id IN (SELECT id FROM tasks WHERE subject_id = ? AND username = ?)').run(id, username)
  db.prepare('DELETE FROM tasks WHERE subject_id = ? AND username = ?').run(id, username)
  db.prepare('DELETE FROM subjects WHERE id = ? AND username = ?').run(id, username)

  return true
}

// ══════════════════════════════════════════
//  任务 + 完成记录（SQLite）
// ══════════════════════════════════════════

// ── 任务行解析：repeat_days JSON 字符串 → 数组 ──
function parseTask(row) {
  if (!row) return row
  return {
    ...row,
    repeatDays: typeof row.repeatDays === 'string' ? JSON.parse(row.repeatDays) : (row.repeatDays || []),
  }
}

function getAllTasks(username) {
  return db.prepare('SELECT id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at FROM tasks WHERE username = ?').all(username).map(parseTask)
}

function getTodayTasks(username) {
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  const dayOfWeek = today.getDay()
  const dayOfMonth = today.getDate()
  const subjects = getSubjects(username)
  const doneRecords = db.prepare('SELECT task_id FROM task_done WHERE username = ? AND date = ?').all(username, todayStr)
  const doneTaskIds = new Set(doneRecords.map((d) => d.taskId))

  const allTasks = getAllTasks(username)
  const todayTasks = allTasks.filter((t) => {
    if (t.repeatType === 'none') return t.dueDate === todayStr
    if (t.repeatType === 'daily') return true
    if (t.repeatType === 'weekly') return (t.repeatDays || []).includes(dayOfWeek)
    if (t.repeatType === 'monthly') {
      if (!t.dueDate) return false
      return new Date(t.dueDate).getDate() === dayOfMonth
    }
    return false
  })

  return todayTasks.map((t) => {
    const subj = subjects.find((s) => s.id === t.subjectId)
    return { ...t, done: doneTaskIds.has(t.id), subjectName: subj?.name || '未分类', subjectColor: subj?.color || '#9ca3af' }
  }).sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
}

function getWeekTasks(username, startDate) {
  const subjects = getSubjects(username)
  const doneRecords = db.prepare('SELECT task_id, date FROM task_done WHERE username = ?').all(username)
  const allTasks = getAllTasks(username)
  const result = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(new Date(startDate).getTime() + i * 86400000)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const dayOfWeek = d.getDay()
    const dayOfMonth = d.getDate()
    const doneIds = new Set(doneRecords.filter((r) => r.date === dateStr).map((r) => r.taskId))

    const dayTasks = allTasks.filter((t) => {
      if (t.repeatType === 'none') return t.dueDate === dateStr
      if (t.repeatType === 'daily') return true
      if (t.repeatType === 'weekly') return (t.repeatDays || []).includes(dayOfWeek)
      if (t.repeatType === 'monthly') return t.dueDate && new Date(t.dueDate).getDate() === dayOfMonth
      return false
    }).map((t) => {
      const subj = subjects.find((s) => s.id === t.subjectId)
      return { ...t, done: doneIds.has(t.id), subjectName: subj?.name || '未分类', subjectColor: subj?.color || '#9ca3af' }
    })

    result.push({ date: dateStr, tasks: dayTasks })
  }
  return result
}

function addTask(username, data) {
  const id = genId()
  db.prepare('INSERT INTO tasks (id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, username, data.subjectId || '', data.title || '', data.note || '', data.repeatType || 'none', JSON.stringify(data.repeatDays || []), data.startTime || '', data.endTime || '', data.dueDate || null, new Date().toISOString())
  return parseTask(db.prepare('SELECT id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at FROM tasks WHERE id = ?').get(id))
}

function updateTask(username, id, updates) {
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return null

  const fieldMap = { subjectId: 'subject_id', title: 'title', note: 'note', repeatType: 'repeat_type', repeatDays: 'repeat_days', startTime: 'start_time', endTime: 'end_time', dueDate: 'due_date' }
  const setClauses = []
  const params = []
  for (const [key, value] of Object.entries(updates)) {
    const col = fieldMap[key]
    if (!col) continue
    setClauses.push(`${col} = ?`)
    // repeat_days 自动序列化为 JSON 字符串
    params.push(key === 'repeatDays' ? JSON.stringify(value) : value)
  }
  if (setClauses.length === 0) return existing
  params.push(id, username)

  db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ? AND username = ?`).run(...params)
  return parseTask(db.prepare('SELECT id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at FROM tasks WHERE id = ?').get(id))
}

function deleteTask(username, id) {
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return false

  db.prepare('DELETE FROM tasks WHERE id = ? AND username = ?').run(id, username)
  // 级联清理完成记录
  db.prepare('DELETE FROM task_done WHERE task_id = ? AND username = ?').run(id, username)
  return true
}

// ── 任务完成打卡 ──
function toggleTaskDone(username, taskId, date) {
  const existing = db.prepare('SELECT id FROM task_done WHERE task_id = ? AND username = ? AND date = ?').get(taskId, username, date)
  if (existing) {
    db.prepare('DELETE FROM task_done WHERE id = ?').run(existing.id)
    return { done: false }
  }
  db.prepare('INSERT OR IGNORE INTO task_done (task_id, username, date) VALUES (?, ?, ?)').run(taskId, username, date)
  return { done: true }
}

function getTaskStats(username) {
  const allTasks = getAllTasks(username)
  const records = db.prepare('SELECT task_id, date FROM task_done WHERE username = ?').all(username)
  const today = new Date()

  // 连续天数
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const dayOfWeek = d.getDay()
    const dayOfMonth = d.getDate()
    const expectedTasks = allTasks.filter((t) => {
      if (t.repeatType === 'none') return t.dueDate === dateStr
      if (t.repeatType === 'daily') return true
      if (t.repeatType === 'weekly') return (t.repeatDays || []).includes(dayOfWeek)
      if (t.repeatType === 'monthly') return t.dueDate && new Date(t.dueDate).getDate() === dayOfMonth
      return false
    })
    if (expectedTasks.length === 0) continue
    const doneIds = new Set(records.filter((r) => r.date === dateStr).map((r) => r.taskId))
    const allDone = expectedTasks.every((t) => doneIds.has(t.id))
    if (allDone) streak++
    else break
  }

  // 近 7 天
  const weekly = []
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const dayOfWeek = d.getDay()
    const dayOfMonth = d.getDate()
    const total = allTasks.filter((t) => {
      if (t.repeatType === 'none') return t.dueDate === dateStr
      if (t.repeatType === 'daily') return true
      if (t.repeatType === 'weekly') return (t.repeatDays || []).includes(dayOfWeek)
      if (t.repeatType === 'monthly') return t.dueDate && new Date(t.dueDate).getDate() === dayOfMonth
      return false
    }).length
    const done = records.filter((r) => r.date === dateStr).length
    weekly.push({ date: dateStr, label: dayNames[d.getDay()], total, done })
  }

  return { streak, weekly }
}

// ══════════════════════════════════════════
//  倒计时（SQLite）
// ══════════════════════════════════════════

function getDeadlines(username) {
  return db.prepare('SELECT id, username, title, date, created_at FROM deadlines WHERE username = ? ORDER BY date').all(username)
}

function addDeadline(username, data) {
  const id = genId()
  db.prepare('INSERT INTO deadlines (id, username, title, date, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, username, data.title || '', data.date || '', new Date().toISOString())
  return db.prepare('SELECT id, username, title, date, created_at FROM deadlines WHERE id = ?').get(id)
}

function deleteDeadline(username, id) {
  const existing = db.prepare('SELECT id FROM deadlines WHERE id = ? AND username = ?').get(id, username)
  if (!existing) return false
  db.prepare('DELETE FROM deadlines WHERE id = ? AND username = ?').run(id, username)
  return true
}

// ══════════════════════════════════════════
//  打卡系统（SQLite）
// ══════════════════════════════════════════

function getCheckins(username) {
  return db.prepare('SELECT id, username, date, type, note, task_done, task_total, created_at FROM checkins WHERE username = ? ORDER BY date').all(username)
}

// 获取今日打卡状态
function getTodayCheckin(username) {
  return db.prepare('SELECT id, username, date, type, note, task_done, task_total, created_at FROM checkins WHERE username = ? AND date = ?').get(username, todayStr()) || null
}

// 打卡（自动或手动），date 可选，默认今天
function doCheckin(username, type, note, taskDone, taskTotal, date) {
  const targetDate = date || todayStr()
  const now = new Date().toISOString()

  // 查询已有打卡，保留 auto 类型不被 manual 覆盖
  const existing = db.prepare('SELECT type FROM checkins WHERE username = ? AND date = ?').get(username, targetDate)
  const finalType = (existing?.type === 'auto' && type === 'manual') ? 'auto' : (type || 'manual')

  // UPSERT：利用 UNIQUE(username, date) 约束
  db.prepare(`
    INSERT INTO checkins (username, date, type, note, task_done, task_total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username, date) DO UPDATE SET
      type = excluded.type,
      note = excluded.note,
      task_done = excluded.task_done,
      task_total = excluded.task_total,
      created_at = excluded.created_at
  `).run(username, targetDate, finalType, note || '', taskDone ?? 0, taskTotal ?? 0, now)

  return db.prepare('SELECT id, username, date, type, note, task_done, task_total, created_at FROM checkins WHERE username = ? AND date = ?').get(username, targetDate)
}

// 取消今日打卡
function cancelTodayCheckin(username) {
  const result = db.prepare('DELETE FROM checkins WHERE username = ? AND date = ?').run(username, todayStr())
  return result.changes > 0
}

// 打卡统计：连续天数 + 近一年日历
function getCheckinStats(username) {
  const checkins = db.prepare('SELECT date FROM checkins WHERE username = ?').all(username)
  const doneDates = new Set(checkins.map((c) => c.date))
  const today = new Date()

  // 连续打卡天数
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    if (doneDates.has(dateStr)) streak++
    else break
  }

  // 今日是否已打卡
  const localToday = todayStr()
  const todayCheckin = db.prepare('SELECT id, username, date, type, note, task_done, task_total, created_at FROM checkins WHERE username = ? AND date = ?').get(username, localToday) || null
  const checkedInToday = !!todayCheckin

  // 最近 365 天打卡日历数据
  const calendar = []
  const startDate = new Date(today.getTime() - 364 * 86400000)
  for (let i = 0; i < 365; i++) {
    const d = new Date(startDate.getTime() + i * 86400000)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    calendar.push({
      date: dateStr,
      count: doneDates.has(dateStr) ? 1 : 0,
    })
  }

  const totalDays = checkins.length

  return { streak, checkedInToday, todayCheckin, calendar, totalDays }
}

// ══════════════════════════════════════════
//  AI 知识图谱分析（SQLite）
// ══════════════════════════════════════════

function getAIAnalysis(username) {
  const row = db.prepare('SELECT username, concepts, links, analyzed_at FROM ai_graph WHERE username = ?').get(username)
  if (!row) return null
  return {
    username: row.username,
    concepts: typeof row.concepts === 'string' ? JSON.parse(row.concepts) : (row.concepts || []),
    links: typeof row.links === 'string' ? JSON.parse(row.links) : (row.links || []),
    analyzedAt: row.analyzedAt,
  }
}

function saveAIAnalysis(username, data) {
  const now = new Date().toISOString()
  const conceptsStr = JSON.stringify(data.concepts || [])
  const linksStr = JSON.stringify(data.links || [])

  // UPSERT：每人一条记录
  db.prepare(`
    INSERT INTO ai_graph (username, concepts, links, analyzed_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      concepts = excluded.concepts,
      links = excluded.links,
      analyzed_at = excluded.analyzed_at
  `).run(username, conceptsStr, linksStr, now)

  return { username, concepts: data.concepts || [], links: data.links || [], analyzedAt: now }
}

// 增强版图谱：合并手动链接 + AI 推断链接 + 概念节点
function getNoteGraphEnhanced(username) {
  const base = getNoteGraph(username)
  const ai = getAIAnalysis(username)
  const allNotes = getNotes(username)
  const noteMap = new Map(allNotes.map((n) => [n.id, n]))

  if (!ai || (!ai.links.length && !ai.concepts.length)) {
    return { ...base, aiEdges: [], conceptNodes: [], aiAnalyzed: false }
  }

  // ── AI 推断链接（笔记→笔记） ──
  const aiEdges = ai.links
    .filter((l) => noteMap.has(l.source) && noteMap.has(l.target) && l.source !== l.target)
    .map((l) => ({
      source: l.source,
      target: l.target,
      type: l.type || 'related',
      label: l.label || '',
      ai: true,
    }))

  // 确保被 AI 链接引用的笔记出现在 nodes 里（即使没有手动链接）
  const existingNodeIds = new Set(base.nodes.map((n) => n.id))
  const extraNodeIds = new Set()
  for (const e of aiEdges) {
    if (!existingNodeIds.has(e.source)) extraNodeIds.add(e.source)
    if (!existingNodeIds.has(e.target)) extraNodeIds.add(e.target)
  }
  const extraNodes = [...extraNodeIds]
    .filter((id) => noteMap.has(id))
    .map((id) => {
      const note = noteMap.get(id)
      return {
        id: note.id,
        title: note.title,
        parentId: note.parentId || '',
        topId: note.parentId || note.id,
        linkCount: 0,
      }
    })

  // ── 概念节点 ──
  const conceptNodes = []
  const conceptEdges = []

  for (const c of ai.concepts) {
    if (!noteMap.has(c.noteId)) continue
    const note = noteMap.get(c.noteId)
    const topId = note.parentId || note.id
    for (const item of c.items || []) {
      const conceptId = `concept:${c.noteId}:${encodeURIComponent(item.name)}`
      conceptNodes.push({
        id: conceptId,
        name: item.name,
        noteId: c.noteId,
        summary: item.summary || '',
        topId,
        isConcept: true,
        linkCount: 0,
      })
      conceptEdges.push({
        source: c.noteId,
        target: conceptId,
        type: 'has_concept',
        label: '核心概念',
        ai: true,
      })
    }
  }

  return {
    nodes: [...base.nodes, ...extraNodes],
    edges: base.edges,
    topFolders: base.topFolders,
    aiEdges: [...aiEdges, ...conceptEdges],
    conceptNodes,
    aiAnalyzed: true,
    analyzedAt: ai.analyzedAt,
  }
}

module.exports = {
  ensureDemoUser, register, login,
  migrateNotes, getNotes, getNoteTree, getNoteById, searchNotes, getBacklinks, getNoteGraph, getNoteGraphEnhanced,
  getAIAnalysis, saveAIAnalysis,
  addNote, updateNote, deleteNote, moveNote,
  getSubjects, addSubject, updateSubject, deleteSubject,
  getAllTasks, getTodayTasks, getWeekTasks, addTask, updateTask, deleteTask,
  toggleTaskDone, getTaskStats,
  getDeadlines, addDeadline, deleteDeadline,
  getCheckins, getTodayCheckin, doCheckin, cancelTodayCheckin, getCheckinStats,
}
