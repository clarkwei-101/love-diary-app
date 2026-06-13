/**
 * 恋爱日记 - 装扮小屋模块
 * 一起装修你们的小窝
 */

const DecorateModule = {
    STORAGE_KEY: 'decorate_data',
    
    // 家具分类
    CATEGORIES: {
        furniture: { name: `${t('t_600ef4')}`, icon: '🛋️' },
        decor: { name: `${t('t_4a7ece')}`, icon: '🌸' },
        wall: { name: `${t('t_0ceb9a')}`, icon: '🖼️' },
        floor: { name: `${t('t_39fc69')}`, icon: '🪵' },
        lighting: { name: `${t('t_3e4d71')}`, icon: '💡' },
        plants: { name: `${t('t_9b230a')}`, icon: '🌿' }
    },
    
    // 家具项目
    ITEMS: {
        // 家具
        sofa: { name: `${t('t_b9b00e')}`, emoji: '🛋️', category: 'furniture', price: 100 },
        bed: { name: `${t('t_7b70dd')}`, emoji: '🛏️', category: 'furniture', price: 150 },
        table: { name: `${t('t_3b4e34')}`, emoji: '🪑', category: 'furniture', price: 80 },
        wardrobe: { name: `${t('t_c6691d')}`, emoji: '🚪', category: 'furniture', price: 120 },
        desk: { name: `${t('t_305147')}`, emoji: '📚', category: 'furniture', price: 90 },
        // 装饰
        photo: { name: `${t('t_62076a')}`, emoji: '📷', category: 'decor', price: 50 },
        flower: { name: `${t('t_061e43')}`, emoji: '💐', category: 'decor', price: 40 },
        painting: { name: `${t('t_5d04f2')}`, emoji: '🖼️', category: 'decor', price: 60 },
        lamp: { name: `${t('t_3c5212')}`, emoji: '🪔', category: 'decor', price: 35 },
        // 植物
        plant: { name: `${t('t_a81a45')}`, emoji: '🌱', category: 'plants', price: 30 },
        flowerpot: { name: `${t('t_7cbcd6')}`, emoji: '🪴', category: 'plants', price: 45 },
        bonsai: { name: `${t('t_768eeb')}`, emoji: '🌳', category: 'plants', price: 80 }
    },
    
    // 获取装修数据
    getDecorateData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : this.getDefaultData();
        } catch (e) {
            return this.getDefaultData();
        }
    },
    
    // 获取默认数据
    getDefaultData() {
        return {
            coins: 500,
            level: 1,
            purchasedItems: ['sofa'],
            placedItems: [
                { id: 'sofa', x: 50, y: 60 }
            ],
            roomStyle: 'default',
            totalDays: 0
        };
    },
    
    // 保存数据
    saveData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },
    
    // 购买物品
    purchase(itemId) {
        const data = this.getDecorateData();
        const item = this.ITEMS[itemId];
        if (!item) return false;
        
        if (data.purchasedItems.includes(itemId)) {
            return false; // 已购买
        }
        
        if (data.coins < item.price) {
            return false; // 钱不够
        }
        
        data.coins -= item.price;
        data.purchasedItems.push(itemId);
        this.saveData(data);
        return true;
    },
    
    // 放置物品
    placeItem(itemId, x, y) {
        const data = this.getDecorateData();
        const placed = data.placedItems.find(p => p.id === itemId);
        
        if (placed) {
            placed.x = x;
            placed.y = y;
        } else {
            data.placedItems.push({ id: itemId, x, y });
        }
        
        this.saveData(data);
    },
    
    // 移除物品
    removeItem(itemId) {
        const data = this.getDecorateData();
        data.placedItems = data.placedItems.filter(p => p.id !== itemId);
        this.saveData(data);
    },
    
    // 获取金币
    getCoins() {
        return this.getDecorateData().coins;
    },
    
    // 每日奖励
    claimDailyReward() {
        const data = this.getDecorateData();
        const lastClaim = localStorage.getItem('decorate_last_claim');
        const today = new Date().toDateString();
        
        if (lastClaim === today) {
            return 0; // 今天已领取
        }
        
        const reward = 50 + data.level * 10;
        data.coins += reward;
        localStorage.setItem('decorate_last_claim', today);
        this.saveData(data);
        return reward;
    }
};

// 渲染装修页面
function renderDecoratePage() {
    const container = document.getElementById('decorate-container');
    if (!container) return;
    
    const data = DecorateModule.getDecorateData();
    
    container.innerHTML = `
        <div class="decorate-room glass-card">
            <div class="room-header">
                <h3>🏠 ${t('t_6f3a06')}家</h3>
                <div class="room-coins">
                    <span>🪙</span>
                    <span id="decorate-coins">${data.coins}</span>
                </div>
            </div>
            <div class="room-canvas" id="room-canvas">
                ${data.placedItems.map(item => {
                    const itemInfo = DecorateModule.ITEMS[item.id];
                    return `<div class="room-item" style="left:${item.x}%;top:${item.y}%;" data-id="${item.id}">${itemInfo.emoji}</div>`;
                }).join('')}
                <div class="room-empty" style="${data.placedItems.length ? 'display:none' : ''}">
                    <p>空空如也~</p>
                    <p style="font-size:12px;">去商店买点${t('t_600ef4')}吧</p>
                </div>
            </div>
            <button class="btn-small" onclick="claimDailyReward()">🎁 每日领取50${t('t_740259')}</button>
        </div>
        
        <div class="decorate-shop glass-card">
            <h4>🏪 ${t('t_600ef4')}商店</h4>
            <div class="shop-tabs">
                ${Object.entries(DecorateModule.CATEGORIES).map(([key, cat]) => `
                    <button class="shop-tab" data-category="${key}">${cat.icon}</button>
                `).join('')}
            </div>
            <div class="shop-items" id="shop-items">
                ${Object.entries(DecorateModule.ITEMS).map(([id, item]) => {
                    const owned = data.purchasedItems.includes(id);
                    return `
                        <div class="shop-item ${owned ? 'owned' : ''}" onclick="${owned ? 'placeItem(\'' + id + '\')' : 'buyItem(\'' + id + '\')'}">
                            <span class="item-emoji">${item.emoji}</span>
                            <span class="item-name">${item.name}</span>
                            ${owned ? `<span class="owned-tag">${t('t_d8592b')}</span>` : `<span class="item-price">🪙${item.price}</span>`}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function buyItem(itemId) {
    const success = DecorateModule.purchase(itemId);
    if (success) {
        showToast(`${t('t_68209b')}！💕`, '✅');
        renderDecoratePage();
    } else {
        showToast(`${t('t_6d4c66')}`, '⚠️');
    }
}

function placeItem(itemId) {
    DecorateModule.placeItem(itemId, Math.random() * 60 + 20, Math.random() * 40 + 30);
    showToast(`${t('t_d3438a')}！`, '✅');
    renderDecoratePage();
}

function claimDailyReward() {
    const reward = DecorateModule.claimDailyReward();
    if (reward > 0) {
        showToast(`${t('t_02574c')} ${reward} ${t('t_740259')}！🎁`, '✅');
        renderDecoratePage();
    } else {
        showToast(`${t('t_1cb837')}`, '⏰');
    }
}

function initDecorateModule() {
    renderDecoratePage();
}

window.DecorateModule = DecorateModule;
window.initDecorateModule = initDecorateModule;
window.renderDecoratePage = renderDecoratePage;
window.buyItem = buyItem;
window.placeItem = placeItem;
window.claimDailyReward = claimDailyReward;
