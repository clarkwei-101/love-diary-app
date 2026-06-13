/**
 * 恋爱日记 - 位置共享模块
 * 高精度地图、位置共享、手机电量、emoji互动
 */

const LocationModule = {
    STORAGE_KEY: 'location_data',
    EMOJI_KEY: 'location_emoji_data',
    
    // 获取位置信息
    async getLocation() {
        try {
            // 优先使用浏览器Geolocation API
            if ('geolocation' in navigator) {
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            const data = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy,
                                timestamp: new Date().toISOString()
                            };
                            // 尝试获取IP地址
                            data.ipLocation = await this.getIPLocation();
                            this.saveLocation(data);
                            resolve(data);
                        },
                        async (error) => {
                            console.warn('Geolocation error:', error);
                            const ipData = await this.getIPLocation();
                            this.saveLocation(ipData);
                            resolve(ipData);
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                    );
                });
            } else {
                return await this.getIPLocation();
            }
        } catch (e) {
            console.error(`${t('t_cbb002')}:`, e);
            return null;
        }
    },
    
    // 通过IP地址获取位置
    async getIPLocation() {
        try {
            const response = await fetch('https://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,query');
            const data = await response.json();
            
            if (data.status === 'fail') {
                throw new Error(`IP${t('t_0d66ed')}`);
            }
            
            return {
                ip: data.query,
                country: data.country,
                region: data.regionName,
                city: data.city,
                isp: data.isp,
                latitude: data.lat,
                longitude: data.lon,
                timestamp: new Date().toISOString()
            };
        } catch (e) {
            console.error(`IP${t('t_0a34c7')}:`, e);
            return {
                ip: `${t('t_1622dc')}`,
                country: `${t('t_1622dc')}`,
                region: `${t('t_1622dc')}`,
                city: `${t('t_1622dc')}`,
                timestamp: new Date().toISOString()
            };
        }
    },
    
    // 获取手机电量
    async getBatteryInfo() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                return {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    },
    
    // 保存位置数据
    saveLocation(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            ...data,
            savedAt: new Date().toISOString()
        }));
    },
    
    // 获取保存的位置
    getSavedLocation() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },
    
    // Emoji数据管理
    getEmojiData() {
        try {
            const data = localStorage.getItem(this.EMOJI_KEY);
            return data ? JSON.parse(data) : { sent: [], received: [], todaySent: 0, lastDate: null };
        } catch (e) {
            return { sent: [], received: [], todaySent: 0, lastDate: null };
        }
    },
    
    saveEmojiData(data) {
        localStorage.setItem(this.EMOJI_KEY, JSON.stringify(data));
    },
    
    // 发送emoji
    sendEmoji(emoji) {
        const data = this.getEmojiData();
        const today = new Date().toDateString();
        
        if (data.lastDate !== today) {
            data.todaySent = 0;
            data.lastDate = today;
        }
        
        const msg = {
            id: Date.now().toString(),
            emoji: emoji,
            sender: 'me',
            timestamp: new Date().toISOString()
        };
        
        data.sent.unshift(msg);
        data.todaySent++;
        
        // 保持最近50条
        if (data.sent.length > 50) data.sent = data.sent.slice(0, 50);
        
        this.saveEmojiData(data);
        return msg;
    },
    
    // 模拟收到emoji
    simulateReceiveEmoji(emoji) {
        const data = this.getEmojiData();
        const msg = {
            id: Date.now().toString(),
            emoji: emoji,
            sender: 'partner',
            timestamp: new Date().toISOString()
        };
        data.received.unshift(msg);
        
        if (data.received.length > 50) data.received = data.received.slice(0, 50);
        
        this.saveEmojiData(data);
        return msg;
    }
};

// 渲染高精度地图
function renderHighAccuracyMap(location) {
    const mapContainer = document.getElementById('location-map');
    if (!mapContainer) return;
    
    if (location && location.latitude && location.longitude) {
        // 使用高德地图静态API或OpenStreetMap
        const lat = location.latitude;
        const lon = location.longitude;
        
        // 尝试使用静态地图图片
        const mapUrl = `https://restapi.amap.com/v3/staticmap?location=${lon},${lat}&zoom=15&size=512*300&markers=mid,,A:${lon},${lat}&key=demo`;
        
        mapContainer.innerHTML = `
            <div class="high-accuracy-map">
                <iframe 
                    width="100%" 
                    height="100%" 
                    style="border:0;border-radius:12px;" 
                    loading="lazy" 
                    allowfullscreen 
                    referrerpolicy="no-referrer-when-downgrade"
                    src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01}%2C${lat-0.01}%2C${lon+0.01}%2C${lat+0.01}&layer=mapnik&marker=${lat}%2C${lon}">
                </iframe>
                <div class="map-overlay">
                    <div class="map-marker">
                        <span class="marker-icon">📍</span>
                        <span class="marker-pulse"></span>
                    </div>
                </div>
            </div>
        `;
        
        // 更新坐标显示
        document.getElementById('location-coords').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        
        // 更新精度显示
        if (location.accuracy) {
            document.getElementById('accuracy-value').textContent = `±${Math.round(location.accuracy)}m`;
        } else {
            document.getElementById('accuracy-value').textContent = `IP${t('t_a10fa7')}`;
        }
    } else {
        mapContainer.innerHTML = `
            <div class="map-fallback">
                <span class="fallback-icon">🌐</span>
                <p>正在获取位置...</p>
            </div>
        `;
    }
}

// 渲染位置信息
async function renderLocationInfo() {
    // 更新地图
    const location = await LocationModule.getLocation();
    renderHighAccuracyMap(location);
    
    // 更新地址显示
    const addressEl = document.getElementById('location-address');
    const mapAddressEl = document.getElementById('map-address');
    
    if (addressEl) {
        addressEl.textContent = location?.city || location?.region || location?.country || `${t('t_dd1f7b')}...`;
    }
    if (mapAddressEl) {
        mapAddressEl.textContent = location ? `${location.city || ''} ${location.region || ''}` : `${t('t_6baf42')}...`;
    }
    
    // 更新电量
    const battery = await LocationModule.getBatteryInfo();
    const batteryEl = document.getElementById('location-battery');
    if (batteryEl) {
        if (battery) {
            batteryEl.textContent = `${battery.level}%${battery.charging ? ' ⚡' : ''}`;
        } else {
            batteryEl.textContent = `${t('t_5875b0')}`;
        }
    }
    
    // 更新网络状态
    const networkEl = document.getElementById('location-network');
    if (networkEl) {
        const online = navigator.onLine;
        networkEl.textContent = online ? '在线 📶' : `${t('t_50d4a8')} 📵`;
    }
    
    // 渲染收到的emoji
    renderReceivedEmojis();
}

// 渲染收到的emoji
function renderReceivedEmojis() {
    const container = document.getElementById('emoji-received-list');
    if (!container) return;
    
    const data = LocationModule.getEmojiData();
    const all = [...data.received].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (all.length === 0) {
        container.innerHTML = `<p class="emoji-received-empty">${t('t_26922a')}TA${t('t_b185f1')} 💕</p>`;
        return;
    }
    
    container.innerHTML = all.slice(0, 10).map(msg => `
        <div class="emoji-received-item">
            <span class="emoji">${msg.emoji}</span>
            <div class="info">
                <span class="sender">TA</span>
                <span class="time">${formatTimeAgo(msg.timestamp)}</span>
            </div>
        </div>
    `).join('');
    
    // 更新发送计数
    document.getElementById('emoji-sent-count').textContent = data.todaySent;
}

// 发送位置emoji
function sendLocationEmoji(emoji) {
    const result = LocationModule.sendEmoji(emoji);
    
    // 创建发送动画
    createSendEmojiAnim(emoji);
    showToast(`${emoji} ${t('t_9d0f51')}TA！`, '✅');
    
    // 模拟对方回复
    setTimeout(() => {
        const replies = ['💕', '❤️', '🥰', '😘', '💗', '💖', '🤗', '👀'];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        LocationModule.simulateReceiveEmoji(reply);
        renderReceivedEmojis();
        showToast(`${t('t_26922a')}TA的${reply}！`, '💕');
    }, 1500 + Math.random() * 2000);
}

function sendCustomLocationEmoji() {
    const input = document.getElementById('custom-emoji-input');
    const emoji = input?.value.trim();
    
    if (!emoji) {
        showToast(`${t('t_03a96c')}`, '⚠️');
        return;
    }
    
    sendLocationEmoji(emoji);
    if (input) input.value = '';
}

// 创建发送动画
function createSendEmojiAnim(emoji) {
    const container = document.getElementById('floating-emoji-container') || createFloatingContainer();
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'floating-emoji-anim';
            el.textContent = emoji;
            el.style.left = Math.random() * 80 + 10 + '%';
            el.style.top = Math.random() * 60 + 20 + '%';
            container.appendChild(el);
            
            setTimeout(() => el.remove(), 2000);
        }, i * 150);
    }
}

function createFloatingContainer() {
    const container = document.createElement('div');
    container.id = 'floating-emoji-container';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(container);
    return container;
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

// 初始化位置模块
function initLocationModule() {
    renderLocationInfo();
    
    // 定时刷新
    setInterval(renderLocationInfo, 60000);
    
    // 刷新按钮
    document.getElementById('btn-refresh-location')?.addEventListener('click', () => {
        renderLocationInfo();
        showToast(`${t('t_4be756')}`, '📍');
    });
}

// 导出
window.LocationModule = LocationModule;
window.initLocationModule = initLocationModule;
window.renderLocationInfo = renderLocationInfo;
window.sendLocationEmoji = sendLocationEmoji;
window.sendCustomLocationEmoji = sendCustomLocationEmoji;
