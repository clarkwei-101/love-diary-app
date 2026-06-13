/**
 * 恋爱日记 - 双人心情日历模块
 * 记录双方每日心情变化
 */

const CoupleCalendar = {
    STORAGE_KEY: 'couple_moods',
    
    // 获取心情数据
    getMoods() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error(`${t('t_e84e87')}:`, e);
            return {};
        }
    },
    
    // 保存心情数据
    saveMoods(moods) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(moods));
    },
    
    // 设置某天的心情
    setMood(date, mood, user = 'me') {
        const moods = this.getMoods();
        const dateKey = this.formatDateKey(date);
        
        if (!moods[dateKey]) {
            moods[dateKey] = {};
        }
        
        moods[dateKey][user] = {
            mood: mood,
            timestamp: new Date().toISOString()
        };
        
        this.saveMoods(moods);
        return moods[dateKey];
    },
    
    // 获取某天的心情
    getMood(date) {
        const moods = this.getMoods();
        const dateKey = this.formatDateKey(date);
        return moods[dateKey] || null;
    },
    
    // 格式化日期为键
    formatDateKey(date) {
        if (typeof date === 'string') {
            return date;
        }
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    
    // 获取某月的心情数据
    getMonthMoods(year, month) {
        const moods = this.getMoods();
        const result = {};
        
        for (const [dateKey, moodData] of Object.entries(moods)) {
            if (dateKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
                result[dateKey] = moodData;
            }
        }
        
        return result;
    },
    
    // 心情表情列表
    moods: [
        { value: 1, emoji: '😢', text: '难过' },
        { value: 2, emoji: '😡', text: '生气' },
        { value: 3, emoji: '😴', text: '困倦' },
        { value: 4, emoji: '🥰', text: '甜蜜' },
        { value: 5, emoji: '😐', text: '平静' },
        { value: 6, emoji: '🤔', text: '思考' },
        { value: 7, emoji: '😊', text: '开心' }
    ],
    
    // 获取心情文字
    getMoodText(mood) {
        const found = this.moods.find(m => m.value === mood);
        return found ? found.emoji + ' ' + found.text : '';
    },
    
    // 获取心情emoji
    getMoodEmoji(mood) {
        const found = this.moods.find(m => m.value === mood);
        return found ? found.emoji : '❓';
    }
};

// 初始化日历
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();

function initCoupleCalendar() {
    renderCalendar(currentCalendarYear, currentCalendarMonth);
    bindCalendarEvents();
}

function bindCalendarEvents() {
    document.getElementById('calendar-prev')?.addEventListener('click', () => {
        currentCalendarMonth--;
        if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear--;
        }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    document.getElementById('calendar-next')?.addEventListener('click', () => {
        currentCalendarMonth++;
        if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear++;
        }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    document.getElementById('calendar-today')?.addEventListener('click', () => {
        currentCalendarYear = new Date().getFullYear();
        currentCalendarMonth = new Date().getMonth();
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
}

function renderCalendar(year, month) {
    const monthNames = [`${t('t_43bc30')}`, `${t('t_b61c62')}`, `${t('t_eade91')}`, `${t('t_5178fd')}`, `${t('t_cd474e')}`, `${t('t_dc71b7')}`, 
                        `${t('t_328dce')}`, `${t('t_b72639')}`, `${t('t_cd9559')}`, `${t('t_ade2e8')}`, `${t('t_4e04f1')}`, `${t('t_5c2813')}`];
    
    // 更新月份标题
    const monthDisplay = document.getElementById('calendar-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = `${year}年 ${monthNames[month]}`;
    }
    
    const container = document.getElementById('calendar-days-grid');
    if (!container) return;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const today = new Date();
    const todayKey = CoupleCalendar.formatDateKey(today);
    
    // 获取当月所有心情数据
    const monthMoods = CoupleCalendar.getMonthMoods(year, month);
    
    let html = '';
    
    // 上月空白
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        html += `<div class="calendar-day other-month"><span>${day}</span></div>`;
    }
    
    // 当月日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const moodData = monthMoods[dateKey];
        const isToday = dateKey === todayKey;
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (moodData) classes += ' has-mood';
        
        let moodContent = '';
        if (moodData) {
            const meMood = moodData.me?.mood;
            const partnerMood = moodData.partner?.mood;
            
            if (meMood) {
                moodContent += `<span class="day-mood">${CoupleCalendar.getMoodEmoji(meMood)}</span>`;
            }
        }
        
        html += `
            <div class="${classes}" data-date="${dateKey}" onclick="showMoodEntry('${dateKey}')">
                <span>${day}</span>
                ${moodContent}
            </div>
        `;
    }
    
    // 下月空白
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        html += `<div class="calendar-day other-month"><span>${i}</span></div>`;
    }
    
    container.innerHTML = html;
}

function showMoodEntry(dateKey) {
    const moodData = CoupleCalendar.getMood(dateKey);
    const currentMood = moodData?.me?.mood || null;
    
    let html = `
        <div class="modal-overlay" onclick="closeMoodEntry()"></div>
        <div class="modal-content mood-entry-modal" style="max-width:320px;">
            <button class="modal-close" onclick="closeMoodEntry()">&times;</button>
            <h4 style="margin-bottom:8px;">📅 ${dateKey}</h4>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">记录今天的${t('t_ba89e6')}</p>
            
            <div class="mood-selector large">
                ${CoupleCalendar.moods.map(m => `
                    <div class="mood-option ${currentMood === m.value ? 'selected' : ''}" 
                         data-mood="${m.value}" 
                         onclick="selectMood('${dateKey}', ${m.value})">
                        ${m.emoji}
                    </div>
                `).join('')}
            </div>
            
            <p class="mood-text" id="mood-entry-text" style="text-align:center;margin-top:12px;">
                ${currentMood ? CoupleCalendar.getMoodText(currentMood) : `${t('t_f64466')}`}
            </p>
            
            <button class="btn-primary" style="width:100%;margin-top:16px;" onclick="closeMoodEntry()">
                保存
            </button>
        </div>
    `;
    
    // 移除已存在的模态框
    const existingModal = document.getElementById('mood-entry-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'mood-entry-modal';
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    modal.classList.remove('hidden');
}

function selectMood(dateKey, mood) {
    document.querySelectorAll('#mood-entry-modal .mood-option').forEach(el => {
        el.classList.remove('selected');
    });
    document.querySelector(`#mood-entry-modal .mood-option[data-mood="${mood}"]`).classList.add('selected');
    document.getElementById('mood-entry-text').textContent = CoupleCalendar.getMoodText(mood);
    
    // 保存心情
    CoupleCalendar.setMood(dateKey, mood, 'me');
    
    // 更新日历显示
    renderCalendar(currentCalendarYear, currentCalendarMonth);
    
    showToast(`${t('t_f79bb5')} 💕`, '✅');
}

function closeMoodEntry() {
    const modal = document.getElementById('mood-entry-modal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// 导出模块
window.CoupleCalendar = CoupleCalendar;
window.initCoupleCalendar = initCoupleCalendar;
window.showMoodEntry = showMoodEntry;
window.selectMood = selectMood;
window.closeMoodEntry = closeMoodEntry;
