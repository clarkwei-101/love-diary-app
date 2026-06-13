/**
 * 生日祝福特效（Web版）
 * 嚴格按照 birthday-effect-prompt.txt 規格：
 *   階段1：心形96點顯示（1.5秒）
 *   階段2：匯聚到中心（1秒）
 *   階段3：順序顯示所有 TIPS（每條500ms）
 *   階段4：隨機位置彈出（共104個，間隔400ms）
 * TIPS 使用 birthday-effect-prompt.txt 中的完整列表（共27條）。
 */
class BirthdayEffect {
    constructor() {
        this.TIPS = [
            `${t('t_6cdf06')}~`,
            `${t('t_a809fa')}`,
            `${t('t_c260b3')}！`,
            `${t('t_1b33f4')}`,
            `${t('t_b79a07')}）`,
            `${t('t_338fcb')}`,
            `${t('t_a6c82c')}！！`,
            `${t('t_043697')}`,
            `${t('t_13246e')}`,
            `${t('t_5cd000')}9${t('t_c7b539')}`,
            `${t('t_8370d1')}`,
            `${t('t_654e52')}`,
            `${t('t_c5cd63')}`,
            `${t('t_74365a')}`,
            `${t('t_1b0cb2')}`,
            `${t('t_d4fa2f')}！！`,
            `${t('t_c5dc13')}`,
            `${t('t_f6e1c3')}`,
            `${t('t_73a9e9')}🎊`,
            `${t('t_5a19f7')}～🎉`,
            `${t('t_9c5992')}`,
            `${t('t_49a872')}！！`,
            `${t('t_f75eda')}`,
            `call${t('t_19b06a')}`,
            `${t('t_eff691')}9${t('t_ef91e9')}`,
            `${t('t_8d38fa')}`
        ];

        this.BG_COLORS = [
            'lightpink', 'skyblue', 'lightgreen', 'lavender',
            'lightyellow', 'plum', 'coral', 'bisque',
            'aquamarine', 'mistyrose', 'honeydew',
            'lavenderblush', 'oldlace', 'lightcyan', 'peachpuff',
            'lightsteelblue', 'khaki', 'navajowhite'
        ];

        this.W = 280;
        this.H = 80;
        this.NUM_HEART = 96;
        this.NUM_RANDOM = 104;
        this.DURATION_MS = 400;
        this.INTERVAL_MS = 400;
        this.SEQUENTIAL_MS = 500;

        this.container = null;
        this.heartContainer = null;
        this.centerContainer = null;
        this.randomContainer = null;
        this.skipBtn = null;
        this._done = false;
        this._timeouts = [];
    }

    _uid() {
        return 'bde_' + Math.random().toString(36).slice(2);
    }

    _rnd(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    _heartPoints() {
        // 心形参数方程（與 Python 完全一致）
        // x = 16 * sin³(t)
        // y = 13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t)
        const pts = [];
        for (let i = 0; i < this.NUM_HEART; i++) {
            const t = (2 * Math.PI * i) / this.NUM_HEART;
            const x0 = 16 * Math.pow(Math.sin(t), 3);
            const y0 = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            pts.push({ x: x0, y: y0 });
        }

        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const usableW = Math.max(vw - this.W, 1);
        const usableH = Math.max(vh - this.H, 1);
        const scale = Math.min(usableW / (maxX - minX + 0.7), usableH / (maxY - minY + 0.8));

        const heartW = (maxX - minX) * scale;
        const heartH = (maxY - minY) * scale;
        const baseX = (vw - heartW) / 2;
        const baseY = (vh - heartH) / 2;

        const mapped = [];
        const seen = new Set();
        for (const p of pts) {
            const nx = p.x - minX;
            const ny = p.y - minY;
            let px = Math.round(baseX + nx * scale);
            let py = Math.round(baseY + heartH - ny * scale);
            px = Math.max(0, Math.min(px, vw - this.W));
            py = Math.max(0, Math.min(py, vh - this.H));
            const key = `${px},${py}`;
            if (!seen.has(key)) {
                seen.add(key);
                mapped.push({ px, py });
            }
        }

        while (mapped.length < this.NUM_HEART) {
            mapped.push(mapped[mapped.length % mapped.length]);
        }
        return mapped;
    }

    _makeCard(text, extraCls = '') {
        const el = document.createElement('div');
        el.className = `bd-card ${extraCls}`.trim();
        el.textContent = text;
        el.style.background = this._rnd(this.BG_COLORS);
        return el;
    }

    _centerX() { return (window.innerWidth - this.W) / 2; }
    _centerY() { return (window.innerHeight - this.H) / 2; }

    _isMobile() {
        return window.innerWidth < 520 || /Mobi|Android/i.test(navigator.userAgent);
    }

    _cardWH() {
        if (this._isMobile()) {
            return { w: 220, h: 60 };
        }
        return { w: this.W, h: this.H };
    }

    // ──── 階段1：心形 ────
    async _stageHeart() {
        const pts = this._heartPoints();
        const { w, h } = this._cardWH();
        const cx = this._centerX();
        const cy = this._centerY();

        const cards = [];
        for (let i = 0; i < this.NUM_HEART; i++) {
            const pt = pts[i];
            const el = this._makeCard(this._rnd(this.TIPS));
            el.style.position = 'fixed';
            el.style.left = `${pt.px}px`;
            el.style.top = `${pt.py}px`;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.zIndex = '9999';
            el.style.opacity = '0';
            el.style.transform = 'scale(0)';
            el.style.transition = 'none';

            this.heartContainer.appendChild(el);
            cards.push(el);

            // 延迟弹出（与 Python sleep(0.05) 对应）
            await this._delay(50);
            el.style.transition = 'opacity 0.2s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.opacity = '1';
            el.style.transform = 'scale(1)';
        }

        // 等 1.5 秒
        await this._delay(1500);
        return cards;
    }

    // ──── 階段2：匯聚到中心 ────
    async _stageGather(cards) {
        const cx = this._centerX();
        const cy = this._centerY();
        const { w, h } = this._cardWH();

        // 等所有卡片移动完成后再销毁
        const allDone = new Promise(resolve => {
            let remaining = cards.length;
            cards.forEach((el, i) => {
                el.style.transition = 'all 1s ease-in-out';
                el.style.left = `${cx}px`;
                el.style.top = `${cy}px`;
                el.style.opacity = '0';
                el.style.transform = 'scale(0.6)';

                setTimeout(() => {
                    el.remove();
                    remaining--;
                    if (remaining <= 0) resolve();
                }, 1050);
            });
            if (!cards.length) resolve();
        });

        await allDone;
    }

    // ──── 階段3：順序顯示所有 TIPS ────
    async _stageSequential() {
        await this._delay(500);
        const shuffled = this._shuffle(this.TIPS);
        const { w, h } = this._cardWH();
        const cx = this._centerX();
        const cy = this._centerY();

        let currentEl = null;
        for (const tip of shuffled) {
            if (this._done) break;

            if (currentEl) currentEl.remove();
            currentEl = this._makeCard(tip);
            currentEl.style.position = 'fixed';
            currentEl.style.left = `${cx}px`;
            currentEl.style.top = `${cy}px`;
            currentEl.style.width = `${w}px`;
            currentEl.style.height = `${h}px`;
            currentEl.style.zIndex = '9999';
            currentEl.style.opacity = '0';
            currentEl.style.transform = 'scale(0.7)';
            currentEl.style.transition = 'opacity 0.2s, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';

            this.centerContainer.appendChild(currentEl);

            await this._delay(30);
            currentEl.style.opacity = '1';
            currentEl.style.transform = 'scale(1)';

            await this._delay(this.SEQUENTIAL_MS);
        }

        if (currentEl) currentEl.remove();
        await this._delay(500);
    }

    // ──── 階段4：隨機位置彈出 ────
    async _stageRandom() {
        const { w, h } = this._cardWH();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // 生成所有随机坐标
        const positions = [];
        for (let i = 0; i < this.NUM_RANDOM; i++) {
            const x = Math.round(Math.random() * Math.max(vw - w, 0));
            const y = Math.round(Math.random() * Math.max(vh - h, 0));
            positions.push({ x, y });
        }

        const tasks = [];
        for (let i = 0; i < this.NUM_RANDOM; i++) {
            if (this._done) break;
            const pos = positions[i];
            const el = this._makeCard(this._rnd(this.TIPS));
            el.style.position = 'fixed';
            el.style.left = `${pos.x}px`;
            el.style.top = `${pos.y}px`;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.zIndex = '9999';
            el.style.opacity = '0';
            el.style.transform = 'scale(0)';
            el.style.transition = 'none';

            this.randomContainer.appendChild(el);

            // 弹出
            await this._delay(this.INTERVAL_MS);
            if (this._done) break;

            el.style.transition = 'opacity 0.2s, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.opacity = '1';
            el.style.transform = 'scale(1)';

            // 消失
            const t2 = setTimeout(() => {
                if (el.parentNode) {
                    el.style.transition = 'opacity 0.3s, transform 0.3s';
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0.7)';
                    setTimeout(() => el.remove(), 320);
                }
            }, this.DURATION_MS);
            this._timeouts.push(t2);
        }

        // 等待所有随机弹窗结束
        await this._delay(this.NUM_RANDOM * this.INTERVAL_MS + this.DURATION_MS + 600);
    }

    _delay(ms) {
        return new Promise(resolve => {
            const t = setTimeout(resolve, ms);
            this._timeouts.push(t);
        });
    }

    // ──── 主流程 ────
    async start() {
        if (this._done) return;

        // 建立 DOM
        this.container = document.createElement('div');
        this.container.id = 'birthday-effect';
        this.container.innerHTML = `
            <div class="bd-overlay"></div>
            <button class="bd-skip" id="bd-skip-btn">✕</button>
            <div class="bd-heart-container"></div>
            <div class="bd-center-container"></div>
            <div class="bd-random-container"></div>
        `;
        document.body.appendChild(this.container);

        this.heartContainer = this.container.querySelector('.bd-heart-container');
        this.centerContainer = this.container.querySelector('.bd-center-container');
        this.randomContainer = this.container.querySelector('.bd-random-container');

        this.container.querySelector('#bd-skip-btn')?.addEventListener('click', () => this.stop());
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container || e.target.classList.contains('bd-overlay')) {
                this.stop();
            }
        });

        // 播放動畫
        try {
            const cards = await this._stageHeart();
            await this._stageGather(cards);
            await this._stageSequential();
            await this._stageRandom();
        } catch (e) {
            console.error('BirthdayEffect error:', e);
        }

        this.cleanup();
    }

    stop() {
        this._done = true;
        this.cleanup();
    }

    cleanup() {
        this._timeouts.forEach(t => clearTimeout(t));
        this._timeouts = [];
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this._done = true;
    }
}

/**
 * 模板「满屏叠层」：心形 + 汇聚后，多条祝福以全屏层依次叠加，全部出现后一起淡出。
 */
class BirthdayEffectStacked extends BirthdayEffect {
    async _stageStackedFullscreen() {
        const tips = this._shuffle([...this.TIPS]).slice(0, 7);
        const layers = [];
        const root = this.container;

        for (const tip of tips) {
            if (this._done) break;
            const wrap = document.createElement('div');
            wrap.className = 'bd-stack-layer';
            wrap.style.cssText = [
                'position:fixed', 'inset:0',
                `z-index:${10020 + layers.length}`,
                'display:flex', 'align-items:center', 'justify-content:center',
                'padding:24px', 'box-sizing:border-box',
                `background:rgba(18,12,28,${0.35 + layers.length * 0.07})`,
                'backdrop-filter:blur(6px)',
                '-webkit-backdrop-filter:blur(6px)',
                'opacity:0', 'transition:opacity 0.38s ease'
            ].join(';');

            const card = document.createElement('div');
            card.className = 'bd-stack-card';
            card.textContent = tip;
            wrap.appendChild(card);
            root.appendChild(wrap);
            layers.push(wrap);

            await this._delay(40);
            wrap.style.opacity = '1';
            await this._delay(620);
        }

        await this._delay(1600);

        layers.forEach(el => {
            el.style.transition = 'opacity 0.55s ease';
            el.style.opacity = '0';
        });
        await this._delay(580);
        layers.forEach(el => el.remove());
    }

    async start() {
        if (this._done) return;

        this.container = document.createElement('div');
        this.container.id = 'birthday-effect';
        this.container.innerHTML = `
            <div class="bd-overlay"></div>
            <button class="bd-skip" id="bd-skip-btn">✕</button>
            <div class="bd-heart-container"></div>
            <div class="bd-center-container"></div>
            <div class="bd-random-container"></div>
        `;
        document.body.appendChild(this.container);

        this.heartContainer = this.container.querySelector('.bd-heart-container');
        this.centerContainer = this.container.querySelector('.bd-center-container');
        this.randomContainer = this.container.querySelector('.bd-random-container');

        this.container.querySelector('#bd-skip-btn')?.addEventListener('click', () => this.stop());
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container || e.target.classList.contains('bd-overlay')) {
                this.stop();
            }
        });

        try {
            const cards = await this._stageHeart();
            await this._stageGather(cards);
            await this._stageStackedFullscreen();
        } catch (e) {
            console.error('BirthdayEffectStacked error:', e);
        }

        this.cleanup();
    }
}

/** 仅心形 + 汇聚（轻量模板） */
class BirthdayEffectMinimal extends BirthdayEffect {
    async start() {
        if (this._done) return;
        this.container = document.createElement('div');
        this.container.id = 'birthday-effect';
        this.container.innerHTML = `
            <div class="bd-overlay"></div>
            <button class="bd-skip" id="bd-skip-btn">✕</button>
            <div class="bd-heart-container"></div>
            <div class="bd-center-container"></div>
            <div class="bd-random-container"></div>
        `;
        document.body.appendChild(this.container);
        this.heartContainer = this.container.querySelector('.bd-heart-container');
        this.centerContainer = this.container.querySelector('.bd-center-container');
        this.randomContainer = this.container.querySelector('.bd-random-container');
        this.container.querySelector('#bd-skip-btn')?.addEventListener('click', () => this.stop());
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container || e.target.classList.contains('bd-overlay')) this.stop();
        });
        try {
            const cards = await this._stageHeart();
            await this._stageGather(cards);
            await this._delay(800);
        } catch (e) {
            console.error(e);
        }
        this.cleanup();
    }
}

function getBlessingTemplateFromStorage() {
    try {
        const raw = localStorage.getItem('love_llm_settings');
        if (!raw) return 'classic';
        const s = JSON.parse(raw);
        return s.blessingTemplate || 'classic';
    } catch {
        return 'classic';
    }
}

// 全局实例
let birthdayEffectInstance = null;

function showBirthdayEffect() {
    if (birthdayEffectInstance) {
        birthdayEffectInstance.cleanup();
    }
    const tpl = getBlessingTemplateFromStorage();
    if (tpl === 'stacked_fullscreen') {
        birthdayEffectInstance = new BirthdayEffectStacked();
    } else if (tpl === 'minimal_heart') {
        birthdayEffectInstance = new BirthdayEffectMinimal();
    } else {
        birthdayEffectInstance = new BirthdayEffect();
    }
    birthdayEffectInstance.start();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BirthdayEffect;
}
