/**
 * 智学通 - AI聊天功能JavaScript
 * 支持SSE流式响应、Markdown渲染、消息历史
 */

let chatHistory = [];      // 对话历史
let isProcessing = false;  // 是否正在处理请求

document.addEventListener('DOMContentLoaded', function() {
    // 更新AI状态
    checkAIStatus();
    // 自动聚焦输入框
    document.getElementById('chatInput')?.focus();
});

/**
 * 发送预设问题
 */
function sendPreset(question) {
    document.getElementById('chatInput').value = question;
    sendMessage();
}

/**
 * 发送消息
 */
async function sendMessage() {
    if (isProcessing) return;

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    // 隐藏欢迎界面
    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.style.display = 'none';

    // 添加用户消息到界面
    addMessage('user', message);
    chatHistory.push({ role: 'user', content: message });
    input.value = '';
    input.style.height = 'auto';

    // 显示AI打字中
    isProcessing = true;
    updateSendButton(true);
    const typingId = showTyping();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history: chatHistory.slice(0, -1) })
        });

        const data = await response.json();
        removeTyping(typingId);

        if (data.success) {
            addMessage('ai', data.response);
            chatHistory.push({ role: 'assistant', content: data.response });
        } else {
            addMessage('ai', '⚠️ ' + (data.error || '未知错误，请稍后重试'));
        }
    } catch (err) {
        removeTyping(typingId);
        addMessage('ai', '⚠️ 网络连接失败，请检查网络后重试。\n\n错误信息: ' + err.message);
    } finally {
        isProcessing = false;
        updateSendButton(false);
        scrollToBottom();
    }
}

/**
 * 添加消息到聊天界面
 */
function addMessage(role, content) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (role === 'user' ? 'user-message' : '');

    const avatarIcon = role === 'user' ? 'bi-person-fill' : 'bi-robot';
    const roleName = role === 'user' ? '我' : '智学通AI';

    messageDiv.innerHTML = `
        <div class="message-avatar ${role}">
            <i class="bi ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-role">${roleName}</div>
            <div class="message-text">${renderContent(content)}</div>
        </div>
    `;

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();

    // 代码块语法高亮（如果Prism可用）
    if (typeof Prism !== 'undefined') {
        messageDiv.querySelectorAll('pre code').forEach(block => {
            Prism.highlightElement(block);
        });
    }
}

/**
 * 渲染消息内容（Markdown）
 */
function renderContent(text) {
    if (typeof marked !== 'undefined') {
        // 配置marked
        marked.setOptions({
            breaks: true,
            gfm: true,
        });
        return marked.parse(text);
    }
    // 回退方案
    return simpleMarkdown(text);
}

/**
 * 显示打字指示器
 */
function showTyping() {
    const messagesDiv = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    const id = 'typing-' + Date.now();
    typingDiv.id = id;
    typingDiv.className = 'message';
    typingDiv.innerHTML = `
        <div class="message-avatar ai">
            <i class="bi bi-robot"></i>
        </div>
        <div class="message-content">
            <div class="message-role">智学通AI</div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesDiv.appendChild(typingDiv);
    scrollToBottom();
    return id;
}

/**
 * 移除打字指示器
 */
function removeTyping(id) {
    const typingDiv = document.getElementById(id);
    if (typingDiv) typingDiv.remove();
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
    const messagesDiv = document.getElementById('chatMessages');
    setTimeout(() => {
        messagesDiv.scrollTo({
            top: messagesDiv.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

/**
 * 更新发送按钮状态
 */
function updateSendButton(disabled) {
    const btn = document.getElementById('sendBtn');
    if (disabled) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send-fill"></i><span class="d-none d-md-inline ms-1">发送</span>';
    }
}

/**
 * 键盘事件处理
 */
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

/**
 * 自动调整输入框高度
 */
document.addEventListener('input', function(e) {
    if (e.target.id === 'chatInput') {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
    }
});

/**
 * 检查AI服务状态
 */
async function checkAIStatus() {
    const dot = document.getElementById('aiStatusDot');
    const text = document.getElementById('aiStatusText');
    if (!dot || !text) return;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'ping' })
        });
        const data = await res.json();
        if (data.success) {
            dot.style.background = '#10b981';
            text.textContent = 'AI服务正常';
        } else {
            dot.style.background = '#f59e0b';
            text.textContent = '内置模式运行中';
        }
    } catch {
        dot.style.background = '#ef4444';
        text.textContent = '服务连接失败';
    }
}

/**
 * 清空对话
 */
function clearChat() {
    if (!confirm('确定要清空当前对话吗？')) return;
    chatHistory = [];
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = `
        <div class="chat-welcome">
            <div class="welcome-icon">
                <i class="bi bi-robot"></i>
            </div>
            <h3>对话已清空</h3>
            <p>开始新的提问吧！</p>
        </div>
    `;
}
