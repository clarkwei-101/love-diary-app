/**
 * 桌面小组件：显示恋爱天数 + 下一提醒
 */

function updateDesktopWidget() {
    const loveDaysEl = document.getElementById('widget-love-days');
    const nextReminderEl = document.getElementById('widget-next-reminder');
    if (!loveDaysEl || !nextReminderEl) return;

    loveDaysEl.textContent = anniversaryManager.getLoveDays();

    const all = anniversaryManager.getUpcomingAnniversaries(20);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const candidates = all.map(item => {
        const nextDate = item.nextDate || item.date;
        if (!nextDate) return null;
        const eventDate = new Date(nextDate);
        eventDate.setHours(0, 0, 0, 0);

        const remindDays = Number(item.remindDays || 0);
        const reminderDate = new Date(eventDate);
        reminderDate.setDate(reminderDate.getDate() - remindDays);
        reminderDate.setHours(0, 0, 0, 0);

        // 仅显示未来的提醒
        if (reminderDate < today) return null;

        const diffDays = Math.floor((reminderDate - today) / (1000 * 60 * 60 * 24));
        return {
            title: item.title || anniversaryManager.getTypeName?.(item.type) || `${t('t_4b027f')}`,
            reminderDate,
            diffDays
        };
    }).filter(Boolean);

    if (!candidates.length) {
        nextReminderEl.textContent = `${t('t_9335a4')}`;
        return;
    }

    candidates.sort((a, b) => a.reminderDate - b.reminderDate);
    const next = candidates[0];

    const dateStr = `${next.reminderDate.getFullYear()}-${String(next.reminderDate.getMonth() + 1).padStart(2, '0')}-${String(next.reminderDate.getDate()).padStart(2, '0')}`;
    nextReminderEl.textContent = `${t('t_84c54b')}：${next.diffDays}${t('t_17fbc2')}（${dateStr}）`;
}

function initWidgetToggle() {
    const btn = document.getElementById('btn-toggle-widget');
    const el = document.getElementById('desktop-widget');
    if (!btn || !el) return;

    const key = 'love_widget_collapsed';
    const collapsed = localStorage.getItem(key) === '1';

    if (collapsed) el.classList.add('widget-collapsed');
    btn.textContent = collapsed ? `${t('t_e2edde')}` : '收起';

    btn.addEventListener('click', () => {
        const nextCollapsed = !el.classList.contains('widget-collapsed');
        if (nextCollapsed) {
            el.classList.add('widget-collapsed');
            localStorage.setItem(key, '1');
            btn.textContent = `${t('t_e2edde')}`;
        } else {
            el.classList.remove('widget-collapsed');
            localStorage.setItem(key, '0');
            btn.textContent = '收起';
        }
    });
}

