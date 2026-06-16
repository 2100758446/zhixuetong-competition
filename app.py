"""
智学通 (ZhiXueTong) - AI校园学习助手
=====================================
湖南省大学生程序设计竞赛 - 应用开发赛道 参赛作品

一个集AI智能问答、学习计划生成、知识图谱可视化、
笔记管理于一体的综合性学习平台。

技术栈: Python Flask + SQLite + DeepSeek AI + ECharts + Bootstrap 5
作者: 智学通开发团队
版本: 2.0.0

启动方式: python app.py
访问地址: http://localhost:5000
"""

import os
import json
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, jsonify, session,
    redirect, url_for, flash, Response, stream_with_context
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import config
from ai_service import chat_with_ai, generate_study_plan, summarize_notes, get_knowledge_suggestion, _get_active_config as get_active_api_config

# ============================================
# 应用初始化
# ============================================
app = Flask(__name__)
app.config['SECRET_KEY'] = config.APP_CONFIG['secret_key']
app.config['SQLALCHEMY_DATABASE_URI'] = config.DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 确保data目录存在
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'), exist_ok=True)

db = SQLAlchemy(app)

# ============================================
# 数据库模型
# ============================================

class User(db.Model):
    """用户表"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True)
    password_hash = db.Column(db.String(200), nullable=False)
    avatar_url = db.Column(db.String(200), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    last_login = db.Column(db.DateTime, default=lambda: datetime.utcnow())

    # 关联
    notes = db.relationship('Note', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    plans = db.relationship('StudyPlan', backref='author', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Note(db.Model):
    """学习笔记表"""
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, default='')
    tags = db.Column(db.String(200), default='')
    subject = db.Column(db.String(50), default='通用')
    ai_summary = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    updated_at = db.Column(db.DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'tags': self.tags,
            'subject': self.subject,
            'ai_summary': self.ai_summary,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M'),
        }


class StudyPlan(db.Model):
    """学习计划表"""
    __tablename__ = 'study_plans'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    subject = db.Column(db.String(50), default='通用')
    goal = db.Column(db.String(500), default='')
    plan_content = db.Column(db.Text, default='')
    progress = db.Column(db.Integer, default=0)  # 0-100
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'subject': self.subject,
            'goal': self.goal,
            'plan_content': self.plan_content,
            'progress': self.progress,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ============================================
# 用户认证装饰器
# ============================================

def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('请先登录后再访问', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """获取当前登录用户"""
    if 'user_id' in session:
        return db.session.get(User, session['user_id'])
    return None


# 将当前用户注入所有模板
@app.context_processor
def inject_user():
    return {
        'current_user': get_current_user(),
        'app_name': config.APP_CONFIG['name'],
        'app_version': config.APP_CONFIG['version'],
    }


# ============================================
# 页面路由
# ============================================

@app.route('/')
def index():
    """首页/仪表盘"""
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = get_current_user()
    notes_count = Note.query.filter_by(user_id=user.id).count()
    plans_count = StudyPlan.query.filter_by(user_id=user.id).count()
    total_study_days = max(1, (datetime.utcnow() - user.created_at).days)

    # 本周学习统计（模拟数据 + 实际数据）
    weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    weekly_stats = []
    for i, day in enumerate(weekdays):
        weekly_stats.append({
            'day': day,
            'hours': round(1.5 + (i * 0.3) % 2, 1) if i <= datetime.utcnow().weekday() else 0,
            'tasks': (i + 1) * 2 if i <= datetime.utcnow().weekday() else 0,
        })

    return render_template('dashboard.html',
                         notes_count=notes_count,
                         plans_count=plans_count,
                         total_study_days=total_study_days,
                         weekly_stats=weekly_stats)


@app.route('/login', methods=['GET', 'POST'])
def login():
    """登录页面"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('请输入用户名和密码', 'danger')
            return render_template('login.html')

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            user.last_login = datetime.utcnow()
            db.session.commit()
            flash(f'欢迎回来，{username}！👋', 'success')
            return redirect(url_for('index'))
        else:
            flash('用户名或密码错误', 'danger')

    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    """注册页面"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        password2 = request.form.get('password2', '')

        # 验证输入
        if not username or not password:
            flash('请填写所有必填字段', 'danger')
            return render_template('register.html')

        if len(username) < 3:
            flash('用户名至少需要3个字符', 'danger')
            return render_template('register.html')

        if len(password) < 6:
            flash('密码至少需要6个字符', 'danger')
            return render_template('register.html')

        if password != password2:
            flash('两次密码输入不一致', 'danger')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('用户名已被使用', 'danger')
            return render_template('register.html')

        if email and User.query.filter_by(email=email).first():
            flash('邮箱已被注册', 'danger')
            return render_template('register.html')

        # 创建用户
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        flash('注册成功！请登录', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/logout')
def logout():
    """退出登录"""
    session.clear()
    flash('已成功退出登录', 'info')
    return redirect(url_for('login'))


@app.route('/chat')
@login_required
def chat_page():
    """AI智能对话页面"""
    return render_template('chat.html')


@app.route('/planner')
@login_required
def planner():
    """学习计划页面"""
    user = get_current_user()
    plans = StudyPlan.query.filter_by(user_id=user.id).order_by(StudyPlan.created_at.desc()).all()
    return render_template('planner.html', plans=plans)


@app.route('/knowledge')
@login_required
def knowledge():
    """知识图谱页面"""
    return render_template('knowledge.html',
                         knowledge_graph=config.KNOWLEDGE_GRAPH)


@app.route('/notes')
@login_required
def notes_page():
    """学习笔记页面"""
    user = get_current_user()
    notes = Note.query.filter_by(user_id=user.id).order_by(Note.updated_at.desc()).all()
    return render_template('notes.html', notes=notes)


# ============================================
# API路由 - AI功能
# ============================================

@app.route('/api/chat', methods=['POST'])
@login_required
def api_chat():
    """AI对话API"""
    data = request.get_json()
    user_message = data.get('message', '').strip()
    conversation_history = data.get('history', [])

    if not user_message:
        return jsonify({'success': False, 'error': '消息不能为空'})

    try:
        # 调用AI服务，带上对话历史
        response = chat_with_ai(user_message, conversation_history=conversation_history)
        return jsonify({'success': True, 'response': response})
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI服务异常: {str(e)}'})


@app.route('/api/chat/stream', methods=['POST'])
@login_required
def api_chat_stream():
    """AI对话API（流式响应，模拟打字效果）"""
    data = request.get_json()
    user_message = data.get('message', '').strip()
    conversation_history = data.get('history', [])

    if not user_message:
        return jsonify({'success': False, 'error': '消息不能为空'})

    try:
        response = chat_with_ai(user_message, conversation_history=conversation_history)

        def generate():
            # 模拟流式输出（逐字符返回）
            for i, char in enumerate(response):
                yield f"data: {json.dumps({'char': char, 'index': i}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True, 'full': response}, ensure_ascii=False)}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
            }
        )
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI服务异常: {str(e)}'})


@app.route('/api/generate-plan', methods=['POST'])
@login_required
def api_generate_plan():
    """生成学习计划API"""
    data = request.get_json()
    subject = data.get('subject', '').strip()
    goal = data.get('goal', '').strip()
    available_time = data.get('available_time', '').strip()
    difficulty = data.get('difficulty', '中等')

    if not subject or not goal or not available_time:
        return jsonify({'success': False, 'error': '请填写所有必填字段'})

    try:
        plan_content = generate_study_plan(subject, goal, available_time, difficulty)

        # 保存到数据库
        user = get_current_user()
        plan = StudyPlan(
            title=f'{subject}学习计划',
            subject=subject,
            goal=goal,
            plan_content=plan_content,
            user_id=user.id
        )
        db.session.add(plan)
        db.session.commit()

        return jsonify({'success': True, 'plan': plan.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': f'生成计划失败: {str(e)}'})


@app.route('/api/summarize-note', methods=['POST'])
@login_required
def api_summarize_note():
    """AI总结笔记API"""
    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'success': False, 'error': '笔记内容不能为空'})

    try:
        summary = summarize_notes(content)
        return jsonify({'success': True, 'summary': summary})
    except Exception as e:
        return jsonify({'success': False, 'error': f'总结失败: {str(e)}'})


@app.route('/api/knowledge-ai', methods=['POST'])
@login_required
def api_knowledge_ai():
    """获取AI知识图谱扩展"""
    data = request.get_json()
    prompt = data.get('prompt', '请为计算机科学数据结构部分生成知识图谱')

    try:
        result = get_knowledge_suggestion(prompt)
        # 尝试解析JSON
        try:
            graph_data = json.loads(result)
            return jsonify({'success': True, 'graph': graph_data})
        except json.JSONDecodeError:
            # 如果不是JSON，返回原始文本
            return jsonify({'success': True, 'text': result})
    except Exception as e:
        return jsonify({'success': False, 'error': f'获取知识图谱失败: {str(e)}'})


# ============================================
# API路由 - 笔记管理
# ============================================

@app.route('/api/notes', methods=['GET', 'POST'])
@login_required
def api_notes():
    """笔记列表 / 创建笔记"""
    user = get_current_user()

    if request.method == 'GET':
        notes = Note.query.filter_by(user_id=user.id).order_by(Note.updated_at.desc()).all()
        return jsonify({'success': True, 'notes': [n.to_dict() for n in notes]})

    elif request.method == 'POST':
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        tags = data.get('tags', '')
        subject = data.get('subject', '通用')

        if not title:
            return jsonify({'success': False, 'error': '标题不能为空'})

        note = Note(
            title=title,
            content=content,
            tags=tags,
            subject=subject,
            user_id=user.id
        )
        db.session.add(note)
        db.session.commit()

        return jsonify({'success': True, 'note': note.to_dict()})


@app.route('/api/notes/<int:note_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_note_detail(note_id):
    """笔记详情 / 更新 / 删除"""
    user = get_current_user()
    note = Note.query.filter_by(id=note_id, user_id=user.id).first()

    if not note:
        return jsonify({'success': False, 'error': '笔记不存在'})

    if request.method == 'GET':
        return jsonify({'success': True, 'note': note.to_dict()})

    elif request.method == 'PUT':
        data = request.get_json()
        if 'title' in data:
            note.title = data['title']
        if 'content' in data:
            note.content = data['content']
        if 'tags' in data:
            note.tags = data['tags']
        if 'subject' in data:
            note.subject = data['subject']
        if 'ai_summary' in data:
            note.ai_summary = data['ai_summary']
        note.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'success': True, 'note': note.to_dict()})

    elif request.method == 'DELETE':
        db.session.delete(note)
        db.session.commit()
        return jsonify({'success': True, 'message': '笔记已删除'})


# ============================================
# API路由 - 学习计划管理
# ============================================

@app.route('/api/plans', methods=['GET'])
@login_required
def api_plans():
    """获取学习计划列表"""
    user = get_current_user()
    plans = StudyPlan.query.filter_by(user_id=user.id).order_by(StudyPlan.created_at.desc()).all()
    return jsonify({'success': True, 'plans': [p.to_dict() for p in plans]})


@app.route('/api/plans/<int:plan_id>', methods=['GET', 'DELETE'])
@login_required
def api_plan_detail(plan_id):
    """学习计划详情 / 删除"""
    user = get_current_user()
    plan = StudyPlan.query.filter_by(id=plan_id, user_id=user.id).first()

    if not plan:
        return jsonify({'success': False, 'error': '计划不存在'})

    if request.method == 'GET':
        return jsonify({'success': True, 'plan': plan.to_dict()})

    elif request.method == 'DELETE':
        db.session.delete(plan)
        db.session.commit()
        return jsonify({'success': True, 'message': '计划已删除'})


@app.route('/api/plans/<int:plan_id>/progress', methods=['PUT'])
@login_required
def api_update_progress(plan_id):
    """更新学习进度"""
    user = get_current_user()
    plan = StudyPlan.query.filter_by(id=plan_id, user_id=user.id).first()

    if not plan:
        return jsonify({'success': False, 'error': '计划不存在'})

    data = request.get_json()
    progress = data.get('progress', 0)
    plan.progress = max(0, min(100, progress))
    db.session.commit()

    return jsonify({'success': True, 'progress': plan.progress})


# ============================================
# API路由 - 统计数据
# ============================================

@app.route('/api/stats')
@login_required
def api_stats():
    """获取用户学习统计数据"""
    user = get_current_user()

    notes_count = Note.query.filter_by(user_id=user.id).count()
    plans_count = StudyPlan.query.filter_by(user_id=user.id).count()
    total_study_days = max(1, (datetime.utcnow() - user.created_at).days)

    # 各学科笔记分布
    from sqlalchemy import func
    subject_distribution = db.session.query(
        Note.subject, func.count(Note.id)
    ).filter_by(user_id=user.id).group_by(Note.subject).all()

    subjects = [{'name': s[0], 'count': s[1]} for s in subject_distribution]

    return jsonify({
        'success': True,
        'stats': {
            'notes_count': notes_count,
            'plans_count': plans_count,
            'total_study_days': total_study_days,
            'subjects': subjects,
        }
    })


# ============================================
# 错误处理
# ============================================

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404


@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500


# ============================================
# 应用初始化（首次运行创建数据库）
# ============================================

# ============================================
# 设置管理（存储在 data/settings.json）
# ============================================
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'settings.json')

def load_settings():
    """加载应用设置"""
    defaults = {
        'api_provider': 'deepseek',
        'api_key': '',
        'api_url': 'https://api.deepseek.com/v1/chat/completions',
        'api_model': 'deepseek-chat',
    }
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                defaults.update(saved)
    except Exception:
        pass
    return defaults

def save_settings(settings_dict):
    """保存应用设置"""
    current = load_settings()
    current.update(settings_dict)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(current, f, ensure_ascii=False, indent=2)


@app.route('/settings')
@login_required
def settings_page():
    """系统设置页面"""
    web_settings = load_settings()
    return render_template('settings.html', settings=web_settings)


@app.route('/api/settings', methods=['GET', 'POST'])
@login_required
def api_settings():
    """获取/保存设置API"""
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': load_settings()})

    elif request.method == 'POST':
        data = request.get_json()
        allowed_keys = ['api_provider', 'api_key', 'api_url', 'api_model']
        new_settings = {k: data[k] for k in allowed_keys if k in data}
        save_settings(new_settings)
        return jsonify({'success': True, 'message': '设置已保存', 'settings': load_settings()})


@app.route('/api/test-ai', methods=['POST'])
@login_required
def api_test_ai():
    """测试AI连接"""
    from ai_service import test_ai_connection
    result = test_ai_connection(get_active_api_config())
    return jsonify(result)


def init_db():
    """初始化数据库（仅创建表，不预设数据）"""
    with app.app_context():
        db.create_all()


# ============================================
# 启动入口
# ============================================

if __name__ == '__main__':
    # Windows控制台UTF-8编码支持
    import sys
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    init_db()
    print("=" * 60)
    print(f"  {config.APP_CONFIG['name']} - {config.APP_CONFIG['subtitle']}")
    print(f"  Version: {config.APP_CONFIG['version']}")
    print(f"  URL: http://localhost:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
