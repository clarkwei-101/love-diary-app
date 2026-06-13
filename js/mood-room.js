/**
 * 恋爱日记 - 情绪空间模块
 * 记录和分享情绪的小空间
 */

const MoodRoomModule = {
    STORAGE_KEY: 'mood_room_data',
    
    // 情绪类型
    MOODS: [
        { id: 'love', emoji: '💕', name: `${t('t_01d435')}`, color: '#FF6B9D' },
        { id: 'happy', emoji: '😊', name: '开心', color: '#FFD93D' },
        { id: 'sweet', emoji: '🥰', name: '甜蜜', color: '#FFB5C5' },
        { id: 'miss', emoji: '🥺', name: `${t('t_e5f3cc')}`, color: '#B4A7D6' },
        { id: 'sad', emoji: '😢', name: '难过', color: '#87CEEB' },
        { id: 'anxious', emoji: '😰', name: `${t('t_df6d77')}`, color: '#C0C0C0' },
        { id: 'angry', emoji: '😤', name: '生气', color: '#FF6B6B' },
        { id: 'tired', emoji: '😴', name: `${t('t_543e26')}`, color: '#DDA0DD' }
    ],
    
    // 获取数据
    getData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : { entries: [], moodStreak: 0 };
        } catch (e) {
            return { entries: [], moodStreak: 0 };
        }
    },
    
    // 保存数据
    saveData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },
    
    // 添加情绪记录
    addEntry(moodId, note = '') {
        const data = this.getData();
        const entry = {
            id: Date.now().toString(),
            mood: moodId,
            note: note,
            timestamp: new Date().toISOString()
        };
        data.entries.unshift(entry);
        
        // 保持最多100条记录
        if (data.entries.length > 100) {
            data.entries = data.entries.slice(0, 100);
        }
        
        this.saveData(data);
        return entry;
    },
    
    // 获取今日记录
    getTodayEntry() {
        const data = this.getData();
        const today = new Date().toDateString();
        return data.entries.find(e => new Date(e.timestamp).toDateString() === today);
    },
    
    // 获取本周记录
    getWeekEntries() {
        const data = this.getData();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return data.entries.filter(e => new Date(e.timestamp) >= weekAgo);
    },
    
    // 获取配对记录
    getPartnerEntries() {
        const data = this.getData();
        return data.entries.filter(e => e.sender === 'partner');
    }
};

// 渲染情绪空间页面
function renderMoodRoomPage() {
    const container = document.getElementById('mood-room-container');
    if (!container) return;
    
    const data = MoodRoomModule.getData();
    const todayEntry = MoodRoomModule.getTodayEntry();
    const weekEntries = MoodRoomModule.getWeekEntries();
    
    container.innerHTML = `
        <div class="mood-room-hero glass-card">
            <div class="mood-room-title">
                <h3>💝 情绪空间</h3>
                <p>记录每一刻的${t('t_ba89e6')}</p>
            </div>
            
            ${todayEntry ? `
                <div class="today-mood-display">
                    <span class="today-mood-emoji">${MoodRoomModule.MOODS.find(m => m.id === todayEntry.mood)?.emoji}</span>
                    <span class="today-mood-name">今天你：${MoodRoomModule.MOODS.find(m => m.id === todayEntry.mood)?.name}</span>
                </div>
            ` : `
                <p class="no-mood-today">今天还没记录心情~</p>
            `}
        </div>
        
        <div class="mood-selector-card glass-card">
            <h4>📝 现在的${t('t_ba89e6')}</h4>
            <div class="mood-selector-grid">
                ${MoodRoomModule.MOODS.map(mood => `
                    <div class="mood-selector-item ${todayEntry?.mood === mood.id ? 'selected' : ''}" 
                         data-mood="${mood.id}"
                         style="--mood-color: ${mood.color};"
                         onclick="selectMoodEntry('${mood.id}')">
                        <span class="mood-selector-emoji">${mood.emoji}</span>
                        <span class="mood-selector-name">${mood.name}</span>
                    </div>
                `).join('')}
            </div>
            <textarea id="mood-note-input" class="mood-note-input" placeholder="${t('t_5c3521')}...（${t('t_c20cba')}）" rows="2"></textarea>
            <button class="btn-primary" style="width:100%;margin-top:12px;" onclick="saveMoodEntry()">
                💕 记录${t('t_ba89e6')}
            </button>
        </div>
        
        <div class="mood-calendar-card glass-card">
            <h4>📅 本周${t('t_ba89e6')}</h4>
            <div class="week-mood-display">
                ${getWeekDays().map((day, i) => {
                    const dayEntry = weekEntries.find(e => {
                        const d = new Date(e.timestamp);
                        return d.toDateString() === day.toDateString();
                    });
                    const mood = dayEntry ? MoodRoomModule.MOODS.find(m => m.id === dayEntry.mood) : null;
                    const isToday = day.toDateString() === new Date().toDateString();
                    return `
                        <div class="week-day-item ${isToday ? 'today' : ''}">
                            <span class="week-day-name">${['日','一','二','三','四','五','六'][day.getDay()]}</span>
                            <span class="week-day-mood">${mood ? mood.emoji : '·'}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="mood-history-card glass-card">
            <h4>💭 ${t('t_ba89e6')}记录</h4>
            <div class="mood-history-list">
                ${data.entries.slice(0, 10).map(entry => {
                    const mood = MoodRoomModule.MOODS.find(m => m.id === entry.mood);
                    const date = new Date(entry.timestamp);
                    return `
                        <div class="mood-history-item">
                            <span class="history-mood-emoji" style="background:${mood?.color}20;">${mood?.emoji}</span>
                            <div class="history-content">
                                <span class="history-mood-name">${mood?.name}</span>
                                ${entry.note ? `<span class="history-note">${entry.note}</span>` : ''}
                                <span class="history-time">${date.toLocaleDateString('zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function getWeekDays() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        days.push(day);
    }
    return days;
}

let selectedMoodEntry = null;

function selectMoodEntry(moodId) {
    document.querySelectorAll('.mood-selector-item').forEach(el => {
        el.classList.remove('selected');
    });
    document.querySelector(`.mood-selector-item[data-mood="${moodId}"]`).classList.add('selected');
    selectedMoodEntry = moodId;
}

function saveMoodEntry() {
    if (!selectedMoodEntry) {
        showToast(`${t('t_62da58')}`, '⚠️');
        return;
    }
    
    const note = document.getElementById('mood-note-input')?.value.trim() || '';
    const entry = MoodRoomModule.addEntry(selectedMoodEntry, note);
    
    showToast(`${t('t_f79bb5')} 💕`, '✅');
    selectedMoodEntry = null;
    renderMoodRoomPage();
}

function initMoodRoomModule() {
    renderMoodRoomPage();
}

window.MoodRoomModule = MoodRoomModule;
window.initMoodRoomModule = initMoodRoomModule;
window.renderMoodRoomPage = renderMoodRoomPage;
window.selectMoodEntry = selectMoodEntry;
window.saveMoodEntry = saveMoodEntry;
