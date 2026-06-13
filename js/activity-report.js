/**
 * 恋爱日记 - 每日行为报告模块
 * 记录了解对象一天的活动情况
 */

const ActivityReport = {
    STORAGE_KEY: 'activity_reports',
    CATEGORIES: [
        { icon: '🍽️', name: `${t('t_2a0ad6')}`, tags: [`${t('t_edb336')}`, `${t('t_3cc4b7')}`, `${t('t_96a6ae')}`, `${t('t_64f5a6')}`, `${t('t_d0f746')}`] },
        { icon: '💼', name: `${t('t_9a018b')}`, tags: [`${t('t_b4f038')}`, `${t('t_43f7ed')}`, `${t('t_b64a21')}`, `${t('t_4ef520')}`, `${t('t_415451')}`] },
        { icon: '🏃', name: `${t('t_37b6de')}`, tags: [`${t('t_7b385d')}`, `${t('t_c24d6f')}`, `${t('t_5a7843')}`, `${t('t_e4bdce')}`, `${t('t_aa23db')}`] },
        { icon: '🎬', name: `${t('t_9acf9c')}`, tags: [`${t('t_2d41be')}`, `${t('t_5b23de')}`, `${t('t_0b6221')}`, `${t('t_c69e29')}`, `${t('t_11a12c')}`] },
        { icon: '🛒', name: `${t('t_32c3a8')}`, tags: [`${t('t_f3e7af')}`, `${t('t_faeff5')}`, `${t('t_77256a')}`, `${t('t_a26614')}`] },
        { icon: '👨‍👩‍👧', name: `${t('t_8b8588')}`, tags: [`${t('t_d8944f')}`, `${t('t_1ff962')}`, `${t('t_5a93d3')}`, `${t('t_7fcf42')}`, `${t('t_622b43')}`] },
        { icon: '😴', name: `${t('t_3a991a')}`, tags: [`${t('t_60cffc')}`, `${t('t_00e281')}`, `${t('t_642969')}`, `${t('t_4baafe')}`] },
        { icon: '💊', name: `${t('t_fbc026')}`, tags: [`${t('t_2d5afc')}`, `${t('t_258fc5')}`, `${t('t_812e3c')}`, `${t('t_ec4ddf')}`] }
    ],
    
    // 获取报告列表
    getReports() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },
    
    // 保存报告
    saveReports(reports) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
    },
    
    // 添加活动记录
    addActivity(date, activity, category) {
        const reports = this.getReports();
        const dateKey = date || new Date().toISOString().split('T')[0];
        
        if (!reports[dateKey]) {
            reports[dateKey] = [];
        }
        
        reports[dateKey].push({
            id: Date.now().toString(),
            activity: activity,
            category: category,
            timestamp: new Date().toISOString()
        });
        
        this.saveReports(reports);
        return reports[dateKey];
    },
    
    // 获取某日活动
    getActivities(date) {
        const reports = this.getReports();
        const dateKey = date || new Date().toISOString().split('T')[0];
        return reports[dateKey] || [];
    },
    
    // 删除活动
    deleteActivity(date, activityId) {
        const reports = this.getReports();
        const dateKey = date || new Date().toISOString().split('T')[0];
        
        if (reports[dateKey]) {
            reports[dateKey] = reports[dateKey].filter(a => a.id !== activityId);
            this.saveReports(reports);
        }
    },
    
    // 获取活动分类
    getCategoryInfo(categoryName) {
        return this.CATEGORIES.find(c => c.name === categoryName);
    }
};

// 初始化活动报告
function initActivityReport() {
    renderActivityForm();
    renderTodayActivities();
    bindActivityEvents();
}

function renderActivityForm() {
    const container = document.getElementById('activity-categories');
    if (!container) return;
    
    container.innerHTML = ActivityReport.CATEGORIES.map(cat => `
        <div class="activity-category-section">
            <div class="activity-category-header" onclick="toggleCategory('${cat.name}')">
                <span class="activity-category-icon">${cat.icon}</span>
                <span class="activity-category-name">${cat.name}</span>
                <span class="activity-category-toggle">▼</span>
            </div>
            <div class="activity-tags" id="tags-${cat.name}">
                ${cat.tags.map(tag => `
                    <span class="activity-tag" onclick="addActivityFromTag('${cat.name}', '${tag}')">${tag}</span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function toggleCategory(name) {
    const tags = document.getElementById(`tags-${name}`);
    if (tags) {
        tags.classList.toggle('collapsed');
    }
}

function addActivityFromTag(category, tag) {
    ActivityReport.addActivity(null, tag, category);
    renderTodayActivities();
    showToast(`${t('t_e024d0')}: ${tag}`, '✅');
}

function renderTodayActivities() {
    const container = document.getElementById('activity-list');
    if (!container) return;
    
    const activities = ActivityReport.getActivities();
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>还没有记录今天的活动</p>
                <p style="font-size:12px;color:var(--text-light);">点击上方标签快速记录</p>
            </div>
        `;
        return;
    }
    
    // 按时间排序
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = activities.map(act => {
        const cat = ActivityReport.getCategoryInfo(act.category);
        const icon = cat?.icon || '📝';
        const time = new Date(act.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="activity-item" onclick="showActivityDetail('${act.id}')">
                <span class="activity-item-icon">${icon}</span>
                <div class="activity-item-content">
                    <span class="activity-item-time">${time}</span>
                    <span class="activity-item-text">${escapeHtml(act.activity)}</span>
                </div>
                <button class="btn-text" onclick="event.stopPropagation();deleteActivity('${act.id}')">🗑️</button>
            </div>
        `;
    }).join('');
}

function addCustomActivity() {
    const input = document.getElementById('activity-custom-input');
    const text = input?.value.trim();
    
    if (!text) {
        showToast(`${t('t_0f7fab')}`, '⚠️');
        return;
    }
    
    ActivityReport.addActivity(null, text, `${t('t_0d98c7')}`);
    input.value = '';
    renderTodayActivities();
    showToast(`${t('t_e024d0')} 💕`, '✅');
}

function deleteActivity(activityId) {
    ActivityReport.deleteActivity(null, activityId);
    renderTodayActivities();
    showToast(`已${t('t_2f4aad')}`, '🗑️');
}

function showActivityDetail(activityId) {
    // 可以扩展为详情页
}

function bindActivityEvents() {
    document.getElementById('btn-add-activity')?.addEventListener('click', addCustomActivity);
    document.getElementById('activity-custom-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addCustomActivity();
    });
}

// 导出
window.ActivityReport = ActivityReport;
window.initActivityReport = initActivityReport;
window.addActivityFromTag = addActivityFromTag;
window.toggleCategory = toggleCategory;
window.deleteActivity = deleteActivity;
