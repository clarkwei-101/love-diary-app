/**
 * 恋爱日记 - 今日恋爱计划模块
 * 记录和管理每日计划，可设置提醒
 */

const DailyPlan = {
    STORAGE_KEY: 'daily_plans',
    NOTIFICATION_KEY: 'daily_plan_notifications',
    
    // 获取计划列表
    getPlans() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`${t('t_47c7ce')}:`, e);
            return [];
        }
    },
    
    // 保存计划列表
    savePlans(plans) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(plans));
    },
    
    // 添加计划
    addPlan(text, reminder = null) {
        const plans = this.getPlans();
        const today = new Date().toISOString().split('T')[0];
        
        const newPlan = {
            id: Date.now().toString(),
            text: text,
            date: today,
            completed: false,
            reminder: reminder,
            createdAt: new Date().toISOString()
        };
        
        plans.push(newPlan);
        this.savePlans(plans);
        
        // 如果设置了提醒，发送通知
        if (reminder) {
            this.scheduleReminder(newPlan);
        }
        
        return newPlan;
    },
    
    // 切换完成状态
    toggleComplete(planId) {
        const plans = this.getPlans();
        const plan = plans.find(p => p.id === planId);
        
        if (plan) {
            plan.completed = !plan.completed;
            plan.completedAt = plan.completed ? new Date().toISOString() : null;
            this.savePlans(plans);
        }
        
        return plan;
    },
    
    // 删除计划
    deletePlan(planId) {
        const plans = this.getPlans();
        const filtered = plans.filter(p => p.id !== planId);
        this.savePlans(filtered);
    },
    
    // 更新计划
    updatePlan(planId, updates) {
        const plans = this.getPlans();
        const plan = plans.find(p => p.id === planId);
        
        if (plan) {
            Object.assign(plan, updates);
            this.savePlans(plans);
        }
        
        return plan;
    },
    
    // 获取今日计划
    getTodayPlans() {
        const plans = this.getPlans();
        const today = new Date().toISOString().split('T')[0];
        return plans.filter(p => p.date === today);
    },
    
    // 获取未完成的今日计划
    getPendingTodayPlans() {
        return this.getTodayPlans().filter(p => !p.completed);
    },
    
    // 设置提醒
    scheduleReminder(plan) {
        if (!plan.reminder || !('Notification' in window)) return;
        
        const reminderTime = new Date(plan.reminder);
        const now = new Date();
        
        if (reminderTime <= now) return;
        
        const timeout = reminderTime.getTime() - now.getTime();
        
        // 保存提醒ID以便后续取消
        const notificationData = {
            planId: plan.id,
            timeoutId: setTimeout(() => {
                this.showNotification(plan);
            }, timeout)
        };
        
        const notifications = this.getNotificationData();
        notifications[plan.id] = notificationData;
        this.saveNotificationData(notifications);
    },
    
    // 显示通知
    showNotification(plan) {
        if (Notification.permission === 'granted') {
            new Notification(`💕 ${t('t_3deb1a')}`, {
                body: plan.text,
                icon: '📅',
                tag: plan.id
            });
        }
        
        showToast(`${t('t_4b027f')}: ${plan.text}`, '⏰');
    },
    
    // 请求通知权限
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log(`${t('t_df9c7b')}`);
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    },
    
    // 获取通知数据
    getNotificationData() {
        try {
            const data = localStorage.getItem(this.NOTIFICATION_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },
    
    // 保存通知数据
    saveNotificationData(data) {
        localStorage.setItem(this.NOTIFICATION_KEY, JSON.stringify(data));
    },
    
    // 取消提醒
    cancelReminder(planId) {
        const notifications = this.getNotificationData();
        const notification = notifications[planId];
        
        if (notification && notification.timeoutId) {
            clearTimeout(notification.timeoutId);
            delete notifications[planId];
            this.saveNotificationData(notifications);
        }
    },
    
    // 常用提醒时间
    reminderOptions: [
        { value: '09:00', label: `${t('t_c8c0ba')} 9:00` },
        { value: '12:00', label: `${t('t_259f54')} 12:00` },
        { value: '18:00', label: `${t('t_e2eb28')} 6:00` },
        { value: '20:00', label: `${t('t_a80cc5')} 8:00` },
        { value: '21:00', label: `${t('t_a80cc5')} 9:00` },
        { value: '22:00', label: `${t('t_a80cc5')} 10:00` }
    ]
};

// 初始化每日计划
function initDailyPlan() {
    renderTodayPlans();
    bindPlanEvents();
    
    // 检查权限
    DailyPlan.requestNotificationPermission();
}

function bindPlanEvents() {
    document.getElementById('btn-add-plan')?.addEventListener('click', showAddPlanModal);
    document.getElementById('plan-list')?.addEventListener('click', handlePlanClick);
}

function renderTodayPlans() {
    const container = document.getElementById('plan-list');
    if (!container) return;
    
    const plans = DailyPlan.getTodayPlans();
    
    if (plans.length === 0) {
        container.innerHTML = `
            <div class="plan-empty">
                <span style="font-size:48px;">📝</span>
                <p>今天还没有计划</p>
                <p style="font-size:12px;color:var(--text-light);">添加${t('t_8b9a14')}甜蜜的计划吧~</p>
            </div>
        `;
        return;
    }
    
    // 按完成状态和创建时间排序
    plans.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
    });
    
    container.innerHTML = plans.map(plan => `
        <div class="plan-item ${plan.completed ? 'completed' : ''}" data-plan-id="${plan.id}">
            <div class="plan-checkbox ${plan.completed ? 'checked' : ''}" onclick="togglePlanComplete('${plan.id}')"></div>
            <div class="plan-text">${escapeHtml(plan.text)}</div>
            <div class="plan-meta">
                ${plan.reminder ? `<span class="plan-time">${formatReminderTime(plan.reminder)}</span>` : ''}
                <span class="plan-reminder" onclick="showReminderPanel('${plan.id}')">⏰</span>
                <span class="plan-delete" onclick="deletePlan('${plan.id}')">🗑️</span>
            </div>
        </div>
    `).join('');
}

function showAddPlanModal() {
    let html = `
        <div class="modal-overlay" onclick="closeAddPlanModal()"></div>
        <div class="modal-content" style="max-width:340px;padding:24px;">
            <button class="modal-close" onclick="closeAddPlanModal()">&times;</button>
            <h4 style="margin-bottom:16px;">✨ 添加${t('t_296304')}计划</h4>
            
            <input type="text" id="plan-input" class="setting-input" 
                   placeholder="${t('t_8e1389')}..." style="width:100%;margin-bottom:16px;">
            
            <div class="reminder-options">
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">设置${t('t_4b027f')}（${t('t_c20cba')}）</p>
                ${DailyPlan.reminderOptions.map(opt => `
                    <div class="reminder-option" data-reminder="${opt.value}" onclick="selectReminderOption(this)">
                        ${opt.label}
                    </div>
                `).join('')}
            </div>
            
            <button class="btn-primary" style="width:100%;margin-top:16px;" onclick="addPlanFromModal()">
                添加计划
            </button>
        </div>
    `;
    
    // 移除已存在的模态框
    const existingModal = document.getElementById('add-plan-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'add-plan-modal';
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    modal.classList.remove('hidden');
    
    // 回车键提交
    document.getElementById('plan-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPlanFromModal();
        }
    });
}

function closeAddPlanModal() {
    const modal = document.getElementById('add-plan-modal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

let selectedReminder = null;

function selectReminderOption(el) {
    document.querySelectorAll('.reminder-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    el.classList.add('selected');
    selectedReminder = el.dataset.reminder;
}

function addPlanFromModal() {
    const input = document.getElementById('plan-input');
    const text = input?.value.trim();
    
    if (!text) {
        showToast(`${t('t_4e16e9')}`, '⚠️');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const reminder = selectedReminder ? `${today}T${selectedReminder}:00` : null;
    
    DailyPlan.addPlan(text, reminder);
    closeAddPlanModal();
    renderTodayPlans();
    
    selectedReminder = null;
    showToast(`${t('t_7861c3')} 💕`, '✅');
}

function togglePlanComplete(planId) {
    DailyPlan.toggleComplete(planId);
    renderTodayPlans();
}

function deletePlan(planId) {
    DailyPlan.cancelReminder(planId);
    DailyPlan.deletePlan(planId);
    renderTodayPlans();
    showToast(`${t('t_09a4d0')}`, '🗑️');
}

function showReminderPanel(planId) {
    const plans = DailyPlan.getPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    let html = `
        <div class="modal-overlay" onclick="closeReminderPanel()"></div>
        <div class="reminder-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h4>设置${t('t_4b027f')}时间</h4>
                ${plan.reminder ? '<button class="btn-text" onclick="clearReminder(\'' + planId + `\')" style="color:var(--error-color);">${t('t_9a2604')}</button>` : ''}
            </div>
            
            <div class="reminder-options">
                ${DailyPlan.reminderOptions.map(opt => `
                    <div class="reminder-option ${plan.reminder?.includes(opt.value) ? 'selected' : ''}" 
                         data-reminder="${opt.value}" onclick="setReminder('${planId}', this)">
                        ${opt.label}
                    </div>
                `).join('')}
            </div>
            
            <button class="btn-primary" style="width:100%;margin-top:16px;" onclick="closeReminderPanel()">
                关闭
            </button>
        </div>
    `;
    
    const existingModal = document.getElementById('reminder-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'reminder-modal';
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    modal.classList.remove('hidden');
}

function closeReminderPanel() {
    const modal = document.getElementById('reminder-modal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

function setReminder(planId, el) {
    document.querySelectorAll('#reminder-modal .reminder-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    el.classList.add('selected');
    
    const reminderTime = el.dataset.reminder;
    const today = new Date().toISOString().split('T')[0];
    const reminder = `${today}T${reminderTime}:00`;
    
    DailyPlan.updatePlan(planId, { reminder: reminder });
    DailyPlan.scheduleReminder(DailyPlan.getPlans().find(p => p.id === planId));
    
    closeReminderPanel();
    renderTodayPlans();
    showToast(`${t('t_9c8b96')}`, '⏰');
}

function clearReminder(planId) {
    DailyPlan.cancelReminder(planId);
    DailyPlan.updatePlan(planId, { reminder: null });
    closeReminderPanel();
    renderTodayPlans();
    showToast(`${t('t_cc4537')}`, '✅');
}

function handlePlanClick(e) {
    // 事件处理
}

function formatReminderTime(reminder) {
    if (!reminder) return '';
    const time = reminder.split('T')[1];
    return time.substring(0, 5);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 导出
window.DailyPlan = DailyPlan;
window.initDailyPlan = initDailyPlan;
window.showAddPlanModal = showAddPlanModal;
window.closeAddPlanModal = closeAddPlanModal;
window.togglePlanComplete = togglePlanComplete;
window.deletePlan = deletePlan;
window.showReminderPanel = showReminderPanel;
window.closeReminderPanel = closeReminderPanel;
window.setReminder = setReminder;
window.clearReminder = clearReminder;
