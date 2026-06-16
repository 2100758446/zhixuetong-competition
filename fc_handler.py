"""
阿里云函数计算 Custom Runtime 入口
用法: python fc_handler.py
"""
import os
import sys
import shutil
from wsgiref.simple_server import make_server

# ── 1. 处理 SQLite 数据库：复制种子数据库到 /tmp ──
DB_DIR = os.path.join('/tmp', 'data')
DB_PATH = os.path.join(DB_DIR, 'zhixuetong.db')
SEED_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'zhixuetong.db')

os.makedirs(DB_DIR, exist_ok=True)

# 如果 /tmp 里没有数据库文件，从种子数据库复制
if not os.path.exists(DB_PATH) and os.path.exists(SEED_DB):
    shutil.copy2(SEED_DB, DB_PATH)
    print(f'[FC] 已从种子数据库创建: {DB_PATH}')

# ── 2. 设置环境变量，让 config.py 使用 /tmp 中的数据库 ──
os.environ['FC_DATABASE_PATH'] = DB_PATH

# ── 3. 运行时修改 config.py 里的数据库路径 ──
import config
config.DATABASE_URI = f'sqlite:///{DB_PATH}'

# ── 4. 导入 Flask 应用 ──
from app import app

# ── 5. 启动 HTTP 服务器 ──
PORT = int(os.environ.get('FC_SERVER_PORT', 9000))

if __name__ == '__main__':
    print(f'[FC] 智学通启动在端口 {PORT}')
    httpd = make_server('0.0.0.0', PORT, app)
    httpd.serve_forever()
