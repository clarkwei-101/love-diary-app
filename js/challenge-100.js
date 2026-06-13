/**
 * 打卡挑战：一起做的100件事
 * - LocalStorage 持久化
 * - 首次进入自动生成 100 项
 */

class Challenge100Manager {
    constructor() {
        this.STORAGE_KEY = 'love_challenge_100';
        this.CACHE_KEY = 'love_challenge_100_generatedAt';
        this.templates = [
            `${t('t_b436e4')}`,
            `${t('t_cde9c1')} 30 分钟`,
            `${t('t_4e3998')}`,
            `${t('t_15afdf')}`,
            `${t('t_cc7546')}`,
            `${t('t_5162cf')}`,
            `${t('t_278699')}`,
            `${t('t_dbec75')}`,
            `${t('t_0ac5f7')}`,
            `${t('t_ae9d58')}`,
            `${t('t_0eca6a')}`,
            `${t('t_6b8114')}`,
            `${t('t_053d54')}`,
            `${t('t_29c41d')} 20 分钟`,
            `${t('t_38e9a8')}/DIY${t('t_57fd6b')}`,
            `${t('t_a948ef')}`,
            `${t('t_6b9a6f')}`,
            `${t('t_253219')}`,
            `${t('t_1b2e77')}`,
            `${t('t_e7d8ef')}`,
            `${t('t_d406ff')}/${t('t_0a6455')}`,
            `${t('t_a4b0e7')}`,
            `${t('t_b5e320')}`,
            `${t('t_424683')}`,
            `${t('t_fc1824')}/${t('t_548431')}`,
            `${t('t_974cfe')}`,
            `${t('t_8e8ae7')}`,
            `${t('t_78aaa1')}`,
            `${t('t_8955d4')}`,
            `${t('t_95d295')}）`,
            `${t('t_7cec9d')}`,
            `${t('t_65e870')}/${t('t_2f0d8e')}`,
            `${t('t_1c3f95')}`
        ];

        this.items = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`${t('t_9a501f')}:`, e);
            return [];
        }
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
            return true;
        } catch (e) {
            console.error(`${t('t_cc2f9d')}:`, e);
            return false;
        }
    }

    seedFromDate(dateStr) {
        let h = 0;
        for (let i = 0; i < dateStr.length; i++) {
            h = (h * 33 + dateStr.charCodeAt(i)) >>> 0;
        }
        return h;
    }

    shuffleBySeed(arr, seed) {
        const a = [...arr];
        let s = seed;
        for (let i = a.length - 1; i > 0; i--) {
            s = (s * 1664525 + 1013904223) >>> 0;
            const j = s % (i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    generateIfNeeded() {
        if (this.items && this.items.length === 100) return;

        // 用当前日期 seed：保证“首次生成后固定”，再不重算
        const nowKey = this.getNowDateKey();
        const seed = this.seedFromDate(nowKey);

        const pool = this.shuffleBySeed(this.templates, seed);
        const items = [];
        for (let i = 0; i < 100; i++) {
            const base = pool[i % pool.length];
            const variant = i < 30
                ? base
                : `${base}（第${Math.floor(i / pool.length) + 1}轮）`;
            items.push({
                id: `c100_${i + 1}`,
                text: variant,
                done: false,
                doneAt: null
            });
        }

        this.items = items;
        this.save();
    }

    getNowDateKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    getSummary() {
        const total = 100;
        const done = this.items.filter(i => i.done).length;
        const percent = Math.round((done / total) * 100);
        return { total, done, percent };
    }

    getItems() {
        this.generateIfNeeded();
        return this.items;
    }

    toggle(id) {
        const idx = this.items.findIndex(i => i.id === id);
        if (idx === -1) return null;
        const target = this.items[idx];
        target.done = !target.done;
        target.doneAt = target.done ? new Date().toISOString() : null;
        this.save();
        return target;
    }

    getAchievementThresholds() {
        return [25, 50, 75, 100];
    }

    checkNewAchievements(previousDoneCount) {
        const { done } = this.getSummary();
        const unlocked = [];
        for (const t of this.getAchievementThresholds()) {
            if (previousDoneCount < t && done >= t) unlocked.push(t);
        }
        return unlocked;
    }
}

const challenge100Manager = new Challenge100Manager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Challenge100Manager;
}

