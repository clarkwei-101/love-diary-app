/**
 * PWA 支持：注册 service worker + 安装提示 + 推送通知 + 桌面徽章
 */

const NOTIFICATION_PERM_KEY = 'love_notification_permission';

function initPWA() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js')
        .then((reg) => {
            // 安静失败：不需要控制端噪音
        })
        .catch(() => {});

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.__deferredPrompt = e;
        showInstallBanner();
    });

    // 尝试设置桌面徽章（纪念日计数）
    updateAppBadge();
}

function showInstallBanner() {
    const existing = document.getElementById('pwa-install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
        <div class="pwa-install-inner">
            <div class="pwa-install-title">安装到桌面</div>
            <div class="pwa-install-actions">
                <button class="btn-secondary" id="btn-pwa-install-now">安装</button>
                <button class="btn-text" id="btn-pwa-install-close">以后再说</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('btn-pwa-install-close')?.addEventListener('click', () => {
        banner.remove();
    });

    document.getElementById('btn-pwa-install-now')?.addEventListener('click', async () => {
        const p = window.__deferredPrompt;
        if (!p) return;
        try {
            p.prompt();
            await p.userChoice;
        } catch (e) {
            // ignore
        } finally {
            window.__deferredPrompt = null;
        }
    });
}

/** 请求推送通知权限（纪念日提醒等） */
async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    try {
        const perm = await Notification.requestPermission();
        localStorage.setItem(NOTIFICATION_PERM_KEY, perm);
        return perm;
    } catch (e) {
        return 'error';
    }
}

/** 根据纪念日数量设置桌面徽章（Android Chrome / iOS Safari 13+） */
async function updateAppBadge() {
    if (!navigator.setAppBadge) return;
    try {
        const count = getUpcomingAnniversaryCount();
        if (count > 0) {
            await navigator.setAppBadge(count);
        } else {
            await navigator.clearAppBadge();
        }
    } catch (e) {}
}

/** 获取即将到来的纪念日数量（0-9 范围） */
function getUpcomingAnniversaryCount() {
    try {
        if (typeof anniversaryManager !== 'undefined') {
            const upcoming = anniversaryManager.getUpcomingAnniversaries ? anniversaryManager.getUpcomingAnniversaries(5) : [];
            return Math.min(upcoming.length, 9);
        }
    } catch (e) {}
    return 0;
}

/** 发送本地通知（无需推送服务器） */
async function showLocalNotification(title, options = {}) {
    if (Notification.permission !== 'granted') return;
    if (!navigator.serviceWorker?.controller) return;

    try {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options
        });
    } catch (e) {}
}

/** 检查是否启用了通知权限设置项 */
function isNotificationEnabled() {
    return localStorage.getItem(NOTIFICATION_PERM_KEY) === 'granted';
}
