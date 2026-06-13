/**
 * 恋爱日记 - 隔空互动模块
 * 心跳感应、隔空Kiss等浪漫功能
 */

const KissModule = {
    HEARTBEAT_KEY: 'heartbeat_data',
    KISS_KEY: 'kiss_data',
    
    // 获取心跳数据
    getHeartbeat() {
        try {
            const data = localStorage.getItem(this.HEARTBEAT_KEY);
            return data ? JSON.parse(data) : { beats: [], lastSync: null };
        } catch (e) {
            return { beats: [], lastSync: null };
        }
    },
    
    // 保存心跳数据
    saveHeartbeat(data) {
        localStorage.setItem(this.HEARTBEAT_KEY, JSON.stringify(data));
    },
    
    // 获取Kiss数据
    getKisses() {
        try {
            const data = localStorage.getItem(this.KISS_KEY);
            return data ? JSON.parse(data) : { kisses: [], sentToday: 0, receivedToday: 0, lastDate: null };
        } catch (e) {
            return { kisses: [], sentToday: 0, receivedToday: 0, lastDate: null };
        }
    },
    
    // 保存Kiss数据
    saveKisses(data) {
        localStorage.setItem(this.KISS_KEY, JSON.stringify(data));
    },
    
    // 发送Kiss
    sendKiss() {
        const data = this.getKisses();
        const today = new Date().toDateString();
        
        // 重置每日计数
        if (data.lastDate !== today) {
            data.sentToday = 0;
            data.receivedToday = 0;
            data.lastDate = today;
        }
        
        if (data.sentToday >= 10) {
            return { success: false, message: `${t('t_296304')}Kiss${t('t_665e4e')}~` };
        }
        
        const kiss = {
            id: Date.now().toString(),
            type: Math.random() > 0.5 ? 'kiss' : 'heart',
            timestamp: new Date().toISOString(),
            sender: 'me'
        };
        
        data.kisses.unshift(kiss);
        data.sentToday++;
        this.saveKisses(data);
        
        return { success: true, kiss };
    },
    
    // 模拟收到Kiss（本地模式）
    simulateReceiveKiss() {
        const data = this.getKisses();
        const today = new Date().toDateString();
        
        if (data.lastDate !== today) {
            data.sentToday = 0;
            data.receivedToday = 0;
            data.lastDate = today;
        }
        
        const kiss = {
            id: Date.now().toString(),
            type: Math.random() > 0.5 ? 'kiss' : 'heart',
            timestamp: new Date().toISOString(),
            sender: 'partner'
        };
        
        data.kisses.unshift(kiss);
        data.receivedToday++;
        this.saveKisses(data);
        
        return kiss;
    },
    
    // 记录心跳
    recordHeartbeat(bpm) {
        const data = this.getHeartbeat();
        const beat = {
            bpm: bpm,
            timestamp: new Date().toISOString()
        };
        data.beats.push(beat);
        
        // 保持最近100条
        if (data.beats.length > 100) {
            data.beats = data.beats.slice(-100);
        }
        
        this.saveHeartbeat(data);
        return beat;
    },
    
    // 获取平均心率
    getAverageHeartbeat() {
        const data = this.getHeartbeat();
        if (data.beats.length === 0) return null;
        
        const sum = data.beats.reduce((acc, b) => acc + b.bpm, 0);
        return Math.round(sum / data.beats.length);
    }
};

// 渲染隔空互动页面
function renderKissPage() {
    const container = document.getElementById('kiss-container');
    if (!container) return;
    
    const kissData = KissModule.getKisses();
    const hbData = KissModule.getHeartbeat();
    const avgHb = KissModule.getAverageHeartbeat();
    const today = new Date().toDateString();
    
    // 重置每日计数
    if (kissData.lastDate !== today) {
        kissData.sentToday = 0;
        kissData.receivedToday = 0;
        kissData.lastDate = today;
        KissModule.saveKisses(kissData);
    }
    
    container.innerHTML = `
        <div class="kiss-hero glass-card">
            <div class="kiss-title">
                <h3>💋 隔空互动</h3>
                <p>给TA发送${t('t_8b9a14')}Kiss或心跳~</p>
            </div>
            
            <div class="kiss-counter">
                <div class="counter-item sent">
                    <span class="counter-value">${kissData.sentToday}</span>
                    <span class="counter-label">已发送</span>
                </div>
                <div class="counter-item received">
                    <span class="counter-value">${kissData.receivedToday}</span>
                    <span class="counter-label">${t('t_26922a')}</span>
                </div>
            </div>
        </div>
        
        <div class="kiss-send-card glass-card">
            <h4>📨 发送</h4>
            <div class="kiss-buttons">
                <button class="kiss-btn kiss" onclick="sendKissAction()">
                    <span class="kiss-emoji">💋</span>
                    <span>发送${t('t_931627')}</span>
                </button>
                <button class="kiss-btn heart" onclick="sendHeartAction()">
                    <span class="kiss-emoji">❤️</span>
                    <span>发送${t('t_5a2e57')}</span>
                </button>
            </div>
            <p class="kiss-hint">${t('t_296304')}剩余 ${10 - kissData.sentToday} 次</p>
        </div>
        
        <div class="heartbeat-card glass-card">
            <h4>💓 心跳感应</h4>
            <div class="heartbeat-display">
                <div class="heartbeat-icon ${avgHb ? 'pulse' : ''}">💗</div>
                <div class="heartbeat-info">
                    ${avgHb ? `
                        <span class="heartbeat-value">${avgHb}</span>
                        <span class="heartbeat-unit">BPM</span>
                        <span class="heartbeat-label">平均心率</span>
                    ` : `
                        <span class="heartbeat-value">--</span>
                        <span class="heartbeat-unit">BPM</span>
                        <span class="heartbeat-label">点击记录你的心跳</span>
                    `}
                </div>
            </div>
            <div class="heartbeat-input">
                <input type="number" id="heartbeat-input" placeholder="${t('t_81b47c')}(60-120)" min="60" max="200">
                <button class="btn-small" onclick="recordHeartbeatAction()">记录</button>
            </div>
        </div>
        
        <div class="kiss-history-card glass-card">
            <h4>💌 互动记录</h4>
            <div class="kiss-history-list">
                ${kissData.kisses.slice(0, 20).map(kiss => `
                    <div class="kiss-history-item ${kiss.sender === 'partner' ? 'received' : 'sent'}">
                        <span class="kiss-history-emoji">${kiss.type === 'kiss' ? '💋' : '❤️'}</span>
                        <div class="kiss-history-info">
                            <span class="kiss-history-text">${kiss.sender === 'me' ? `${t('t_b36a0f')}` : `TA${t('t_e8ca78')}`} ${kiss.type === 'kiss' ? `${t('t_931627')}` : `${t('t_5a2e57')}`}</span>
                            <span class="kiss-history-time">${formatTimeAgo(kiss.timestamp)}</span>
                        </div>
                    </div>
                `).join('')}
                ${kissData.kisses.length === 0 ? `<p class="empty-hint">${t('t_acd7b6')}~</p>` : ''}
            </div>
        </div>
    `;
}

function sendKissAction() {
    const result = KissModule.sendKiss();
    if (result.success) {
        showKissAnimation(result.kiss.type);
        showToast(`${t('t_44679a')}！💋`, '💋');
        
        // 模拟对方收到
        setTimeout(() => {
            const received = KissModule.simulateReceiveKiss();
            showToast(`${t('t_26922a')}TA的${received.type === 'kiss' ? `${t('t_931627')}` : `${t('t_5a2e57')}`}！${received.type === 'kiss' ? '💋' : '❤️'}`, '💕');
        }, 2000 + Math.random() * 3000);
        
        renderKissPage();
    } else {
        showToast(result.message, '⚠️');
    }
}

function sendHeartAction() {
    const kiss = { id: Date.now().toString(), type: 'heart', timestamp: new Date().toISOString(), sender: 'me' };
    const data = KissModule.getKisses();
    const today = new Date().toDateString();
    
    if (data.lastDate !== today) {
        data.sentToday = 0;
        data.receivedToday = 0;
        data.lastDate = today;
    }
    
    if (data.sentToday >= 10) {
        showToast(`${t('t_9cb047')}~`, '⚠️');
        return;
    }
    
    data.kisses.unshift(kiss);
    data.sentToday++;
    KissModule.saveKisses(data);
    
    showKissAnimation('heart');
    showToast(`${t('t_f052bb')}！❤️`, '❤️');
    
    setTimeout(() => {
        const received = KissModule.simulateReceiveKiss();
        showToast(`${t('t_26922a')}TA的${received.type === 'kiss' ? `${t('t_931627')}` : `${t('t_5a2e57')}`}！💕`, '💕');
    }, 2000 + Math.random() * 3000);
    
    renderKissPage();
}

function showKissAnimation(type) {
    const emoji = type === 'kiss' ? '💋' : '❤️';
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            createFloatingEmoji(emoji);
        }, i * 200);
    }
}

function createFloatingEmoji(emoji) {
    const container = document.getElementById('floating-emoji-container') || createFloatingContainer();
    const el = document.createElement('div');
    el.className = 'floating-emoji-anim';
    el.textContent = emoji;
    el.style.left = Math.random() * 80 + 10 + '%';
    el.style.top = Math.random() * 60 + 20 + '%';
    container.appendChild(el);
    
    setTimeout(() => el.remove(), 2000);
}

function createFloatingContainer() {
    const container = document.createElement('div');
    container.id = 'floating-emoji-container';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(container);
    return container;
}

function recordHeartbeatAction() {
    const input = document.getElementById('heartbeat-input');
    const bpm = parseInt(input?.value);
    
    if (!bpm || bpm < 40 || bpm > 220) {
        showToast(`${t('t_aa4541')}(40-220)`, '⚠️');
        return;
    }
    
    KissModule.recordHeartbeat(bpm);
    input.value = '';
    renderKissPage();
    showToast(`${t('t_93a618')} ${bpm} BPM 💓`, '✅');
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return `${t('t_4181f7')}`;
    if (minutes < 60) return `${minutes}${t('t_2e3a36')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}${t('t_bb39a0')}`;
    return `${Math.floor(hours / 24)}${t('t_c66159')}`;
}

function initKissModule() {
    renderKissPage();
}

window.KissModule = KissModule;
window.initKissModule = initKissModule;
window.renderKissPage = renderKissPage;
window.sendKissAction = sendKissAction;
window.sendHeartAction = sendHeartAction;
window.recordHeartbeatAction = recordHeartbeatAction;
