"""
智学通 - AI校园学习助手 配置文件
===============================
使用前请在此文件中配置API密钥等信息
"""

import os

# ============================================
# AI API 配置
# ============================================
# 推荐使用 DeepSeek API（免费额度，注册即送）
# 注册地址: https://platform.deepseek.com/
# 注册后在 API Keys 页面创建密钥，复制到下方
#
# 其他可选API:
# - 智谱AI (GLM): https://open.bigmodel.cn/
# - 通义千问: https://dashscope.aliyun.com/
# - 零一万物: https://platform.lingyiwanwu.com/

AI_CONFIG = {
    # 主API配置（DeepSeek，推荐）
    'provider': 'deepseek',           # 可选: deepseek, zhipu, qwen, mock
    'api_key': '',                     # 填入你的API Key
    'api_url': 'https://api.deepseek.com/v1/chat/completions',
    'model': 'deepseek-chat',

    # 备用API配置
    'fallback_provider': 'mock',       # API失效时使用mock模式
    'temperature': 0.7,
    'max_tokens': 2000,
    'timeout': 30,
}

# ============================================
# 应用配置
# ============================================
APP_CONFIG = {
    'name': '智学通',
    'subtitle': 'AI校园学习助手',
    'version': '2.0.0',
    'author': '智学通开发团队',
    'secret_key': 'zhixuetong-secret-key-2026-hncp',
}

# ============================================
# 数据库配置
# ============================================
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "data", "zhixuetong.db")}'

# ============================================
# 知识图谱 - 计算机科学预设知识点
# ============================================
KNOWLEDGE_GRAPH = {
    '计算机科学': {
        '编程基础': ['变量与类型', '控制流', '函数', '数组与指针', '结构体', '文件操作'],
        '数据结构': ['线性表', '栈与队列', '树与二叉树', '图', '查找算法', '排序算法'],
        '算法设计': ['分治法', '动态规划', '贪心算法', '回溯法', '分支限界', '随机算法'],
        '计算机网络': ['OSI模型', 'TCP/IP', 'HTTP协议', 'DNS', '网络安全', 'Socket编程'],
        '操作系统': ['进程管理', '内存管理', '文件系统', 'I/O系统', '死锁', '并发编程'],
        '数据库': ['关系模型', 'SQL语言', '索引与优化', '事务管理', 'NoSQL', '数据库设计'],
    },
    '人工智能': {
        '机器学习': ['监督学习', '无监督学习', '强化学习', '特征工程', '模型评估', '集成学习'],
        '深度学习': ['神经网络基础', 'CNN', 'RNN/LSTM', 'Transformer', 'GAN', '迁移学习'],
        '自然语言处理': ['文本预处理', '词向量', '序列标注', '文本分类', '机器翻译', '大语言模型'],
        '计算机视觉': ['图像处理', '目标检测', '图像分割', '人脸识别', 'OCR', '视频分析'],
    },
}
