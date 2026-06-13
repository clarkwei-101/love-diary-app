/**
 * 恋爱日记 - 情侣任务模块
 * 一起完成任务增加亲密度
 */

const CoupleTaskModule = {
    STORAGE_KEY: 'couple_tasks',
    
    // 任务分类
    CATEGORIES: [
        { id: 'daily', name: `${t('t_e954ec')}`, icon: '📅', tasks: [
            { id: 'chat', name: `${t('t_4d41eb')}`, reward: 10 },
            { id: 'mood', name: `${t('t_630ec3')}`, reward: 10 },
            { id: 'plan', name: `${t('t_a2fc23')}`, reward: 10 },
            { id: 'exercise', name: `${t('t_29c41d')}`, reward: 15 },
            { id: 'water', name: `${t('t_1da2d9')}`, reward: 5 }
        ]},
        { id: 'weekly', name: `${t('t_8d5d0a')}`, icon: '📆', tasks: [
            { id: 'date', name: `${t('t_cf04db')}`, reward: 50 },
            { id: 'photo', name: `${t('t_377307')}`, reward: 30 },
            { id: 'review', name: `${t('t_8da910')}`, reward: 40 }
        ]},
        { id: 'special', name: `${t('t_67cf02')}`, icon: '⭐', tasks: [
            { id: 'anniversary', name: `${t('t_9c9c5e')}`, reward: 100 },
            { id: 'travel', name: `${t('t_377e77')}`, reward: 80 },
            { id: 'gift', name: `${t('t_995441')}`, reward: 60 }
        ]}
    ],
    
    // 获取数据
    getData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : this.getDefaultData();
        } catch (e) {
            return this.getDefaultData();
        }
    },
    
    // 默认数据
    getDefaultData() {
        return {
            intimacy: 0,
            level: 1,
            completedTasks: [],
            lastDailyReset: null
        };
    },
    
    // 保存数据
    saveData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },
    
    // 检查是否完成任务
    isTaskCompleted(taskId) {
        const data = this.getData();
        return data.completedTasks.includes(taskId);
    },
    
    // 完成任务
    completeTask(taskId, reward) {
        const data = this.getData();
        if (this.isTaskCompleted(taskId)) {
            return false;
        }
        
        data.completedTasks.push(taskId);
        data.intimacy += reward;
        
        // 检查升级
        const newLevel = Math.floor(data.intimacy / 500) + 1;
        const leveledUp = newLevel > data.level;
        data.level = newLevel;
        
        this.saveData(data);
        return { success: true, leveledUp, newLevel };
    },
    
    // 重置每日任务
    resetDailyTasks() {
        const data = this.getData();
        const today = new Date().toDateString();
        
        if (data.lastDailyReset !== today) {
            data.completedTasks = data.completedTasks.filter(taskId => {
                const cat = this.CATEGORIES.find(c => 
                    c.tasks.find(t => t.id === taskId)
                );
                return cat?.id !== 'daily';
            });
            data.lastDailyReset = today;
            this.saveData(data);
        }
    },
    
    // 获取亲密度等级
    getIntimacyLevel(intimacy) {
        const levels = [
            { min: 0, name: `${t('t_448134')}`, emoji: '👤' },
            { min: 100, name: `${t('t_dd9e1d')}`, emoji: '🤝' },
            { min: 500, name: `${t('t_4c0229')}`, emoji: '😊' },
            { min: 1000, name: `${t('t_6e8ebb')}`, emoji: '😳' },
            { min: 2000, name: `${t('t_a5ca70')}`, emoji: '😍' },
            { min: 5000, name: `${t('t_ec5e66')}`, emoji: '💑' },
            { min: 10000, name: `${t('t_14fa52')}`, emoji: '💕' }
        ];
        
        for (let i = levels.length - 1; i >= 0; i--) {
            if (intimacy >= levels[i].min) {
                return levels[i];
            }
        }
        return levels[0];
    }
};

// 渲染情侣任务页面
function renderCoupleTaskPage() {
    const container = document.getElementById('couple-task-container');
    if (!container) return;
    
    const data = CoupleTaskModule.getData();
    CoupleTaskModule.resetDailyTasks();
    const levelInfo = CoupleTaskModule.getIntimacyLevel(data.intimacy);
    
    container.innerHTML = `
        <div class="task-intimacy-card glass-card">
            <div class="intimacy-header">
                <span class="intimacy-emoji">${levelInfo.emoji}</span>
                <div class="intimacy-info">
                    <h3>${levelInfo.name}</h3>
                    <p>亲密度: ${data.intimacy}</p>
                </div>
                <div class="intimacy-level">
                    Lv.${data.level}
                </div>
            </div>
            <div class="intimacy-progress">
                <div class="intimacy-bar">
                    <div class="intimacy-fill" style="width: ${(data.intimacy % 500) / 5}%"></div>
                </div>
                <span class="intimacy-next">距离下一级还需 ${500 - (data.intimacy % 500)}</span>
            </div>
        </div>
        
        ${CoupleTaskModule.CATEGORIES.map(cat => `
            <div class="task-category-card glass-card">
                <div class="task-category-header">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-name">${cat.name}</span>
                </div>
                <div class="task-list">
                    ${cat.tasks.map(task => {
                        const completed = CoupleTaskModule.isTaskCompleted(task.id);
                        return `
                            <div class="task-item ${completed ? 'completed' : ''}" onclick="${completed ? '' : `completeTask('${task.id}', ${task.reward})`}">
                                <div class="task-info">
                                    <span class="task-name">${task.name}</span>
                                    <span class="task-reward">+${task.reward} 💕</span>
                                </div>
                                <div class="task-status">
                                    ${completed ? '<span class="completed-badge">✓</span>' : `<span class="do-badge">${t('t_c15dcf')}</span>`}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('')}
        
        <div class="task-tips glass-card">
            <h4>💡 小贴士</h4>
            <ul>
                <li>${t('t_e954ec')}${t('t_78623e')}重置，记得来完成哦~</li>
                <li>完成任务可以${t('t_02574c')}亲密度，亲密度越高等级越高</li>
                <li>和TA${t('t_3efffd')}完成任务更有意义！</li>
            </ul>
        </div>
    `;
}

function completeTask(taskId, reward) {
    const result = CoupleTaskModule.completeTask(taskId, reward);
    if (result.success) {
        if (result.leveledUp) {
            showToast(`${t('t_ff845e')}+${reward}！${t('t_3e98aa')}Lv.${result.newLevel}！🎉`, '🎊');
        } else {
            showToast(`${t('t_ff845e')}+${reward} 💕`, '✅');
        }
        renderCoupleTaskPage();
    }
}

function initCoupleTaskModule() {
    renderCoupleTaskPage();
}

window.CoupleTaskModule = CoupleTaskModule;
window.initCoupleTaskModule = initCoupleTaskModule;
window.renderCoupleTaskPage = renderCoupleTaskPage;
window.completeTask = completeTask;
