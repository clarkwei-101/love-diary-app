// 恋爱日记 - PWA service worker
// 策略：stale-while-revalidate（静态资源快速响应 + 后台更新）
const CACHE_VERSION = 'love-diary-v3';
const CACHE_NAME = `love-diary-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    './',
    'index.html',
    'css/style.css',
    'js/chart.js',
    'js/diary.js',
    'js/anniversary.js',
    'js/app.js',
    'js/i18n.js',
    'js/daily-qa.js',
    'js/challenge-100.js',
    'js/widget.js',
    'js/pwa.js',
    'js/birthday-effect.js',
    'js/matching.js',
    'js/couple-calendar.js',
    'js/daily-plan.js',
    'js/activity-report.js',
    'js/location.js',
    'js/music-sync.js',
    'js/album.js',
    'js/pet.js',
    'js/decorate.js',
    'js/mood-room.js',
    'js/couple-task.js',
    'js/kiss.js',
    'manifest.json',
    'assets/icons.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
            .catch(() => {
                // 安装失败不阻断
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // stale-while-revalidate：对静态资源先返回缓存，同时更新缓存
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(req);
            const networkFetch = fetch(req).then((res) => {
                if (res && res.status === 200) {
                    cache.put(req, res.clone());
                }
                return res;
            }).catch(() => null);

            // 如果是静态资源（本地同域），优先用缓存，同时后台更新
            const isLocal = !req.url.startsWith('http') ||
                req.url.includes(self.location.origin) ||
                req.url.match(/\.(css|js|svg|png|jpg|jpeg|gif|woff2?)/);

            if (isLocal) {
                return cached || networkFetch || caches.match('index.html');
            }

            // 外部资源（字体、CDN）：缓存优先，后台更新
            return cached || networkFetch || caches.match('index.html');
        })
    );
});

// 推送通知处理（Anniversary reminders 等）
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: '💕 恋爱日记', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || '💕 恋爱日记';
    const options = {
        body: data.body || '',
        icon: data.icon || './assets/icons.svg',
        badge: './assets/icons.svg',
        tag: data.tag || 'love-diary',
        data: data.data || {},
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                // 如果已有窗口，打开它
                for (const client of clients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // 否则打开新窗口
                if (self.clients.openWindow) {
                    return self.clients.openWindow('./');
                }
            })
    );
});

// 定期同步：每日提醒
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-reminder') {
        event.waitUntil(showDailyReminder());
    }
});

async function showDailyReminder() {
    // 从 IndexedDB 读取纪念日数据，检查今天是否有纪念日
    const now = new Date();
    const today = `${now.getMonth() + 1}-${now.getDate()}`;
    // 注意：此功能需要在主线程设置 periodicSync 并写入数据
    // 这里展示通知
    try {
        const reg = self.registration;
        if (!reg) return;
        // 通知内容由主线程通过 setAppBadgeCount 管理
    } catch (e) {}
}
