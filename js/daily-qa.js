/**
 * AI 每日问答（离线题库 + 可选本地AI评分）
 * - 默认：离线生成同一天同一话题（seed）
 * - 双方回答：用户手动输入
 * - 默契度评分：离线启发式 + 可选本地AI JSON 回填
 */

class DailyQAManager {
    constructor() {
        this.STORAGE_KEY = 'love_daily_qa';
        this.QA_KEY_PREFIX = 'qa_';
        this.topics = [
            `${t('t_edb08e')}？`,
            `${t('t_af352d')}。`,
            `${t('t_f06416')}TA${t('t_fdaffd')}？`,
            `${t('t_ad855f')}？`,
            `${t('t_5da286')}TA${t('t_8e9e10')}？`,
            `${t('t_2a70ec')}？`,
            `${t('t_4bd04c')}TA${t('t_a34d26')}？`,
            `${t('t_ce79d2')}。`,
            `TA${t('t_1d375a')}？`,
            `${t('t_904d9f')}TA${t('t_d76340')}？`,
            `${t('t_975197')}TA${t('t_180206')}？`,
            `${t('t_18e7d8')}？`,
            `${t('t_ca589b')}？`,
            `${t('t_d98765')}？`,
            `TA${t('t_70fa58')}？`,
            `${t('t_b3c0a9')}TA${t('t_763300')}？`,
            `${t('t_d84431')}？`,
            `${t('t_f33f44')}？`,
            `${t('t_2f9135')}TA${t('t_3347ab')}？`,
            `${t('t_582629')}？`,
            `${t('t_1c4f80')}TA${t('t_4e7dc6')}？`
        ];

        this.qaMap = this.loadQA();
    }

    loadQA() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error(`${t('t_2df117')}:`, e);
            return {};
        }
    }

    saveQA() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.qaMap));
            return true;
        } catch (e) {
            console.error(`${t('t_902b78')}:`, e);
            return false;
        }
    }

    getDateKey(date = new Date()) {
        // 使用本地日期，避免 toISOString 带来的时区偏差
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    seedFromString(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (h * 31 + str.charCodeAt(i)) >>> 0;
        }
        return h;
    }

    pickTopicForDate(dateKey) {
        const seed = this.seedFromString(dateKey);
        const idx = seed % this.topics.length;
        return this.topics[idx];
    }

    getTodayQA() {
        const dateKey = this.getDateKey();
        const existing = this.qaMap[dateKey];
        if (existing) return existing;
        return {
            date: dateKey,
            topic: this.pickTopicForDate(dateKey),
            answer1: '',
            answer2: '',
            score: null,
            common: '',
            comparison: '',
            createdAt: null
        };
    }

    saveTodayQA(payload) {
        const dateKey = payload.date;
        this.qaMap[dateKey] = payload;
        return this.saveQA();
    }

    normalizeText(text) {
        if (!text) return '';
        return text
            .toString()
            .replace(/[\\s\\u3000]+/g, '')
            .replace(/[，。！？、,.!?;；:'"“”‘’()（）\\[\\]{}<>《》]/g, '')
            .trim();
    }

    tokenize(text) {
        // 中文启发式：用“去停用词的字符”做 token，确保可用${t('t_50d4a8')}评分
        const t = this.normalizeText(text);
        const stop = new Set([
            '的', '了', '和', '与', '在', '就', '都', '而', '及', '也', '我', '你', '他', '她', '它',
            '是', '在', '对', '给', '想', `${t('t_3d6c39')}`, '今天', `${t('t_8bcbd7')}`, `${t('t_3efffd')}`, `${t('t_ab4a85')}`, '很', '就', '又',
            `${t('t_8b9a14')}`, `${t('t_fae65a')}`, `${t('t_736ccb')}`, `${t('t_cf9e99')}`, `${t('t_5f3cf4')}`, `${t('t_7681c2')}`, '把'
        ]);
        const tokens = [];
        for (let i = 0; i < t.length; i++) {
            const ch = t[i];
            if (!ch) continue;
            if (stop.has(ch)) continue;
            // 过滤数字符号
            if (/\\d/.test(ch)) continue;
            tokens.push(ch);
        }
        return tokens;
    }

    scoreOffline({ topic, answer1, answer2 }) {
        const a1 = this.normalizeText(answer1);
        const a2 = this.normalizeText(answer2);
        if (!a1 && !a2) {
            return { score: 0, common: '', comparison: '' };
        }

        const t1 = this.tokenize(a1);
        const t2 = this.tokenize(a2);

        const set1 = new Set(t1);
        const set2 = new Set(t2);
        const common = [];
        set1.forEach(x => {
            if (set2.has(x)) common.push(x);
        });

        // 共同点少时，给长文本一点优势，但仍保持 0-100
        const overlapRatio = common.length / Math.max(set1.size, set2.size, 1);
        const len1 = a1.length;
        const len2 = a2.length;
        const lenSim = 1 - (Math.abs(len1 - len2) / Math.max(len1, len2, 1));

        // topicBoost：如果 topic 里的少量字也同时出现在双方答案里，适度加分
        const topicTokens = this.tokenize(topic).slice(0, 10);
        let topicHit = 0;
        const setTopic = new Set(topicTokens);
        setTopic.forEach(ch => {
            if (set1.has(ch) && set2.has(ch)) topicHit++;
        });
        const topicBoost = Math.min(0.15, (topicHit / Math.max(setTopic.size, 1)) * 0.15);

        const raw = (overlapRatio * 0.7 + lenSim * 0.3) + topicBoost;
        const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

        const commonPick = common.slice(0, 6).join('、');
        const comparison = commonPick
            ? `${t('t_88f9e4')}：${commonPick}`
            : `${t('t_cbd980')}。`;

        const commonText = commonPick || `${t('t_d324d9')}`;
        return { score, common: commonText, comparison };
    }

    getScoreLabel(score) {
        if (score >= 90) return `${t('t_8900dc')}！💕`;
        if (score >= 75) return `${t('t_0dc032')}！❤️`;
        if (score >= 60) return `${t('t_c6c03b')}！💝`;
        if (score >= 40) return `${t('t_191d34')}。`;
        return `${t('t_2ff746')}。`;
    }

    async scoreWithOptionalLocalAI({ topic, answer1, answer2, useLocalAI = false }) {
        if (!useLocalAI) {
            const offline = this.scoreOffline({ topic, answer1, answer2 });
            return {
                ...offline,
                comparison: `${this.getScoreLabel(offline.score)} ${offline.comparison}`
            };
        }

        try {
            const chat = [
                {
                    role: 'system',
                    content:
                        `${t('t_675be0')} JSON，${t('t_d4f0ef')}。JSON ${t('t_e3127c')}：{"score":0-100,"common":"字符串（共同点关键词）","comparison":"字符串（对比句）"}`
                },
                {
                    role: 'user',
                    content: `${t('t_b00a65')}：${topic}\nTA${t('t_c08a41')}：${answer1}\n${t('t_0cd8ac')}：${answer2}\n${t('t_9e754f')}。`
                }
            ];

            const res = await fetch('http://127.0.0.1:8081/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'qwen/qwen3.5-9b', messages: chat, max_tokens: 120 })
            });

            const d = await res.json();
            const content = d?.choices?.[0]?.message?.content || '';

            // 提取 JSON（允许被包裹在代码块）
            const jsonText = content.replace(/```json|```/g, '').trim();
            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (e) {
                console.warn('JSON parse error:', e);
                const offlineFallback = this.scoreOffline({ topic, answer1, answer2 });
                return {
                    ...offlineFallback,
                    comparison: `${this.getScoreLabel(offlineFallback.score)} ${offlineFallback.comparison}`
                };
            }

            const score = Number(parsed.score);
            const offlineFallback = this.scoreOffline({ topic, answer1, answer2 });

            if (!Number.isFinite(score)) {
                return {
                    ...offlineFallback,
                    comparison: `${this.getScoreLabel(offlineFallback.score)} ${offlineFallback.comparison}`
                };
            }

            return {
                score: Math.max(0, Math.min(100, Math.round(score))),
                common: parsed.common || offlineFallback.common,
                comparison: `${this.getScoreLabel(Math.round(score))} ${parsed.comparison || offlineFallback.comparison}`
            };
        } catch (e) {
            const offline = this.scoreOffline({ topic, answer1, answer2 });
            return {
                ...offline,
                comparison: `${this.getScoreLabel(offline.score)} ${offline.comparison}`
            };
        }
    }
}

// 创建全局实例
const dailyQAManager = new DailyQAManager();

// 导出（给 Node/测试时用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DailyQAManager;
}

