// ══════════════════════════════════════════
//  seed.js — 预置 20 篇高质量学习笔记
//  前端工程化 + 计算机网络，含密集 Wiki 链接
//  用法: node seed.js
// ══════════════════════════════════════════

const { initDatabase, db } = require('./db')

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const USER = 'demo'

const NOTES = [
  // ═══════════ 前端工程化 ═══════════
  {
    id: 'FE_ROOT',
    title: '前端工程化概述',
    parent: '',
    content: `# 前端工程化概述

前端工程化是指将软件工程的方法论引入前端开发，通过**规范化、自动化、模块化**手段提升团队协作效率和代码质量。

## 核心领域

- [[id:FE_MODULE|模块化开发]]：将代码拆分为独立可复用的单元
- [[id:FE_PKG|包管理器]]：统一管理第三方依赖的版本与更新
- [[id:FE_BUILD|构建工具]]：自动化处理代码打包、压缩、转译
- [[id:FE_TRANSPILE|代码转译]]：让新语法/新特性在旧浏览器中运行
- [[id:FE_CSS|CSS 工程化]]：解决样式冲突、提高样式可维护性

## 质量保障

- [[id:FE_LINT|代码质量]]：ESLint + Prettier 统一代码风格
- [[id:FE_TEST|前端测试]]：单元测试、集成测试、端到端测试
- [[id:FE_CICD|CI/CD 流水线]]：提交即构建、自动部署

## 性能视角

- [[id:FE_PERF|性能优化]]：从构建到运行时的全链路优化
- [[id:NET_CDN|CDN 内容分发]]：静态资源加速的关键手段

前端工程化的目标是让开发者**专注于业务逻辑**，其余交给工具链。`,
  },

  {
    id: 'FE_MODULE',
    title: '模块化开发',
    parent: 'FE_ROOT',
    content: `# 模块化开发

## 为什么需要模块化

在没有模块化的时代，所有 JS 代码写在一个文件里，通过全局变量通信。随着应用规模增长，**命名冲突**和**依赖管理**成为噩梦。

## 模块化方案演进

### 1. IIFE（立即执行函数）
利用闭包创建私有作用域，是最原始的实现方式。

### 2. CommonJS
\`\`\`js
const lodash = require('lodash')
module.exports = { ... }
\`\`\`
Node.js 默认的模块规范，**同步加载**，适合服务端。

### 3. AMD / RequireJS
异步模块定义，适合浏览器端，但写法繁琐。

### 4. ES Modules（ESM）
\`\`\`js
import { ref } from 'vue'
export default Component
\`\`\`
现代标准，被 [[id:FE_BUILD|构建工具]] 广泛支持，支持 **Tree Shaking**（静态分析，移除未使用代码）。

## 与其它领域的关联

- [[id:FE_BUILD|构建工具]] 是模块化在工程中的落地载体
- 配合 [[id:FE_PKG|包管理器]] 管理模块版本
- 与 [[id:FE_PERF|性能优化]] 中的 Tree Shaking 和 Code Splitting 紧密相关`,
  },

  {
    id: 'FE_PKG',
    title: '包管理器',
    parent: 'FE_ROOT',
    content: `# 包管理器

## 三大主流工具

| 工具 | 特点 | lock 文件 |
|------|------|-----------|
| npm | Node 自带，生态最大 | package-lock.json |
| yarn | 并行安装，确定性依赖 | yarn.lock |
| pnpm | 硬链接共享，节省磁盘 | pnpm-lock.yaml |

## 核心概念

### semver（语义化版本）
\`1.2.3\` = 主版本.次版本.修订号
- \`^\` 锁定主版本（如 \`^1.2.3\` → \`>=1.2.3 <2.0.0\`）
- \`~\` 锁定次版本（如 \`~1.2.3\` → \`>=1.2.3 <1.3.0\`）

### 依赖分化
- **dependencies**：运行时依赖
- **devDependencies**：开发时依赖（如 [[id:FE_BUILD|构建工具]]、[[id:FE_LINT|ESLint]]）
- **peerDependencies**：宿主依赖（插件声明对宿主版本的要求）

## 现代趋势
pnpm 的 **硬链接 + 符号链接** 策略解决了 npm 的「幽灵依赖」问题——即能访问未声明依赖的模块。大型项目（如 Vue 3 仓库）已全面使用 pnpm。

- 配合 [[id:FE_BUILD|构建工具]] 使用（npm scripts）
- 与 [[id:FE_CICD|CI/CD 流水线]] 的依赖缓存策略相关`,
  },

  {
    id: 'FE_BUILD',
    title: '构建工具',
    parent: 'FE_ROOT',
    content: `# 构建工具

## 发展历程

### 第一代：Grunt / Gulp
基于**任务流**，将文件从一个目录处理到另一个目录。配置繁琐，性能瓶颈明显。

### 第二代：Webpack
基于**依赖图**的思路，从一个入口出发递归分析所有依赖，打包为 bundle。插件生态极其丰富。

\`\`\`js
// webpack.config.js
module.exports = {
  entry: './src/main.js',
  output: { path: './dist' },
  module: { rules: [{ test: /\\.vue$/, use: 'vue-loader' }] },
  plugins: [new HtmlWebpackPlugin()],
}
\`\`\`

### 第三代：Vite / Turbopack
基于 **ESM 原生支持**，开发时利用浏览器原生 ES Module 实现秒级启动，生产构建回退到 Rollup（Vite）或自研引擎（Turbopack）。

## 核心能力

- **代码转译**：调用 [[id:FE_TRANSPILE|Babel / TypeScript]] 处理新语法
- **CSS 处理**：集成 [[id:FE_CSS|PostCSS / Tailwind CSS]]
- **代码分割**：按路由/组件拆分 chunk，配合 [[id:FE_PERF|懒加载]]
- **HMR**（热模块替换）：修改代码不刷新页面

## 与其它领域的关联

构建工具是现代前端的**工程化中枢**，连接着：
- [[id:FE_MODULE|模块化开发]]
- [[id:FE_TRANSPILE|代码转译]]
- [[id:FE_CSS|CSS 工程化]]
- [[id:FE_PERF|性能优化]]`,
  },

  {
    id: 'FE_TRANSPILE',
    title: '代码转译',
    parent: 'FE_ROOT',
    content: `# 代码转译

## Babel

Babel 将 **ES6+ 语法** 转为 **ES5** 以兼容旧浏览器。

\`\`\`js
// 输入：ES6 箭头函数
const add = (a, b) => a + b

// Babel 输出：ES5
var add = function(a, b) { return a + b }
\`\`\`

### 工作原理
1. **Parse** → 源码解析为 AST（抽象语法树）
2. **Transform** → 遍历 AST，应用插件转换
3. **Generate** → 将 AST 生成为目标代码

### 常用 preset
- \`@babel/preset-env\`：按 browserslist 自动引入所需 polyfill
- \`@babel/preset-typescript\`：剥离 TS 类型标注

## TypeScript Compiler（tsc）

TypeScript 是 JavaScript 的**超集**，增加静态类型检查。\`tsc\` 负责类型检查 + 代码降级。

- 被 [[id:FE_BUILD|Vite / Webpack]] 集成调用
- 类型系统让 [[id:FE_TEST|前端测试]] 的压力大幅降低（编译期捕获错误）
- 配合 [[id:FE_LINT|ESLint]] 的类型感知规则`,
  },

  {
    id: 'FE_CSS',
    title: 'CSS 工程化',
    parent: 'FE_ROOT',
    content: `# CSS 工程化

## 传统 CSS 的痛点

- **全局污染**：所有选择器共享一个命名空间
- **选择器优先级战争**：\`!important\` 层层叠加
- **死代码无法检测**：不知道哪些样式已不再使用

## 解决方案

### CSS Modules
将类名编译为**局部哈希**，天然隔离。
\`\`\`css
/* 源码 */
.title { color: red }
/* 输出 */
.title_3x9f2 { color: red }
\`\`\`

### Tailwind CSS
原子化 CSS 框架，直接在 HTML 中用工具类组合样式。配合 [[id:FE_BUILD|Vite / PostCSS]] 的 JIT 引擎，只生成使用到的 CSS，生产包极小。

### PostCSS
CSS 后处理器，通过插件生态提供：
- **Autoprefixer**：自动添加浏览器前缀
- **cssnano**：压缩优化
- **Tailwind CSS**：作为 PostCSS 插件运行

## 实践建议

- 全局设计 Token 统一管理颜色/间距/字体
- 与 [[id:FE_LINT|Stylelint]] 配合控制样式规范
- 构建时通过 [[id:FE_PERF|PurgeCSS]] 移除无用样式`,
  },

  {
    id: 'FE_LINT',
    title: '代码质量',
    parent: 'FE_ROOT',
    content: `# 代码质量

## ESLint

静态代码分析工具，在**编码阶段**发现潜在问题。

\`\`\`js
// .eslintrc.js
module.exports = {
  extends: ['@vue/typescript/recommended'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
  },
}
\`\`\`

### 核心能力
- **语法错误检测**：括号不匹配、变量未定义
- **最佳实践建议**：避免 \`eval\`、禁用 \`var\`
- **类型感知**：配合 [[id:FE_TRANSPILE|TypeScript]] 做深度检查

## Prettier

**代码格式化**工具，接手 ESLint 的格式规则，让 ESLint 只关注逻辑质量。通过 \`.prettierrc\` 统一团队风格（缩进、引号、分号等）。

## Husky + lint-staged

在 Git commit 前自动运行检查：
\`\`\`bash
npx husky add .husky/pre-commit "npx lint-staged"
\`\`\`
\`lint-staged\` 只检查**暂存区**文件，速度快。

## 与 CI/CD 的集成

代码规范应纳入 [[id:FE_CICD|CI/CD 流水线]]，在 PR 阶段自动检查，不符合规范的代码**阻止合并**。
- 配合 [[id:FE_TEST|前端测试]] 形成完整质量门禁`,
  },

  {
    id: 'FE_TEST',
    title: '前端测试',
    parent: 'FE_ROOT',
    content: `# 前端测试

## 测试金字塔

| 层级 | 工具 | 速度 | 覆盖率 |
|------|------|------|--------|
| 单元测试 | Vitest / Jest | ⚡ 毫秒 | 最高 |
| 组件测试 | Vue Test Utils | 🔶 秒 | 中 |
| E2E 测试 | Cypress / Playwright | 🐢 分钟 | 最低但最关键 |

## Vitest

基于 Vite 的测试框架，原生支持 ESM 和 [[id:FE_TRANSPILE|TypeScript]]，零配置启动。

\`\`\`js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, { slots: { default: '提交' } })
    expect(wrapper.text()).toBe('提交')
  })
})
\`\`\`

## 与 CI/CD 的关系

测试应该在 [[id:FE_CICD|CI/CD 流水线]] 中**自动执行**。PR 提交后自动跑全部测试，失败则阻止合并。这是保障代码质量最后一道防线。
- 与 [[id:FE_LINT|ESLint]] 互补：Lint 关注风格，测试关注逻辑`,
  },

  {
    id: 'FE_CICD',
    title: 'CI/CD 流水线',
    parent: 'FE_ROOT',
    content: `# CI/CD 流水线

## CI（持续集成）

开发者频繁将代码合并到主干，每次合并触发自动构建和测试。

### GitHub Actions 示例

\`\`\`yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint        # ← [[id:FE_LINT|ESLint]]
      - run: pnpm test        # ← [[id:FE_TEST|Vitest]]
      - run: pnpm build       # ← [[id:FE_BUILD|Vite]]
\`\`\`

## CD（持续部署）

构建产物自动部署到服务器。常见策略：
- **蓝绿部署**：两套环境切换，秒级回滚
- **灰度发布**：逐步放量，监控异常

## 前端专属优化

- **依赖缓存**：\`pnpm-lock.yaml\` 不变则复用 node_modules
- **构建缓存**：利用 [[id:FE_BUILD|Vite]] 的增量构建能力
- **CDN 部署**：静态资源推送到 [[id:NET_CDN|CDN]]，HTML 部署到源站`,
  },

  {
    id: 'FE_PERF',
    title: '性能优化',
    parent: 'FE_ROOT',
    content: `# 性能优化

## 从构建到运行时的全链路

### 构建阶段

- **Tree Shaking**：[[id:FE_BUILD|Webpack / Rollup]] 静态分析 ESM，移除未使用导出
- **Code Splitting**：按路由懒加载，首屏只加载必需代码
- **压缩**：Terser 压缩 JS，cssnano 压缩 [[id:FE_CSS|CSS]]

### 网络阶段

- **HTTP 缓存**：利用 [[id:NET_HTTP|HTTP 协议]] 的强缓存/协商缓存
- **CDN 加速**：静态资源部署到 [[id:NET_CDN|CDN 边缘节点]]
- **HTTP/2 多路复用**：参考 [[id:NET_HTTP2|HTTP/2 与 HTTP/3]] 的 multiplexing
- **Gzip / Brotli** 压缩传输

### 运行时阶段

- **虚拟滚动**：只渲染可视区域
- **防抖/节流**：控制高频事件（滚动、输入）
- **Web Worker**：将计算密集任务移出主线程

## 性能指标（Core Web Vitals）
- **LCP**（最大内容绘制）< 2.5s
- **FID**（首次输入延迟）< 100ms
- **CLS**（累计布局偏移）< 0.1`,
  },

  // ═══════════ 计算机网络 ═══════════
  {
    id: 'NET_ROOT',
    title: '计算机网络概述',
    parent: '',
    content: `# 计算机网络概述

计算机网络是**计算机之间通过通信链路交换数据**的系统。对前端开发者来说，理解网络是理解**页面为什么慢**、**请求如何到达服务器**的基础。

## 分层体系

- [[id:NET_OSI|OSI 七层模型]]：理论参考模型
- [[id:NET_TCP|TCP 协议详解]]：传输层核心协议
- [[id:NET_HTTP|HTTP/HTTPS]]：应用层最常用的协议
- [[id:NET_DNS|DNS 域名解析]]：将域名转为 IP 地址

## 前端视角的网络

- 静态资源加速依赖 [[id:NET_CDN|CDN 内容分发]]
- 实时推送需求使用 [[id:NET_WS|WebSocket 实时通信]]
- 安全防护需要了解 [[id:NET_SEC|XSS / CSRF / CORS]]
- API 设计遵循 [[id:NET_REST|RESTful API 设计]]
- 协议升级关注 [[id:NET_HTTP2|HTTP/2 与 HTTP/3]]`,
  },

  {
    id: 'NET_OSI',
    title: 'OSI 七层模型',
    parent: 'NET_ROOT',
    content: `# OSI 七层模型

| 层 | 名称 | 功能 | 协议/设备 |
|----|------|------|-----------|
| 7 | 应用层 | 为用户提供网络服务 | [[id:NET_HTTP|HTTP]]、FTP、SMTP |
| 6 | 表示层 | 数据格式转换、加密 | SSL/TLS |
| 5 | 会话层 | 建立/管理/终止会话 | NetBIOS |
| 4 | 传输层 | 端到端可靠传输 | [[id:NET_TCP|TCP]]、UDP |
| 3 | 网络层 | 路由选择、逻辑寻址 | IP、路由器 |
| 2 | 数据链路层 | 帧同步、差错控制 | MAC、交换机 |
| 1 | 物理层 | 比特流传输 | 网线、光纤 |

## 实际简化：TCP/IP 四层模型

互联网实际使用的是更简洁的 TCP/IP 模型：
- **应用层**（OSI 5-7 层合并）
- **传输层**（OSI 4 层）
- **网络层**（OSI 3 层）
- **网络接口层**（OSI 1-2 层合并）

理解分层思想很重要：**每层只关心自己的职责**，上层不需要知道下层的实现细节。

- 传输层的 [[id:NET_TCP|TCP 协议]] 保证数据可靠到达
- 应用层的 [[id:NET_HTTP|HTTP]] 基于 TCP 传输`,
  },

  {
    id: 'NET_TCP',
    title: 'TCP 协议详解',
    parent: 'NET_ROOT',
    content: `# TCP 协议详解

TCP（传输控制协议）是**面向连接、可靠、基于字节流**的传输层协议。

## 三次握手（建立连接）

\`\`\`
客户端                   服务器
  |-------- SYN -------->|
  |<---- SYN + ACK ------|
  |-------- ACK -------->|
  连接建立
\`\`\`

1. 客户端发送 SYN（同步序列号）
2. 服务器回复 SYN + ACK（确认 + 自己的序列号）
3. 客户端发送 ACK（确认）

## 四次挥手（断开连接）

\`\`\`
客户端                   服务器
  |-------- FIN -------->|
  |<------- ACK ---------|
  |<------- FIN ---------|
  |-------- ACK -------->|
  连接关闭
\`\`\`

多出一次是因为 TCP 是**全双工**——双方都可以独立关闭发送方向。

## 可靠传输机制

- **序列号 + 确认应答**：每个字节有编号，接收方确认
- **超时重传**：超时未确认则重发
- **流量控制**：滑动窗口，接收方告知缓冲区大小
- **拥塞控制**：慢启动、拥塞避免、快重传

## 前端视角

- [[id:NET_HTTP|HTTP/1.1]] 基于 TCP，每个请求可能经历握手开销
- [[id:NET_HTTP2|HTTP/2]] 复用 TCP 连接（多路复用）
- [[id:NET_HTTP2|HTTP/3]] 抛弃 TCP，使用 QUIC（基于 UDP）`,
  },

  {
    id: 'NET_HTTP',
    title: 'HTTP/HTTPS',
    parent: 'NET_ROOT',
    content: `# HTTP/HTTPS

## HTTP 请求结构

\`\`\`
POST /api/login HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer eyJhb...

{"username":"demo","password":"123456"}
\`\`\`

### 常用方法
| 方法 | 语义 | 幂等 |
|------|------|------|
| GET | 获取资源 | ✅ |
| POST | 创建资源 | ❌ |
| PUT | 全量更新 | ✅ |
| PATCH | 部分更新 | ❌ |
| DELETE | 删除 | ✅ |

## 状态码
- **2xx**：成功（200 OK / 201 Created / 204 No Content）
- **3xx**：重定向（301 永久 / 302 临时 / 304 未修改）
- **4xx**：客户端错误（400 Bad Request / 401 未认证 / 403 禁止 / 404 未找到）
- **5xx**：服务端错误（500 内部错误 / 502 网关错误 / 503 服务不可用）

## HTTPS = HTTP + TLS

TLS 提供：
- **加密**：数据在传输中不可读
- **认证**：证书确保服务器身份
- **完整性**：数据不被篡改

## 前端相关

- [[id:NET_REST|RESTful API 设计]] 基于 HTTP 方法
- [[id:NET_SEC|CORS]] 是浏览器的 HTTP 安全策略
- [[id:FE_PERF|HTTP 缓存]] 是性能优化的重要手段
- 基于 [[id:NET_TCP|TCP]] 传输，协议升级参考 [[id:NET_HTTP2|HTTP/2]]`,
  },

  {
    id: 'NET_DNS',
    title: 'DNS 域名解析',
    parent: 'NET_ROOT',
    content: `# DNS 域名解析

DNS（域名系统）将人类可读的域名（\`github.com\`）转换为机器可读的 IP 地址（\`140.82.113.3\`）。

## 解析过程

\`\`\`
浏览器输入 github.com
  → 浏览器 DNS 缓存
  → OS hosts 文件
  → 本地 DNS 解析器
  → 根域名服务器（.）
  → 顶级域名服务器（.com）
  → 权威 DNS 服务器（github.com）
  → 返回 IP 地址
\`\`\`

## 记录类型

| 类型 | 用途 | 示例 |
|------|------|------|
| A | 域名 → IPv4 | \`example.com → 93.184.216.34\` |
| AAAA | 域名 → IPv6 | \`example.com → 2606:2800:220:1::\` |
| CNAME | 域名别名 | \`www → example.com\` |
| MX | 邮件服务器 | 邮件路由 |
| TXT | 文本记录 | SPF、域名验证 |

## DNS 与性能

- **DNS 查询是页面加载的第一跳**，慢则拖慢整体 TTFB
- [[id:NET_CDN|CDN]] 利用 DNS 智能解析，将用户引导到最近边缘节点
- 使用 \`dns-prefetch\` 预先解析第三方域名

\`\`\`html
<link rel="dns-prefetch" href="//api.example.com">
\`\`\`

- DNS 是 [[id:NET_HTTP|HTTP]] 请求的前置步骤`,
  },

  {
    id: 'NET_CDN',
    title: 'CDN 内容分发',
    parent: 'NET_ROOT',
    content: `# CDN 内容分发网络

CDN 通过**地理上分散的边缘服务器**将内容缓存到离用户最近的位置，减少延迟。

## 工作原理

\`\`\`
用户（东京）请求 static.example.com
  → [[id:NET_DNS|DNS 智能解析]]：返回东京边缘节点 IP
  → 边缘节点有缓存 → 直接返回
  → 边缘节点无缓存 → 回源到源站 → 缓存 → 返回
\`\`\`

## 前端静态资源 CDN 策略

### 文件名哈希
\`\`\`js
// [[id:FE_BUILD|Vite]] 构建产物
dist/assets/index-a3f8b2.js  // ← 内容变化则哈希变化
\`\`\`
配合**强缓存**（Cache-Control: max-age=31536000），因为同 URL 必定同内容。

### HTML 不缓存
\`\`\`
Cache-Control: no-cache  // 每次都验证
\`\`\`
HTML 作为入口文件，需要及时更新。

## CDN 与其它技术的联动

- **回源优化**：利用 [[id:NET_HTTP2|HTTP/2]] 的多路复用减少连接数
- **HTTPS**：CDN 边缘节点部署 SSL 证书
- **安全**：CDN 可缓解 DDoS，配合 [[id:NET_SEC|WAF 防护]]
- 与 [[id:FE_PERF|性能优化]] 的静态资源加速策略密切相关`,
  },

  {
    id: 'NET_WS',
    title: 'WebSocket 实时通信',
    parent: 'NET_ROOT',
    content: `# WebSocket 实时通信

WebSocket 在**单个 TCP 连接**上提供**全双工**通信通道。

## 与 HTTP 的区别

| | HTTP | WebSocket |
|------|------|-----------|
| 通信模式 | 请求-响应 | 全双工推送 |
| 头部开销 | 每次几百字节 | 2-14 字节 |
| 连接 | 短连接/长连接 | 持久连接 |
| 适用场景 | REST API | 即时通讯、协作编辑 |

## 握手过程

WebSocket 通过 [[id:NET_HTTP|HTTP]] 101 状态码升级协议：

\`\`\`
客户端: GET /chat HTTP/1.1
        Upgrade: websocket
        Connection: Upgrade

服务器: HTTP/1.1 101 Switching Protocols
        Upgrade: websocket
        Connection: Upgrade
\`\`\`

## 前端 API

\`\`\`js
const ws = new WebSocket('wss://example.com/chat')
ws.onopen = () => ws.send(JSON.stringify({ type: 'join' }))
ws.onmessage = (e) => console.log(JSON.parse(e.data))
ws.onclose = () => console.log('连接关闭')
\`\`\`

## 替代方案

- **SSE**（Server-Sent Events）：单向推送，基于 HTTP，自动重连
- **HTTP/2 Server Push**：参考 [[id:NET_HTTP2|HTTP/2 协议]]
- **WebTransport**：基于 [[id:NET_HTTP2|HTTP/3]] 的下一代方案

- 底层依赖 [[id:NET_TCP|TCP]] 提供可靠传输`,
  },

  {
    id: 'NET_SEC',
    title: '网络安全基础',
    parent: 'NET_ROOT',
    content: `# 网络安全基础

## CORS（跨域资源共享）

浏览器的**同源策略**禁止页面请求不同源的资源。CORS 通过服务器响应头允许合法跨域：

\`\`\`
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Content-Type, Authorization
\`\`\`

处理 CORS 是 [[id:NET_REST|RESTful API]] 开发的基本功。

## XSS（跨站脚本攻击）

攻击者将恶意脚本注入页面，窃取 Cookie 或劫持操作。

### 防御
- **输出转义**：永远不要直接 \`innerHTML\` 用户输入
- **CSP**（内容安全策略）：\`Content-Security-Policy\` 头限制脚本来源
- **HttpOnly Cookie**：禁止 JS 访问敏感 Cookie

## CSRF（跨站请求伪造）

诱导用户点击链接，利用已登录状态发起恶意请求。

### 防御
- **SameSite Cookie**：\`Set-Cookie: ...; SameSite=Strict\`
- **CSRF Token**：表单中嵌入随机 Token，服务端校验
- **Referer/Origin 校验**：检查请求来源

## 前端安全实践

- 所有 API 走 [[id:NET_HTTP|HTTPS]]，不传输明文
- Token 不存 localStorage（易 XSS），用 HttpOnly Cookie
- 第三方依赖定期审计（\`npm audit\`）
- [[id:FE_CICD|CI/CD]] 中集成安全检查`,
  },

  {
    id: 'NET_HTTP2',
    title: 'HTTP/2 与 HTTP/3',
    parent: 'NET_ROOT',
    content: `# HTTP/2 与 HTTP/3

## HTTP/1.1 的痛点

- **队头阻塞**：同一连接上请求必须串行处理
- **头部冗余**：每次请求携带大量重复头部
- **连接限制**：浏览器同域最多 6 个并发连接

## HTTP/2 的改进

### 多路复用
在**单个 [[id:NET_TCP|TCP]] 连接**上并行传输多个请求/响应，互不阻塞。

### 头部压缩（HPACK）
静态表 + 动态表，只传输变化部分，大幅减少头部体积。

### 服务器推送（Server Push）
服务器可主动推送客户端还未请求的资源。

\`\`\`
客户端请求 index.html
服务器主动推送 app.js、style.css
\`\`\`

## HTTP/3：基于 QUIC

HTTP/3 **不再使用 TCP**，而是基于 **QUIC**（Quick UDP Internet Connections）。

### QUIC 的优势
- **0-RTT 握手**：已连接过的服务器可零延迟恢复
- **无队头阻塞**：丢包只影响单个流，不影响其它流
- **连接迁移**：切换网络（WiFi→移动网络）连接不中断

## 前端受益

- 不再需要域名分片、雪碧图等 hack
- [[id:NET_CDN|CDN]] 回源效率大幅提升
- [[id:FE_PERF|性能优化]] 中静态资源加载更快`,
  },

  {
    id: 'NET_REST',
    title: 'RESTful API 设计',
    parent: 'NET_ROOT',
    content: `# RESTful API 设计

REST（表述性状态转移）是基于 [[id:NET_HTTP|HTTP 协议]] 的 API 设计风格。

## 核心原则

### 1. 资源导向
URL 表示资源，而非动作：
\`\`\`
✅ GET    /api/users/123
❌ GET    /api/getUser?id=123
\`\`\`

### 2. HTTP 方法表达操作
\`\`\`
GET    /api/notes        # 获取列表
POST   /api/notes        # 创建
GET    /api/notes/abc    # 获取详情
PUT    /api/notes/abc    # 全量更新
DELETE /api/notes/abc    # 删除
\`\`\`

### 3. 状态码语义化
| 操作 | 成功状态码 |
|------|-----------|
| GET 列表/详情 | 200 OK |
| POST 创建 | 201 Created |
| PUT 更新 | 200 OK |
| DELETE 删除 | 204 No Content |

### 4. 版本管理
\`\`\`
/api/v1/notes    # URL 版本
Accept: version=1  # Header 版本
\`\`\`

## 进阶实践

- **分页**：\`?page=2&limit=20\`，返回 total 总数
- **筛选**：\`?status=active&sort=-createdAt\`
- **错误格式**：统一 \`{ error: "...", detail: "..." }\`
- **CORS**：正确配置 [[id:NET_SEC|跨域策略]]
- **HTTPS**：全站加密，参考 [[id:NET_HTTP|HTTP/HTTPS]]`,
  },
]

// ══════════════════════════════════════════
//  主流程
// ══════════════════════════════════════════

async function seed() {
  await initDatabase()

  console.log('🌱 开始预置种子数据...\n')

  // 清空 demo 用户旧数据（保留用户账号）
  const tables = ['notes', 'tasks', 'task_done', 'subjects', 'deadlines', 'checkins', 'ai_graph']
  for (const t of tables) {
    db.prepare(`DELETE FROM ${t} WHERE username = ?`).run(USER)
  }
  // 重置迁移标记
  db.prepare('DELETE FROM meta WHERE key IN (?, ?)').run('db_migrated', 'notes_migrated')
  console.log('🧹 已清空旧数据')

  // 第一步：生成所有 ID
  const idMap = new Map()
  for (const n of NOTES) {
    idMap.set(n.id, genId())
  }

  // 第二步：插入所有笔记（替换占位符为真实 ID）
  console.log('\n📝 插入笔记...')
  for (const n of NOTES) {
    const realId = idMap.get(n.id)
    let parentId = ''
    if (n.parent) {
      parentId = idMap.get(n.parent) || ''
    }

    // 将内容中的 {id:xxx} 占位符替换为真实 ID
    let content = n.content
    for (const [placeholderId, realId_] of idMap) {
      content = content.replaceAll(`{id:${placeholderId}}`, realId_)
    }

    db.prepare('INSERT INTO notes (id, username, title, content, parent_id, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(realId, USER, n.title, content, parentId, 0, new Date().toISOString(), new Date().toISOString())

    const type = n.parent === '' ? '📁' : '📄'
    const indent = n.parent !== '' ? '    ' : ''
    console.log(`  ${indent}${type} ${n.title}`)
  }

  // 第三步：创建两个学科
  console.log('\n📚 创建学科...')
  const feSubjId = genId()
  const netSubjId = genId()
  db.prepare('INSERT INTO subjects (id, username, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(feSubjId, USER, '前端工程化', '#6366f1', 0, new Date().toISOString())
  console.log('  📘 前端工程化 (#6366f1)')
  db.prepare('INSERT INTO subjects (id, username, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(netSubjId, USER, '计算机网络', '#10b981', 1, new Date().toISOString())
  console.log('  📗 计算机网络 (#10b981)')

  // 第四步：创建示例任务
  console.log('\n📋 创建示例任务...')
  db.prepare('INSERT INTO tasks (id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(genId(), USER, feSubjId, '复习前端工程化笔记', '重点：构建工具和性能优化章节', 'daily', '[]', '09:00', '10:00', null, new Date().toISOString())
  console.log('  ☐ 复习前端工程化笔记（每天 09:00-10:00）')

  db.prepare('INSERT INTO tasks (id, username, subject_id, title, note, repeat_type, repeat_days, start_time, end_time, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(genId(), USER, netSubjId, '学习计算机网络', '本周重点：TCP 三次握手和 HTTP/2 多路复用', 'weekly', '[1,3,5]', '14:00', '15:30', null, new Date().toISOString())
  console.log('  ☐ 学习计算机网络（周一三五 14:00-15:30）')

  // 第五步：创建倒计时
  console.log('\n⏰ 创建倒计时...')
  const examDate = new Date()
  examDate.setDate(examDate.getDate() + 30)
  const examDateStr = examDate.toISOString().slice(0, 10)
  db.prepare('INSERT INTO deadlines (id, username, title, date, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(genId(), USER, '前端技术面试', examDateStr, new Date().toISOString())
  console.log(`  🎯 前端技术面试 — ${examDateStr}（距今约30天）`)

  // 第六步：统计
  const noteCount = db.prepare('SELECT COUNT(*) as cnt FROM notes WHERE username = ?').get(USER)
  const linkCount = NOTES.reduce((sum, n) => sum + (n.content.match(/\[\[id:/g) || []).length, 0)
  const crossLinks = NOTES.reduce((sum, n) => {
    const isFE = n.id.startsWith('FE_')
    const links = n.content.match(/\[\[id:NET_/g)
    return sum + (links?.length || 0)
  }, 0)

  console.log('\n' + '═'.repeat(52))
  console.log('  ✅ 种子数据预置完成！')
  console.log(`  📄 笔记: ${noteCount.cnt} 篇`)
  console.log(`  🔗 Wiki 链接: ${linkCount} 条（含 ${crossLinks} 条跨学科引用）`)
  console.log('═'.repeat(52))
  console.log('\n💡 启动前端 → 进入「知识图谱」→ 点击「AI 智能分析」即可看到交错连线效果！')

  db.close()
}

seed().catch((err) => {
  console.error('❌ 种子数据失败:', err)
  process.exit(1)
})
