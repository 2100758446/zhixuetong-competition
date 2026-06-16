// ══════════════════════════════════════════
//  SQLite 数据库层（sql.js 封装）
//  风格对齐 better-sqlite3，同步 API
// ══════════════════════════════════════════

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, 'zhixuetong.db')

let sqlDb = null // sql.js Database 实例

// ── 持久化到磁盘 ──
function save() {
  if (!sqlDb) return
  const data = sqlDb.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

// ── snake_case → camelCase（自动转换列名） ──
function toCamel(row) {
  if (!row) return row
  const out = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = row[key]
  }
  return out
}

function toCamelAll(rows) {
  return rows.map(toCamel)
}

// ── Prepared Statement 封装 ──
class Statement {
  constructor(db, sql) {
    this._db = db
    this._sql = sql
  }

  // 查询单行 → 返回对象或 undefined
  get(...params) {
    const stmt = this._db.prepare(this._sql)
    if (params.length > 0) stmt.bind(params)
    let row
    if (stmt.step()) {
      row = stmt.getAsObject()
    }
    stmt.free()
    return toCamel(row)
  }

  // 查询多行 → 返回对象数组
  all(...params) {
    const stmt = this._db.prepare(this._sql)
    if (params.length > 0) stmt.bind(params)
    const rows = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return toCamelAll(rows)
  }

  // 执行写操作 → 返回 { changes: number }
  run(...params) {
    const stmt = this._db.prepare(this._sql)
    if (params.length > 0) stmt.bind(params)
    stmt.step()
    const changes = this._db.getRowsModified()
    stmt.free()
    save() // 每次写操作自动持久化
    return { changes }
  }
}

// ── DB 实例（对标 better-sqlite3） ──
const db = {
  prepare(sql) {
    return new Statement(sqlDb, sql)
  },

  exec(sql) {
    const results = sqlDb.exec(sql)
    save()
    return results
  },

  // 获取底层 sql.js 实例（特殊场景备用）
  raw() {
    return sqlDb
  },

  close() {
    if (sqlDb) {
      save()
      sqlDb.close()
      sqlDb = null
    }
  },
}

// ── 建表 SQL（全部表，一次性创建） ──
const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  username   TEXT PRIMARY KEY,
  password   TEXT NOT NULL,
  email      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL REFERENCES users(username),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  parent_id  TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_username ON notes(username);
CREATE INDEX IF NOT EXISTS idx_notes_parent_id ON notes(parent_id);

CREATE TABLE IF NOT EXISTS subjects (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL REFERENCES users(username),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subjects_username ON subjects(username);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL REFERENCES users(username),
  subject_id  TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  repeat_type TEXT NOT NULL DEFAULT 'none',
  repeat_days TEXT NOT NULL DEFAULT '[]',
  start_time  TEXT NOT NULL DEFAULT '',
  end_time    TEXT NOT NULL DEFAULT '',
  due_date    TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_username ON tasks(username);
CREATE INDEX IF NOT EXISTS idx_tasks_subject_id ON tasks(subject_id);

CREATE TABLE IF NOT EXISTS task_done (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  username TEXT NOT NULL REFERENCES users(username),
  date     TEXT NOT NULL,
  UNIQUE(task_id, username, date)
);
CREATE INDEX IF NOT EXISTS idx_task_done_lookup ON task_done(username, date);

CREATE TABLE IF NOT EXISTS deadlines (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL REFERENCES users(username),
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deadlines_username ON deadlines(username);

CREATE TABLE IF NOT EXISTS checkins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL REFERENCES users(username),
  date       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'manual',
  note       TEXT NOT NULL DEFAULT '',
  task_done  INTEGER NOT NULL DEFAULT 0,
  task_total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(username, date)
);
CREATE INDEX IF NOT EXISTS idx_checkins_username ON checkins(username);

CREATE TABLE IF NOT EXISTS ai_graph (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE REFERENCES users(username),
  concepts    TEXT NOT NULL DEFAULT '[]',
  links       TEXT NOT NULL DEFAULT '[]',
  analyzed_at TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

// ── 从 JSON 文件迁移数据到 SQLite（首次启动时自动执行） ──
function migrateFromJSON() {
  const already = db.prepare("SELECT value FROM meta WHERE key = ?").get('db_migrated')
  if (already) return

  console.log('🔄 检测到首次使用 SQLite，正在从 JSON 文件迁移数据...')

  const jsonFiles = {
    users: 'users.json',
    notes: 'notes.json',
    subjects: 'subjects.json',
    tasks: 'tasks.json',
    taskDone: 'taskDone.json',
    deadlines: 'deadlines.json',
    checkins: 'checkins.json',
  }

  for (const [table, filename] of Object.entries(jsonFiles)) {
    const filepath = path.join(__dirname, filename)
    if (!fs.existsSync(filepath)) continue

    try {
      const records = JSON.parse(fs.readFileSync(filepath, 'utf-8'))
      if (!Array.isArray(records) || records.length === 0) continue

      let count = 0
      for (const rec of records) {
        try {
          if (table === 'users') {
            db.prepare('INSERT OR IGNORE INTO users (username, password, email, created_at) VALUES (?, ?, ?, ?)')
              .run(rec.username, rec.password, rec.email || '', rec.createdAt || new Date().toISOString())
          } else if (table === 'notes') {
            db.prepare('INSERT OR IGNORE INTO notes (id, username, title, content, parent_id, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(rec.id, rec.username, rec.title, rec.content || '', rec.parentId || '', rec.sort || 0, rec.createdAt || new Date().toISOString(), rec.updatedAt || new Date().toISOString())
          } else if (table === 'subjects') {
            db.prepare('INSERT OR IGNORE INTO subjects (id, username, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
              .run(rec.id, rec.username, rec.name, rec.color, rec.order ?? 0, rec.createdAt || new Date().toISOString())
          } else if (table === 'tasks') {
            db.prepare('INSERT OR IGNORE INTO tasks (id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(rec.id, rec.username, rec.subjectId || '', rec.title, rec.note || '', rec.repeatType || 'none', JSON.stringify(rec.repeatDays || []), rec.startTime || '', rec.endTime || '', rec.dueDate || null, rec.createdAt || new Date().toISOString())
          } else if (table === 'taskDone') {
            db.prepare('INSERT OR IGNORE INTO task_done (task_id, username, date) VALUES (?, ?, ?)')
              .run(rec.taskId, rec.username, rec.date)
          } else if (table === 'deadlines') {
            db.prepare('INSERT OR IGNORE INTO deadlines (id, username, title, date, created_at) VALUES (?, ?, ?, ?, ?)')
              .run(rec.id, rec.username, rec.title, rec.date, rec.createdAt || new Date().toISOString())
          } else if (table === 'checkins') {
            db.prepare('INSERT OR IGNORE INTO checkins (username, date, type, note, task_done, task_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(rec.username, rec.date, rec.type || 'manual', rec.note || '', rec.taskDone || 0, rec.taskTotal || 0, rec.createdAt || new Date().toISOString())
          }
          count++
        } catch (e) {
          // 跳过损坏的单条记录
        }
      }
      console.log(`  ✅ ${table}: ${count} 条记录已迁移`)
    } catch (e) {
      // 文件无法解析，跳过
    }
  }

  // 标记迁移完成
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('db_migrated', '1')
  console.log('✅ JSON → SQLite 数据迁移完成')
}

// ── 初始化（异步，返回 Promise） ──
async function initDatabase() {
  const SQL = await initSqlJs()

  // 加载已有数据库文件（如果存在）
  let data = null
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH)
  }

  sqlDb = new SQL.Database(data)

  // 建表
  db.exec(SCHEMA)

  // 首次启动：从 JSON 迁移旧数据
  migrateFromJSON()

  console.log('✅ SQLite 数据库已就绪:', DB_PATH)
  return db
}

module.exports = { initDatabase, db }
