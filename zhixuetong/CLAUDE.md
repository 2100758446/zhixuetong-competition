\# 智学通 项目约定

\- 技术栈：Vue 3.5 + TS + Vite 8 + Tailwind CSS 4 + Pinia 3 + Vue Router 4

\- 后端：server/ 目录，Express 5 (CommonJS)，AI 走 /api/chat

\- 新页面一律放在 AppLayout 内，复用现有侧边栏布局

\- 所有 Markdown 渲染复用现有的 markdown-it 配置（含代码高亮和 MathJax）

\- 所有 AI 调用都走后端 /api/chat，前端绝不直连大模型、绝不暴露密钥

\- 配色和组件风格沿用现有 LoginView / DashboardView 的 Tailwind 风格

\- 每完成一个功能就提交一次 git

