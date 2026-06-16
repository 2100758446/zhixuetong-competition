# 🎓 智学通 (ZhiXueTong) - AI校园学习助手

> **湖南省大学生程序设计竞赛 · 应用开发赛道 参赛作品**
>
> 一个集 **AI智能问答**、**学习计划生成**、**知识图谱可视化**、**笔记管理**于一体的综合性学习平台。

---

## ✨ 核心功能

| 功能模块 | 说明 | 技术亮点 |
|----------|------|----------|
| 🤖 **AI智能问答** | 基于大语言模型的学习助手，支持Markdown、代码高亮 | DeepSeek API / 离线智能回复 |
| 📋 **学习计划生成器** | AI根据目标自动生成详细学习计划 | 智能Prompt工程 |
| 🧠 **知识图谱** | 交互式知识关系图，支持拖拽缩放 | ECharts力导向图 |
| 📝 **学习笔记** | 在线笔记 + AI自动总结提炼 | Markdown编辑器 |
| 📊 **学习仪表盘** | 学习数据可视化，进度追踪 | Chart.js图表 |
| 👤 **用户系统** | 注册登录、个人数据隔离 | Flask Session |

---

## 🚀 快速开始

### 1. 环境要求
- Python 3.9+
- pip

### 2. 安装依赖
```bash
cd zhixuetong
pip install -r requirements.txt
```

### 3. 配置AI API（可选）
编辑 `config.py`，填入你的 API Key：
```python
AI_CONFIG = {
    'api_key': 'your-deepseek-api-key',  # 填入你的Key
    # ...
}
```

> 💡 **不配置API Key也能使用！** 系统内置了智能回复系统，所有功能在离线模式下正常运行。

> 🔑 免费API Key获取：访问 https://platform.deepseek.com/ 注册即送免费额度。

### 4. 启动应用
```bash
python app.py
```

### 5. 打开浏览器
访问 **http://localhost:5000**

演示账号: `demo` / `demo123`

---

## 📁 项目结构

```
zhixuetong/
├── app.py                    # Flask主应用（路由、数据库模型、API）
├── config.py                 # 配置文件（API密钥、知识图谱数据）
├── ai_service.py             # AI服务模块（多平台API + 离线模式）
├── requirements.txt          # Python依赖
├── data/                     # SQLite数据库文件
├── static/
│   ├── css/style.css         # 主样式表（现代化UI设计）
│   ├── js/main.js            # 全局JavaScript功能
│   ├── js/chat.js            # AI聊天交互逻辑
│   └── js/knowledge.js       # 知识图谱可视化
├── templates/
│   ├── base.html             # 基础布局（侧边栏、导航栏）
│   ├── login.html            # 登录页面
│   ├── register.html         # 注册页面
│   ├── dashboard.html        # 学习仪表盘
│   ├── chat.html             # AI智能问答
│   ├── planner.html          # 学习计划生成器
│   ├── knowledge.html        # 知识图谱
│   ├── notes.html            # 学习笔记
│   ├── 404.html / 500.html   # 错误页面
├── README.md                 # 项目说明
├── 使用说明书.md              # 详细使用手册
├── setup.bat                 # Windows一键安装脚本
└── run.bat                   # Windows一键启动脚本
```

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端框架** | Flask 3.x | Python Web框架 |
| **数据库** | SQLite + SQLAlchemy | 轻量级关系数据库 |
| **前端UI** | Bootstrap 5 | 响应式CSS框架 |
| **图表** | Chart.js + ECharts | 统计图表 + 知识图谱 |
| **AI** | DeepSeek / 智谱 / 通义千问 | 大语言模型API |
| **Markdown** | marked.js | Markdown渲染 |

---

## 🏆 项目亮点

1. **AI深度融合**：不仅在对话中使用AI，学习计划、笔记总结也由AI驱动
2. **离线可用**：即使没有API Key，内置智能回复系统保证所有功能正常运行
3. **知识图谱可视化**：ECharts力导向图直观展示知识体系，支持交互探索
4. **完整的产品设计**：从用户注册到数据管理，是一个真正可用的产品
5. **跨平台API支持**：兼容DeepSeek、智谱AI、通义千问等多个大模型平台

---

## 📄 许可证

本项目为湖南省大学生程序设计竞赛参赛作品，仅供学习交流使用。
