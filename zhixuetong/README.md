# 智学通 — AI 智能学习助手

> 面向大学生的全栈 AI 学习平台，融合知识图谱、智能问答、学习计划与打卡系统。

## 🚀 评委快速启动（3 步）

```bash
# 1. 安装依赖（前后端一次性安装）
npm install
cd server && npm install && cd ..

# 2. （可选）配置 AI 功能
#    如果不配置，AI 问答和知识图谱智能分析会提示"未配置"。
#    其他功能（笔记、任务、打卡、图谱可视化）无需配置即可使用。
#    cp server/.env.example server/.env
#    然后编辑 server/.env 填入你的大模型 API Key。

# 3. 一键启动
npm run dev
```

浏览器打开 **http://localhost:5173**，使用内置账号登录：

| 用户名 | 密码 |
|--------|------|
| `demo` | `demo123` |

## 🧠 功能模块

| 模块 | 功能 | 亮点 |
|------|------|------|
| **仪表盘** | 打卡系统、日历热力图、周趋势统计 | 手动/自动打卡、streak 连续天数 |
| **AI 智能问答** | 多轮对话、上下文持久化 | Markdown 渲染 + 代码高亮 + 数学公式 |
| **学习计划** | 任务管理、学科分组、倒计时 | 日/周/列表三视图、每日/每周/每月重复 |
| **知识图谱** | 力导向图可视化、拖拽缩放 | AI 自动提取概念 + 发现语义关联 |
| **学习笔记** | 树形笔记、Wiki `[[链接]]` | 反向链接、AI 概念标签、浏览历史 |

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3.5 + TypeScript + Vite 8 + Tailwind CSS 4 + Pinia 3 + Vue Router 4 |
| 图表 | ECharts 6（力导向图、日历热力图、柱状图、环形图） |
| 后端 | Node.js + Express 5 |
| 数据库 | SQLite（better-sqlite3 风格封装，sql.js WASM 引擎） |
| AI | OpenAI 兼容 API（支持 DeepSeek / OpenAI / 任何兼容服务） |
| 安全 | bcryptjs 密码哈希、参数化查询防注入、密钥零暴露 |

## 📁 项目结构

```
智学通/
├── src/                    # 前端源码
│   ├── views/              # 5 个页面视图
│   ├── components/         # AppLayout 布局
│   ├── stores/             # Pinia 状态管理（auth/chat/nav）
│   └── router/             # Vue Router 路由 + 导航守卫
├── server/                 # 后端源码
│   ├── index.js            # Express API 路由（30+ 端点）
│   ├── userStore.js        # 数据访问层（500+ 行纯 SQL）
│   ├── db.js               # SQLite 封装（自动 camelCase + 持久化）
│   ├── seed.js             # 种子数据脚本（20 篇笔记 + 88 条关联）
│   └── zhixuetong.db       # SQLite 数据库（含预置演示数据）
└── package.json
```

## 🎯 设计亮点

- **AI 增量分析**：只分析新增/修改笔记，重复分析秒级跳过，分批处理防超时
- **知识图谱自动构建**：树结构父子边 + Wiki 链接边 + AI 语义关联边，三层叠加
- **Snake→Camel 透明转换**：数据库 snake_case 列名，JS 层自动转 camelCase，前端零感知
- **SQL 安全**：全部参数化查询，零字符串拼接；动态 SET 子句防注入
- **ON CONFLICT UPSERT**：打卡和 AI 分析使用 SQLite 原生的幂等写入
- **级联删除**：学科 → 任务 → 完成记录三级联，笔记 → 递归子孙删除

## 📦 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9
- （可选）大模型 API Key，推荐 [DeepSeek](https://platform.deepseek.com) 或 OpenAI 兼容服务

## 📄 许可

本作品为参赛项目，仅供评审使用。
