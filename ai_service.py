"""
智学通 - AI服务模块
==================
支持 DeepSeek / 智谱AI / 通义千问 等大模型API
当API不可用时自动切换到模拟模式，确保演示正常进行
"""

import os
import requests
import json
import re
from config import AI_CONFIG as DEFAULT_AI_CONFIG, KNOWLEDGE_GRAPH

# 读取网页端设置的API配置
def _load_web_settings():
    """从 settings.json 读取API配置"""
    settings_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'settings.json')
    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _get_active_config():
    """获取生效的API配置（网页设置优先）"""
    web = _load_web_settings()
    api_key = web.get('api_key', '').strip()
    if api_key:
        return {
            'provider': web.get('api_provider', 'deepseek'),
            'api_key': api_key,
            'api_url': web.get('api_url', 'https://api.deepseek.com/v1/chat/completions'),
            'model': web.get('api_model', 'deepseek-chat'),
            'temperature': 0.7,
            'max_tokens': 2000,
            'timeout': 30,
        }
    return DEFAULT_AI_CONFIG


def chat_with_ai(user_message, conversation_history=None, system_prompt=None):
    """
    与AI对话的核心函数

    参数:
        user_message: 用户输入的消息
        conversation_history: 对话历史列表 [{'role': 'user/assistant', 'content': '...'}]
        system_prompt: 系统提示词（可选）

    返回:
        AI回复的文本内容
    """
    if conversation_history is None:
        conversation_history = []

    # 构建消息列表
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.extend(conversation_history)
    messages.append({'role': 'user', 'content': user_message})

    # 如果配置了API密钥，尝试调用真实API
    active_config = _get_active_config()
    api_key = active_config.get('api_key', '').strip() if active_config else ''
    if api_key and active_config.get('provider') != 'mock':
        result = _call_real_api(messages, active_config)
    else:
        result = None

    # API调用失败或未配置，使用模拟模式
    if result is None:
        result = _mock_response(messages)

    return result


def generate_study_plan(subject, goal, available_time, difficulty='中等'):
    """
    根据用户输入生成学习计划

    参数:
        subject: 学科名称
        goal: 学习目标
        available_time: 可用时间（如"每天2小时，共4周"）
        difficulty: 难度等级

    返回:
        结构化的学习计划文本
    """
    prompt = f"""你是一位专业的学习规划师。请根据以下信息生成一份详细的学习计划：

学科：{subject}
学习目标：{goal}
可用时间：{available_time}
当前水平：{difficulty}等

请按照以下格式输出学习计划：

## 📋 学习总览
（简要总结学习目标和周期）

## 🎯 阶段性目标
分为3-5个阶段，每个阶段有明确的目标

## 📅 每周学习计划
| 周次 | 学习内容 | 重点任务 | 预计时长 |
（详细的周计划表格）

## 📖 推荐学习资源
（推荐书籍、视频、网站等）

## 💡 学习建议
（针对该学科的学习方法和技巧）

请确保计划具体、可执行、贴合实际。"""

    return chat_with_ai(prompt, system_prompt='你是一位专业的学习规划师，请用中文回答，格式清晰。')


def summarize_notes(content):
    """
    AI总结笔记内容

    参数:
        content: 笔记原文内容

    返回:
        AI生成的摘要
    """
    prompt = f"""请为以下学习笔记生成一个简洁的摘要，并提取3-5个关键知识点：

笔记内容：
{content}

请按以下格式输出：
## 📝 摘要
（100字以内的摘要）

## 🔑 关键知识点
1. ...
2. ...
3. ...

## 🏷️ 建议标签
标签1, 标签2, 标签3"""

    return chat_with_ai(prompt, system_prompt='你是一位学习助手，善于总结和提炼知识点。')


def get_knowledge_suggestion(prompt_text):
    """
    获取知识图谱相关的AI建议
    用于扩展/补充预设的知识图谱
    """
    system_prompt = '''你是一位计算机科学教育专家。请根据用户的问题，输出JSON格式的知识图谱节点数据。

格式要求：
{
  "nodes": [
    {"name": "知识点名称", "category": "分类名称", "value": 重要程度(1-10), "description": "简短描述"}
  ],
  "edges": [
    {"source": "源知识点", "target": "目标知识点", "label": "关系描述"}
  ]
}

请确保输出严格的JSON格式，不要包含其他文字。'''

    return chat_with_ai(prompt_text, system_prompt=system_prompt)


def _call_real_api(messages, api_config=None):
    """
    调用真实的大模型API
    支持 DeepSeek、智谱AI、通义千问 等
    """
    if api_config is None:
        api_config = _get_active_config()

    provider = api_config.get('provider', 'deepseek')
    api_key = api_config.get('api_key', '')

    # 各API的请求配置
    api_configs = {
        'deepseek': {
            'url': api_config.get('api_url', 'https://api.deepseek.com/v1/chat/completions'),
            'headers': {
                'Authorization': f"Bearer {api_key}",
                'Content-Type': 'application/json'
            },
            'body': {
                'model': api_config.get('model', 'deepseek-chat'),
                'messages': messages,
                'temperature': api_config.get('temperature', 0.7),
                'max_tokens': api_config.get('max_tokens', 2000),
            }
        },
        'zhipu': {
            'url': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            'headers': {
                'Authorization': f"Bearer {api_key}",
                'Content-Type': 'application/json'
            },
            'body': {
                'model': api_config.get('model', 'glm-4-flash'),
                'messages': messages,
                'temperature': api_config.get('temperature', 0.7),
                'max_tokens': api_config.get('max_tokens', 2000),
            }
        },
        'qwen': {
            'url': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            'headers': {
                'Authorization': f"Bearer {api_key}",
                'Content-Type': 'application/json'
            },
            'body': {
                'model': api_config.get('model', 'qwen-turbo'),
                'messages': messages,
                'temperature': api_config.get('temperature', 0.7),
                'max_tokens': api_config.get('max_tokens', 2000),
            }
        }
    }

    provider_config = api_configs.get(provider)
    if not provider_config:
        return None

    try:
        response = requests.post(
            provider_config['url'],
            headers=provider_config['headers'],
            json=provider_config['body'],
            timeout=api_config.get('timeout', 30)
        )

        if response.status_code == 200:
            data = response.json()
            return data['choices'][0]['message']['content'].strip()
        else:
            print(f"[AI Service] API error: {response.status_code}, {response.text[:200]}")
            return None

    except requests.exceptions.Timeout:
        print("[AI Service] API timeout")
        return None
    except requests.exceptions.ConnectionError:
        print("[AI Service] Connection failed")
        return None
    except Exception as e:
        print(f"[AI Service] Error: {str(e)}")
        return None


def test_ai_connection(api_config=None):
    """
    测试AI API连接
    返回 {'success': bool, 'message': str}
    """
    if api_config is None:
        api_config = _get_active_config()

    api_key = api_config.get('api_key', '').strip()
    if not api_key:
        return {'success': False, 'message': '请先在设置页面填入API Key'}

    test_messages = [{'role': 'user', 'content': '请回复"连接成功"三个字'}]
    result = _call_real_api(test_messages, api_config)

    if result:
        return {'success': True, 'message': f'连接成功: {result[:100]}'}
    else:
        return {'success': False, 'message': '连接失败，请检查API Key和网络连接'}


def _mock_response(messages):
    """
    模拟AI回复（离线/演示模式）
    当API不可用时自动使用，确保系统正常运行
    """
    last_msg = messages[-1]['content'] if messages else ""

    # ---- 学习计划生成 ----
    if any(kw in last_msg for kw in ['学习计划', '计划', '规划']):
        return _generate_mock_plan(last_msg)

    # ---- 笔记总结 ----
    if '摘要' in last_msg or '关键知识点' in last_msg:
        return _generate_mock_summary(last_msg)

    # ---- 知识图谱JSON ----
    if 'JSON' in last_msg or 'nodes' in last_msg.lower():
        return _generate_mock_knowledge_json()

    # ---- 问候 ----
    if any(kw in last_msg for kw in ['你好', 'hello', 'hi', '嗨']):
        return (
            "👋 你好！我是**智学通AI学习助手**，很高兴为你服务！\n\n"
            "我可以帮你做这些事情：\n\n"
            "📚 **智能问答** — 解答课程学习中的各种问题\n"
            "📋 **学习规划** — 根据你的目标制定个性化学习计划\n"
            "🧠 **知识图谱** — 可视化展示学科知识体系\n"
            "📝 **笔记助手** — AI自动总结提炼学习要点\n"
            "📊 **学习分析** — 追踪你的学习进度和效果\n\n"
            "请告诉我你需要什么帮助吧！😊"
        )

    # ---- C/C++相关 ----
    if any(kw in last_msg.lower() for kw in ['c语言', 'c++', 'cpp', '指针', 'malloc', 'new', 'delete', 'stl', '模板']):
        return _generate_cpp_response(last_msg)

    # ---- 数据结构 ----
    if any(kw in last_msg for kw in ['数据结构', '链表', '栈', '队列', '树', '图', '排序', '查找', 'hash', '哈希']):
        return _generate_ds_response(last_msg)

    # ---- 算法 ----
    if any(kw in last_msg for kw in ['算法', '动态规划', '贪心', '递归', '回溯', '分治', 'dp', 'dfs', 'bfs']):
        return _generate_algo_response(last_msg)

    # ---- 通用回复 ----
    return _generate_general_response(last_msg)


def _generate_mock_plan(msg):
    """生成模拟的学习计划"""
    # 尝试从消息中提取学科信息
    subjects = ['计算机科学', '编程', '数学', '英语', '物理']
    found_subject = '计算机科学'
    for s in subjects:
        if s in msg:
            found_subject = s
            break

    return f"""## 📋 学习总览
**学科**：{found_subject}
**目标**：系统掌握核心知识体系，具备独立解决问题的能力
**周期**：4周（共28天）
**每日投入**：2-3小时

## 🎯 阶段性目标

### 第一阶段：基础夯实（第1周）
掌握核心概念和基础理论，搭建知识框架

### 第二阶段：能力提升（第2周）
深入学习重点难点，通过练习巩固

### 第三阶段：综合应用（第3周）
完成综合性项目，将知识转化为实践能力

### 第四阶段：查漏补缺（第4周）
复习薄弱环节，模拟测试，全面巩固

## 📅 每周详细计划

| 周次 | 日期 | 学习内容 | 重点任务 | 预计时长 |
|------|------|----------|----------|----------|
| 第1周 | 周一 | 基础概念回顾 | 阅读教材第1-2章 | 2h |
| 第1周 | 周二 | 核心理论理解 | 制作思维导图 | 2.5h |
| 第1周 | 周三 | 基础练习题 | 完成课后习题 | 3h |
| 第1周 | 周四 | 进阶概念学习 | 阅读教材第3-4章 | 2h |
| 第1周 | 周五 | 知识点串联 | 整理本周笔记 | 2h |
| 第1周 | 周末 | 周复习+测试 | 完成周测卷 | 3h |
| 第2周 | 周一 | 重点突破(上) | 专项练习 | 3h |
| 第2周 | 周二 | 重点突破(下) | 难题攻克 | 3h |
| 第2周 | 周三 | 编程实践 | 完成2道综合题 | 3h |
| 第2周 | 周四 | 小组讨论 | 交流解题思路 | 2h |
| 第2周 | 周五 | 阶段总结 | 整理错题集 | 2h |
| 第2周 | 周末 | 阶段测试 | 模拟测试 | 3h |
| 第3周 | 全周 | 综合项目实战 | 完成1个完整项目 | 15h/周 |
| 第4周 | 全周 | 总复习+冲刺 | 模拟考试×3 | 15h/周 |

## 📖 推荐学习资源
- 📕 **经典教材**：《计算机科学导论》、官方文档
- 🎥 **视频教程**：中国大学MOOC相关课程、B站优质教程
- 💻 **在线练习**：LeetCode、牛客网、洛谷
- 📱 **辅助工具**：本平台AI助手随时答疑

## 💡 学习建议
1. **费曼学习法**：尝试把学到的知识讲给别人听
2. **番茄工作法**：25分钟专注学习 + 5分钟休息
3. **间隔重复**：学完后第1、3、7天进行复习
4. **做好笔记**：使用本平台的笔记功能记录重点
5. **保持运动**：每天适当运动，保持良好的学习状态

---
✨ *此计划由智学通AI自动生成，你可以根据实际情况进行调整*"""


def _generate_mock_summary(msg):
    """生成模拟的笔记摘要"""
    return """## 📝 摘要
本文涵盖了计算机科学基础概念，包括数据结构的核心思想和算法设计的基本方法，适合初学者建立知识框架。

## 🔑 关键知识点
1. **数据结构是程序的骨架** — 选择合适的数据结构能大幅提升程序效率
2. **时间复杂度分析** — O(n)、O(nlogn)、O(n²) 是衡量算法性能的关键指标
3. **空间换时间** — 哈希表等结构通过额外空间换取O(1)的查找时间
4. **递归与迭代** — 递归代码简洁但需注意栈溢出，迭代更高效
5. **抽象数据类型(ADT)** — 将接口与实现分离是良好设计的基础

## 🏷️ 建议标签
数据结构, 算法基础, 复杂度分析, 编程入门, 计算机基础"""


def _generate_mock_knowledge_json():
    """生成模拟的知识图谱JSON数据"""
    return json.dumps({
        "nodes": [
            {"name": "数据结构", "category": "核心", "value": 10, "description": "计算机存储和组织数据的方式"},
            {"name": "线性表", "category": "基础结构", "value": 8, "description": "具有线性关系的数据元素的有限序列"},
            {"name": "链表", "category": "基础结构", "value": 8, "description": "通过指针链接的线性结构"},
            {"name": "栈", "category": "基础结构", "value": 7, "description": "后进先出(LIFO)的线性结构"},
            {"name": "队列", "category": "基础结构", "value": 7, "description": "先进先出(FIFO)的线性结构"},
            {"name": "树", "category": "高级结构", "value": 9, "description": "具有层次关系的非线性结构"},
            {"name": "二叉树", "category": "高级结构", "value": 9, "description": "每个节点最多有两个子节点的树"},
            {"name": "二叉搜索树", "category": "高级结构", "value": 8, "description": "左<根<右的二叉树"},
            {"name": "平衡树", "category": "高级结构", "value": 8, "description": "保持高度平衡的BST，如AVL、红黑树"},
            {"name": "堆", "category": "高级结构", "value": 8, "description": "完全二叉树实现的优先队列"},
            {"name": "图", "category": "高级结构", "value": 9, "description": "由顶点和边组成的复杂非线性结构"},
            {"name": "哈希表", "category": "高级结构", "value": 8, "description": "通过哈希函数实现O(1)平均查找"},
            {"name": "排序算法", "category": "算法", "value": 8, "description": "将数据按特定顺序排列"},
            {"name": "查找算法", "category": "算法", "value": 7, "description": "在数据集合中寻找特定元素"},
            {"name": "动态规划", "category": "算法", "value": 9, "description": "将复杂问题分解为子问题求解"},
            {"name": "贪心算法", "category": "算法", "value": 8, "description": "每步选择局部最优解"},
        ],
        "edges": [
            {"source": "数据结构", "target": "线性表", "label": "包含"},
            {"source": "线性表", "target": "链表", "label": "链式实现"},
            {"source": "线性表", "target": "栈", "label": "特例"},
            {"source": "线性表", "target": "队列", "label": "特例"},
            {"source": "数据结构", "target": "树", "label": "包含"},
            {"source": "树", "target": "二叉树", "label": "最常见"},
            {"source": "二叉树", "target": "二叉搜索树", "label": "有序"},
            {"source": "二叉搜索树", "target": "平衡树", "label": "优化"},
            {"source": "二叉树", "target": "堆", "label": "完全二叉树"},
            {"source": "数据结构", "target": "图", "label": "包含"},
            {"source": "数据结构", "target": "哈希表", "label": "包含"},
            {"source": "图", "target": "动态规划", "label": "常用于"},
            {"source": "排序算法", "target": "查找算法", "label": "依赖"},
            {"source": "堆", "target": "排序算法", "label": "堆排序"},
            {"source": "二叉搜索树", "target": "查找算法", "label": "二分查找"},
            {"source": "动态规划", "target": "贪心算法", "label": "对比"},
        ]
    }, ensure_ascii=False)


def _generate_cpp_response(msg):
    """C/C++相关的专业回复"""
    return """关于C/C++编程，以下是核心要点：

## 💡 C/C++ 核心知识

### 1. 指针与内存管理
```c
// C语言动态内存
int *arr = (int*)malloc(n * sizeof(int));
free(arr);  // 别忘了释放！

// C++动态内存
int *arr = new int[n];
delete[] arr;  // 数组用 delete[]
```

### 2. C++ 三大特性
- **封装**：`class` 将数据和操作绑定，用 `public/private/protected` 控制访问
- **继承**：子类复用父类代码，支持多层继承
- **多态**：虚函数实现运行时多态，`virtual` 关键字

### 3. STL 常用容器
| 容器 | 特点 | 适用场景 |
|------|------|----------|
| `vector` | 动态数组 | 随机访问多 |
| `list` | 双向链表 | 频繁插入删除 |
| `map` | 红黑树，有序 | 需要排序的键值对 |
| `unordered_map` | 哈希表 | 快速查找 |
| `stack/queue` | 受限线性表 | 特定算法 |
| `set` | 有序集合 | 去重+排序 |

### 4. 常见陷阱 ⚠️
- 悬空指针 → `free/delete` 后置 `NULL`
- 内存泄漏 → 成对使用 `new/delete`, `malloc/free`
- 数组越界 → 使用 `std::vector` + `at()` 方法
- 浅拷贝 → 自定义拷贝构造函数

有什么具体的C/C++问题可以继续问我！"""


def _generate_ds_response(msg):
    """数据结构相关的专业回复"""
    return """## 🧠 数据结构核心对比

### 时间复杂度对比表

| 数据结构 | 查找 | 插入 | 删除 | 空间 |
|----------|------|------|------|------|
| 数组 | O(n) / O(1) | O(n) | O(n) | O(n) |
| 链表 | O(n) | O(1) | O(1) | O(n) |
| 跳表 | O(logn) | O(logn) | O(logn) | O(n) |
| 哈希表 | O(1) 平均 | O(1) 平均 | O(1) 平均 | O(n) |
| 二叉搜索树 | O(logn) 平均 | O(logn) | O(logn) | O(n) |
| 平衡树(AVL) | O(logn) | O(logn) | O(logn) | O(n) |
| 堆 | O(n) | O(logn) | O(logn) | O(n) |

### 选择建议

- **频繁查找** → 哈希表（O(1)！）
- **需要有序** → 平衡树/跳表
- **频繁插入删除** → 链表
- **优先队列** → 堆
- **图问题** → 邻接表（稀疏）/ 邻接矩阵（稠密）
- **最近最少用** → LRU用哈希表+双向链表

### 典型面试题
1. 用两个栈实现一个队列
2. 判断链表是否有环（快慢指针）
3. 二叉树的层序遍历（BFS）
4. Top K 问题（堆/快排partition）
5. LRU Cache 实现

有什么具体的数据结构问题需要深入探讨吗？"""


def _generate_algo_response(msg):
    """算法相关的专业回复"""
    return """## ⚡ 算法设计技巧

### 1. 动态规划（DP）解题步骤
```
① 定义状态：dp[i] 表示什么？
② 状态转移方程：dp[i] = ?
③ 初始条件：dp[0] = ?
④ 计算顺序：从左到右 / 从下到上
⑤ 返回答案
```

### 2. 回溯法模板
```cpp
void backtrack(路径, 选择列表) {
    if (满足结束条件) {
        保存结果;
        return;
    }
    for (选择 in 选择列表) {
        做选择;
        backtrack(路径, 选择列表);
        撤销选择;  // 关键！
    }
}
```

### 3. 分治法三步骤
- **分解**：将原问题分成若干个规模较小的子问题
- **解决**：递归求解各个子问题
- **合并**：将子问题的解合并为原问题的解

### 4. 贪心 vs DP
| 特性 | 贪心 | 动态规划 |
|------|------|----------|
| 最优子结构 | ✅ | ✅ |
| 无后效性 | ✅ | ✅ |
| 贪心选择性质 | ✅ | ❌ 不一定 |
| 时间复杂度 | 一般更低 | 一般更高 |

有具体题目需要分析吗？可以发给我！"""


def _generate_general_response(msg):
    """通用回复"""
    return (
        f"关于「**{msg[:80]}**」这个问题，我来为你详细解答：\n\n"
        f"这是一个很有价值的问题！以下是分析和建议：\n\n"
        f"### 📌 核心要点\n"
        f"1. **理解基本概念** — 先弄清楚定义和原理，不要急于求成\n"
        f"2. **动手实践** — 理论结合实践，通过写代码来加深理解\n"
        f"3. **善用资源** — 查阅教材、官方文档、优质博客\n"
        f"4. **举一反三** — 尝试解决相关的变体问题\n"
        f"5. **及时总结** — 用本平台的笔记功能记录心得体会\n\n"
        f"### 💡 延伸思考\n"
        f"- 这个问题在实际项目中有什么应用场景？\n"
        f"- 有没有更高效的解决方案？\n"
        f"- 相关的知识点还有哪些需要掌握？\n\n"
        f"如果你有更具体的问题，欢迎继续提问！我会给出更针对性的解答。😊\n\n"
        f"---\n💡 *提示：配置DeepSeek API Key后可以获得更智能的回复（免费注册：platform.deepseek.com）*"
    )


# ============================================
# 测试代码
# ============================================
if __name__ == '__main__':
    # 测试基本对话
    print("=== 测试 1: 基本对话 ===")
    response = chat_with_ai("你好，请介绍一下自己")
    print(response[:200])
    print()

    # 测试学习计划生成
    print("=== 测试 2: 学习计划生成 ===")
    response = generate_study_plan("C语言", "掌握数据结构和算法", "每天2小时，共4周")
    print(response[:300])
    print()

    # 测试笔记总结
    print("=== 测试 3: 笔记总结 ===")
    response = summarize_notes("今天学习了二叉树，包括前序、中序、后序遍历，以及层序遍历的BFS实现。")
    print(response)

    print("\n✅ AI服务模块测试完成！")
