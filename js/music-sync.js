/**
 * 恋爱日记 - 一起听音乐模块
 * 兼容第三方音乐App
 */

const MusicSync = {
    STORAGE_KEY: 'music_sync_data',
    
    // 支持的音乐App
    APPS: [
        {
            id: 'kugou',
            name: `${t('t_351a62')}`,
            icon: '🎵',
            scheme: 'kugou://',
            color: '#FF4D4D'
        },
        {
            id: 'qqmusic',
            name: `QQ${t('t_95521b')}`,
            icon: '🎶',
            scheme: 'qqmusic://',
            color: '#31C27C'
        },
        {
            id: 'ncm',
            name: `${t('t_57d574')}`,
            icon: '☁️',
            scheme: 'orpheus://',
            color: '#C20C0C'
        },
        {
            id: 'spotify',
            name: 'Spotify',
            icon: '🎧',
            scheme: 'spotify://',
            color: '#1DB954'
        },
        {
            id: 'applemusic',
            name: 'Apple Music',
            icon: '🍎',
            scheme: 'music://',
            color: '#FC3C44'
        },
        {
            id: 'youtube',
            name: 'YouTube Music',
            icon: '📺',
            scheme: 'ytmusic://',
            color: '#FF0000'
        }
    ],
    
    // 获取同步数据
    getSyncData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {
                currentSong: null,
                isPlaying: false,
                lastUpdated: null
            };
        } catch (e) {
            return {
                currentSong: null,
                isPlaying: false,
                lastUpdated: null
            };
        }
    },
    
    // 保存同步数据
    saveSyncData(data) {
        data.lastUpdated = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },
    
    // 设置当前播放
    setCurrentSong(song, artist = '', app = '') {
        const syncData = this.getSyncData();
        syncData.currentSong = { song, artist, app };
        syncData.isPlaying = true;
        this.saveSyncData(syncData);
    },
    
    // 切换播放状态
    togglePlayPause() {
        const syncData = this.getSyncData();
        syncData.isPlaying = !syncData.isPlaying;
        this.saveSyncData(syncData);
        return syncData.isPlaying;
    },
    
    // 获取当前播放
    getCurrentSong() {
        return this.getSyncData();
    },
    
    // 打开音乐App
    openApp(appId) {
        const app = this.APPS.find(a => a.id === appId);
        if (!app) return;
        
        // 尝试打开App
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = app.scheme;
        document.body.appendChild(iframe);
        
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
        
        showToast(`${t('t_926a6b')} ${app.name}...`, '🎵');
    },
    
    // 分享歌曲到对方
    shareSong(song, artist, app) {
        const syncData = this.getSyncData();
        syncData.currentSong = { song, artist, app };
        syncData.lastUpdated = new Date().toISOString();
        this.saveSyncData(syncData);
        
        showToast(`${t('t_e5be2d')}TA 💕`, '🎵');
    }
};

// 渲染音乐同步面板
function renderMusicSyncPanel() {
    const container = document.getElementById('music-sync-container');
    if (!container) return;
    
    const syncData = MusicSync.getSyncData();
    const pairingData = getLocalPairingData();
    
    if (!pairingData?.paired) {
        container.innerHTML = `
            <div class="music-sync-card">
                <div class="empty-state">
                    <span class="empty-icon">🎵</span>
                    <p>配对后即可${t('t_3efffd')}听${t('t_95521b')}</p>
                    <p style="font-size:12px;color:var(--text-light);">去匹配页绑定你的另一半吧~</p>
                </div>
            </div>
        `;
        return;
    }
    
    const partnerName = pairingData.partner?.userName || 'TA';
    
    let songHtml = '';
    if (syncData.currentSong) {
        songHtml = `
            <div class="music-sync-now">
                <div class="music-sync-song">${escapeHtml(syncData.currentSong.song)}</div>
                <div class="music-sync-artist">${escapeHtml(syncData.currentSong.artist || `${t('t_5e3227')}`)}</div>
                ${syncData.currentSong.app ? `<div style="font-size:11px;color:var(--text-light);margin-top:4px;">via ${syncData.currentSong.app}</div>` : ''}
            </div>
            
            <div class="music-sync-controls">
                <button class="music-sync-btn" onclick="toggleMusicSyncPlay()">
                    ${syncData.isPlaying ? '⏸️' : '▶️'}
                </button>
            </div>
        `;
    } else {
        songHtml = `
            <div class="music-sync-now">
                <p style="color:var(--text-secondary);">还没有正在播放的${t('t_95521b')}</p>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="music-sync-card">
            <div class="music-sync-header">
                <span class="music-sync-avatar">🎧</span>
                <div class="music-sync-info">
                    <div class="music-sync-name">${partnerName} 正在听</div>
                    <div class="music-sync-status">${syncData.isPlaying ? `🎵 ${t('t_7a7998')}` : `⏸️ ${t('t_a2d930')}`}</div>
                </div>
            </div>
            ${songHtml}
        </div>
        
        <div class="music-sync-card">
            <h4 style="margin-bottom:12px;">打开${t('t_95521b')}App</h4>
            <div class="music-app-links">
                ${MusicSync.APPS.map(app => `
                    <a href="#" class="music-app-link" onclick="MusicSync.openApp('${app.id}');return false;">
                        <span class="music-app-icon">${app.icon}</span>
                        <span>${app.name}</span>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}

function toggleMusicSyncPlay() {
    const isPlaying = MusicSync.togglePlayPause();
    renderMusicSyncPanel();
    showToast(isPlaying ? `${t('t_296b0b')}` : `${t('t_a2d930')}`, isPlaying ? '▶️' : '⏸️');
}

// 初始化音乐同步
function initMusicSync() {
    renderMusicSyncPanel();
    
    // 监听配对事件
    window.addEventListener('couple-paired', () => {
        renderMusicSyncPanel();
    });
    
    window.addEventListener('couple-unpaired', () => {
        renderMusicSyncPanel();
    });
}

// 导出
window.MusicSync = MusicSync;
window.initMusicSync = initMusicSync;
window.renderMusicSyncPanel = renderMusicSyncPanel;
window.toggleMusicSyncPlay = toggleMusicSyncPlay;
