/**
 * 智学通 - 主JavaScript文件
 * 全局功能：提示自动消失、表单增强等
 */

document.addEventListener('DOMContentLoaded', function() {
    // 自动隐藏Flash消息（5秒后）
    const alerts = document.querySelectorAll('.custom-alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });

    // 为所有表单添加加载状态保护
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.setAttribute('data-original-text', originalText);
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>处理中...';
                // 3秒后恢复（防止卡住）
                setTimeout(() => {
                    if (submitBtn.disabled) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                }, 10000);
            }
        });
    });

    // 侧边栏当前页面高亮
    highlightCurrentNav();
});

/**
 * 高亮当前页面导航
 */
function highlightCurrentNav() {
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

/**
 * Toast通知
 */
function showToast(message, type = 'info') {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#6366f1'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        color: #1e293b;
        padding: 14px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        z-index: 9999;
        font-size: 0.95rem;
        border-left: 4px solid ${colors[type] || colors.info};
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-${type === 'success' ? 'check-circle-fill text-success' :
                             type === 'error' ? 'exclamation-triangle-fill text-danger' :
                             type === 'warning' ? 'exclamation-circle-fill text-warning' :
                             'info-circle-fill text-primary'} me-2"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 添加动画关键帧
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天 ' + d.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
    if (days === 1) return '昨天';
    if (days < 7) return days + '天前';
    return d.toLocaleDateString('zh-CN');
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * 简易Markdown转HTML（在不加载marked.js时的回退方案）
 */
function simpleMarkdown(text) {
    if (typeof marked !== 'undefined') {
        return marked.parse(text);
    }
    // 简单回退
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}
