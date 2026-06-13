/**
 * 恋爱日记 - 电子宠物模块
 * 养一只属于你们的情侣电子宠物
 */

const PetModule = {
    STORAGE_KEY: 'pet_data',
    
    // 宠物类型
    TYPES: {
        cat: { name: `${t('t_bb1779')}`, emoji: '🐱', color: '#FFB347' },
        dog: { name: `${t('t_846787')}`, emoji: '🐶', color: '#87CEEB' },
        rabbit: { name: `${t('t_f330ad')}`, emoji: '🐰', color: '#FFB6C1' },
        bear: { name: `${t('t_4c5491')}`, emoji: '🐻', color: '#DEB887' },
        panda: { name: `${t('t_b2133f')}`, emoji: '🐼', color: '#F5F5F5' },
        hamster: { name: `${t('t_7e6388')}`, emoji: '🐹', color: '#FFD700' }
    },
    
    // 宠物状态
    STATUS: {
        hungry: `${t('t_228ec6')}`,
        sleepy: `${t('t_7a9385')}`,
        happy: '开心',
        sad: '难过',
        angry: '生气'
    },
    
    // 获取宠物数据
    getPet() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : this.getDefaultPet();
        } catch (e) {
            return this.getDefaultPet();
        }
    },
    
    // 获取默认宠物
    getDefaultPet() {
        return {
            type: 'cat',
            name: `${t('t_63f196')}`,
            level: 1,
            exp: 0,
            hunger: 80,
            happiness: 80,
            energy: 80,
            lastFed: Date.now(),
            lastPlayed: Date.now(),
            lastSlept: Date.now(),
            totalDays: 0,
            achievements: []
        };
    },
    
    // 保存宠物数据
    savePet(pet) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pet));
    },
    
    // 喂食
    feed() {
        const pet = this.getPet();
        pet.hunger = Math.min(100, pet.hunger + 30);
        pet.lastFed = Date.now();
        this.savePet(pet);
        return pet;
    },
    
    // 陪玩
    play() {
        const pet = this.getPet();
        pet.happiness = Math.min(100, pet.happiness + 25);
        pet.energy = Math.max(0, pet.energy - 10);
        pet.exp += 10;
        pet.lastPlayed = Date.now();
        this.checkLevelUp(pet);
        this.savePet(pet);
        return pet;
    },
    
    // 睡觉
    sleep() {
        const pet = this.getPet();
        pet.energy = 100;
        pet.hunger = Math.max(0, pet.hunger - 10);
        pet.lastSlept = Date.now();
        this.savePet(pet);
        return pet;
    },
    
    // 检查升级
    checkLevelUp(pet) {
        const expNeeded = pet.level * 100;
        if (pet.exp >= expNeeded) {
            pet.level++;
            pet.exp -= expNeeded;
            return true; // 升级了
        }
        return false;
    },
    
    // 获取宠物状态
    getStatus(pet) {
        if (pet.hunger < 30) return 'hungry';
        if (pet.energy < 30) return 'sleepy';
        if (pet.happiness > 70) return 'happy';
        if (pet.happiness < 30) return 'sad';
        return 'happy';
    },
    
    // 获取状态emoji
    getStatusEmoji(status) {
        switch (status) {
            case 'hungry': return '😿';
            case 'sleepy': return '😴';
            case 'happy': return '😸';
            case 'sad': return '😿';
            case 'angry': return '😾';
            default: return '😺';
        }
    }
};

// 渲染宠物页面
function renderPetPage() {
    const container = document.getElementById('pet-container');
    if (!container) return;
    
    const pet = PetModule.getPet();
    const petInfo = PetModule.TYPES[pet.type];
    const status = PetModule.getStatus(pet);
    const statusEmoji = PetModule.getStatusEmoji(status);
    
    container.innerHTML = `
        <div class="pet-main-card glass-card">
            <div class="pet-avatar-area">
                <div class="pet-avatar" id="pet-avatar">
                    <span class="pet-emoji">${petInfo.emoji}</span>
                    <span class="pet-status">${statusEmoji}</span>
                </div>
                <div class="pet-info">
                    <h3>${pet.name}</h3>
                    <p class="pet-level">Lv.${pet.level}</p>
                    <div class="pet-exp-bar">
                        <div class="pet-exp-fill" style="width: ${(pet.exp / (pet.level * 100)) * 100}%"></div>
                    </div>
                    <p class="pet-exp-text">${pet.exp}/${pet.level * 100} 经验</p>
                </div>
            </div>
            
            <div class="pet-mood-display">
                <div class="mood-indicator ${status}">
                    <span class="mood-emoji">${statusEmoji}</span>
                    <span class="mood-text">${PetModule.STATUS[status]}</span>
                </div>
            </div>
        </div>
        
        <div class="pet-stats-card glass-card">
            <h4>📊 宠物状态</h4>
            <div class="pet-stat-row">
                <span class="pet-stat-icon">🍖</span>
                <span class="pet-stat-label">饥饿度</span>
                <div class="pet-stat-bar">
                    <div class="pet-stat-fill hunger" style="width: ${pet.hunger}%"></div>
                </div>
                <span class="pet-stat-value">${pet.hunger}%</span>
            </div>
            <div class="pet-stat-row">
                <span class="pet-stat-icon">😊</span>
                <span class="pet-stat-label">开心值</span>
                <div class="pet-stat-bar">
                    <div class="pet-stat-fill happiness" style="width: ${pet.happiness}%"></div>
                </div>
                <span class="pet-stat-value">${pet.happiness}%</span>
            </div>
            <div class="pet-stat-row">
                <span class="pet-stat-icon">⚡</span>
                <span class="pet-stat-label">活力值</span>
                <div class="pet-stat-bar">
                    <div class="pet-stat-fill energy" style="width: ${pet.energy}%"></div>
                </div>
                <span class="pet-stat-value">${pet.energy}%</span>
            </div>
        </div>
        
        <div class="pet-actions-card">
            <button class="pet-action-btn feed" onclick="petAction('feed')">
                <span class="action-icon">🍖</span>
                <span>喂食</span>
            </button>
            <button class="pet-action-btn play" onclick="petAction('play')">
                <span class="action-icon">🎾</span>
                <span>陪玩</span>
            </button>
            <button class="pet-action-btn sleep" onclick="petAction('sleep')">
                <span class="action-icon">😴</span>
                <span>${t('t_60cffc')}</span>
            </button>
        </div>
        
        <div class="pet-shop-card glass-card">
            <h4>🏪 宠物商店</h4>
            <p class="shop-hint">解锁新宠物，提升等级</p>
            <div class="pet-shop-items">
                ${Object.entries(PetModule.TYPES).map(([key, info]) => `
                    <div class="shop-pet-item ${key === pet.type ? 'owned' : ''}" onclick="changePetType('${key}')">
                        <span class="shop-pet-emoji">${info.emoji}</span>
                        <span class="shop-pet-name">${info.name}</span>
                        ${key === pet.type ? `<span class="owned-badge">${t('t_d8592b')}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="pet-achievements glass-card">
            <h4>🏆 成就系统</h4>
            <div class="achievement-progress">
                <span>已解锁: ${countUnlockedAchievements(pet)}/${getAllAchievements().length}</span>
            </div>
            <div class="achievement-list">
                ${getAllAchievements().map(ach => {
                    const unlocked = isAchievementUnlocked(pet, ach.id);
                    return `
                        <div class="achievement-item ${unlocked ? 'unlocked' : ''}" onclick="${!unlocked ? `showAchievementHint('${ach.hint}')` : ''}">
                            <span class="achievement-icon">${ach.icon}</span>
                            <div class="achievement-info">
                                <span class="achievement-name">${ach.name}</span>
                                <span class="achievement-desc">${ach.desc}</span>
                            </div>
                            ${unlocked ? '<span class="unlocked-check">✓</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- 宠物动态特效 -->
        <div class="pet-animation-area" id="pet-animation-area"></div>
    `;
}

function getAllAchievements() {
    return [
        { id: 'level_5', name: `${t('t_bb2906')}`, desc: `${t('t_8bc512')}5级`, icon: '⭐', hint: `${t('t_dca8f3')}！` },
        { id: 'level_10', name: `${t('t_4e2b34')}`, desc: `${t('t_8bc512')}10级`, icon: '🌟', hint: `${t('t_f81f4d')}！` },
        { id: 'level_20', name: `${t('t_0c4447')}`, desc: `${t('t_8bc512')}20级`, icon: '👑', hint: `${t('t_1d8c22')}！` },
        { id: 'first_feed', name: `${t('t_f54b97')}`, desc: `${t('t_e189c3')}`, icon: '🍖', hint: `${t('t_be15ce')}！` },
        { id: 'feed_10', name: `${t('t_5a769c')}`, desc: `${t('t_35870b')}10次`, icon: '🍽️', hint: `${t('t_127d98')}！` },
        { id: 'feed_50', name: `${t('t_e677f2')}`, desc: `${t('t_35870b')}50次`, icon: '👨‍🍳', hint: `${t('t_b33d1c')}！` },
        { id: 'play_10', name: `${t('t_d2ba97')}`, desc: `${t('t_ef74ee')}10次`, icon: '🎾', hint: `${t('t_fbc8da')}！` },
        { id: 'play_50', name: `${t('t_a43d56')}`, desc: `${t('t_ef74ee')}50次`, icon: '🎮', hint: `${t('t_6f9d09')}！` },
        { id: 'sleep_10', name: `${t('t_0e507c')}`, desc: `${t('t_7ef51e')}10次`, icon: '😴', hint: `${t('t_19b96a')}！` },
        { id: 'care_3days', name: `${t('t_bef526')}`, desc: `${t('t_7c7859')}3天`, icon: '📅', hint: `${t('t_be2ffc')}！` },
        { id: 'care_7days', name: `${t('t_8cc937')}CP`, desc: `${t('t_7c7859')}7天`, icon: '💕', hint: `${t('t_677654')}！` },
        { id: 'care_30days', name: `${t('t_86ed86')}`, desc: `${t('t_7c7859')}30天`, icon: '🎊', hint: `${t('t_5acc59')}！` },
        { id: 'all_pets', name: `${t('t_eb70ad')}`, desc: `${t('t_e45c76')}`, icon: '🎯', hint: `${t('t_17509c')}！` },
        { id: 'happiness_100', name: `${t('t_b65b12')}`, desc: `${t('t_5667b1')}100`, icon: '😄', hint: `${t('t_76780c')}！` },
        { id: 'full_stats', name: `${t('t_ed98db')}`, desc: `${t('t_a2d1e2')}`, icon: '💯', hint: `${t('t_12c691')}！` },
        { id: 'share_pet', name: `${t('t_1d2631')}`, desc: `和TA${t('t_742b52')}`, icon: '📸', hint: `${t('t_263cd9')}TA${t('t_e10cf4')}！` }
    ];
}

function isAchievementUnlocked(pet, achId) {
    if (achId === 'level_5') return pet.level >= 5;
    if (achId === 'level_10') return pet.level >= 10;
    if (achId === 'level_20') return pet.level >= 20;
    if (achId === 'first_feed') return pet.achievements.includes('first_feed');
    if (achId === 'feed_10') return pet.feedCount >= 10;
    if (achId === 'feed_50') return pet.feedCount >= 50;
    if (achId === 'play_10') return pet.playCount >= 10;
    if (achId === 'play_50') return pet.playCount >= 50;
    if (achId === 'sleep_10') return pet.sleepCount >= 10;
    if (achId === 'care_3days') return pet.careStreak >= 3;
    if (achId === 'care_7days') return pet.careStreak >= 7;
    if (achId === 'care_30days') return pet.careStreak >= 30;
    if (achId === 'all_pets') return Object.keys(PetModule.TYPES).every(t => pet.unlockedPets?.includes(t));
    if (achId === 'happiness_100') return pet.happiness >= 100;
    if (achId === 'full_stats') return pet.hunger >= 100 && pet.happiness >= 100 && pet.energy >= 100;
    return false;
}

function countUnlockedAchievements(pet) {
    return getAllAchievements().filter(a => isAchievementUnlocked(pet, a.id)).length;
}

function showAchievementHint(hint) {
    showToast(hint, '💡');
}

function petAction(action) {
    const pet = PetModule.getPet();
    let result;
    
    // 确保计数属性存在
    pet.feedCount = pet.feedCount || 0;
    pet.playCount = pet.playCount || 0;
    pet.sleepCount = pet.sleepCount || 0;
    pet.achievements = pet.achievements || [];
    
    switch (action) {
        case 'feed':
            result = PetModule.feed();
            pet.feedCount++;
            if (pet.feedCount === 1 && !pet.achievements.includes('first_feed')) {
                pet.achievements.push('first_feed');
            }
            PetModule.savePet(pet);
            showPetActionAnim('feed');
            showToast(`${pet.name}${t('t_0b4eac')}！💕`, '🍖');
            break;
        case 'play':
            result = PetModule.play();
            pet.playCount++;
            const leveled = PetModule.checkLevelUp(result);
            if (leveled) {
                PetModule.savePet(result);
                showPetActionAnim('levelup');
                showToast(`${pet.name}${t('t_e62e3f')}Lv.${result.level}！🎉`, '⭐');
            } else {
                PetModule.savePet(pet);
                showPetActionAnim('play');
                showToast(`${pet.name}${t('t_54b06e')}！`, '🎾');
            }
            break;
        case 'sleep':
            result = PetModule.sleep();
            pet.sleepCount++;
            PetModule.savePet(pet);
            showPetActionAnim('sleep');
            showToast(`${pet.name}${t('t_50fd67')}~`, '😴');
            break;
    }
    
    renderPetPage();
}

// 宠物动作动画
function showPetActionAnim(type) {
    const container = document.getElementById('pet-animation-area');
    if (!container) return;
    
    const emojis = {
        feed: ['🍖', '🍗', '🥩', '🍔'],
        play: ['🎾', '🎮', '🎯', '🎪'],
        sleep: ['😴', '💤', '🌙', '✨'],
        levelup: ['⭐', '🌟', '✨', '🎉', '💫']
    };
    
    const items = emojis[type] || emojis.play;
    
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'pet-anim-emoji';
            el.textContent = items[Math.floor(Math.random() * items.length)];
            el.style.left = Math.random() * 80 + 10 + '%';
            el.style.top = Math.random() * 60 + 20 + '%';
            container.appendChild(el);
            
            setTimeout(() => el.remove(), 1500);
        }, i * 100);
    }
}

function changePetType(type) {
    const pet = PetModule.getPet();
    pet.type = type;
    PetModule.savePet(pet);
    renderPetPage();
    showToast(`${t('t_6a933c')} ${PetModule.TYPES[type].name} 了！${PetModule.TYPES[type].emoji}`, '✅');
}

// 初始化宠物模块
function initPetModule() {
    renderPetPage();
}

// 导出
window.PetModule = PetModule;
window.initPetModule = initPetModule;
window.renderPetPage = renderPetPage;
window.petAction = petAction;
window.changePetType = changePetType;
