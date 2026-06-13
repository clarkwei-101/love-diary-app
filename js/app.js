/**
 * 恋爱日记 - 主应用逻辑
 * 负责应用初始化、路由、事件处理、UI更新
 */

/**
 * 启动说明：若仅用 DOMContentLoaded，在部分环境（文档已加载完成、扩展、缓存恢复等）
 * 监听器可能永远不会触发，导致一直卡在启动页。因此同时检查 readyState。
 */
function bootLoveDiary() {
    if (window.__loveDiaryBooted) return;
    window.__loveDiaryBooted = true;
    initApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLoveDiary);
} else {
    bootLoveDiary();
}

/** 兜底：若 4.5 秒后启动页仍在，强制进入（防止任何异常导致永不初始化） */
(function scheduleSplashFailsafe() {
    setTimeout(function loveDiarySplashFailsafe() {
        try {
            const splash = document.getElementById('splash-screen');
            if (!splash || splash.style.display === 'none') return;
            console.warn(`[${t('t_5011b6')}] ${t('t_6313a6')}`);
            if (typeof hideSplashAndEnter === 'function') {
                hideSplashAndEnter();
            }
        } catch (e) {
            console.error('splash failsafe:', e);
        }
    }, 4500);
})();

// ==================== 应用状态 ====================
let currentPage = 'home';
let currentDiaryId = null;
let currentAnniversaryId = null;
let selectedMood = 7; // 默认 😊
let homeTempPhotos = [];
let moodChart = null;
let pieChart = null;

const LOVE_SETTINGS_KEY = 'love_settings';
const LOVE_NAMES_KEY = 'love_names';
const LOVE_START_DATE_KEY = 'love_start_date';
/** LM Studio / 数字人 / TTS / 祝福模板（本地存储） */
const LOVE_LLM_SETTINGS_KEY = 'love_llm_settings';
/** 用户上传的背景音乐（{ id, name, src }，src 为 data URL） */
const LOVE_CUSTOM_MUSIC_KEY = 'love_custom_music_tracks';
/** PIN 锁（本地存储 key） */
const LOVE_PIN_KEY = 'love_pin_code';
/** 生物识别认证配置（本地存储 key） */
const LOVE_BIOMETRIC_KEY = 'love_biometric_enabled';

function defaultLlmSettings() {
    return {
        apiBase: 'http://127.0.0.1:1234/v1/chat/completions',
        model: 'qwen/qwen3.5-9b',
        apiKey: '',
        systemPrompt: `${t('t_14927a')}。`,
        ttsUrl: 'http://127.0.0.1:9880/tts',
        ttsRefAudio: '',
        ttsPromptText: `${t('t_4f65fd')}`,
        blessingTemplate: 'classic'
    };
}

function getLlmSettings() {
    const d = defaultLlmSettings();
    const s = loadJson(LOVE_LLM_SETTINGS_KEY, {});
    return { ...d, ...s };
}

function saveLlmSettings(partial) {
    const cur = getLlmSettings();
    saveJson(LOVE_LLM_SETTINGS_KEY, { ...cur, ...partial });
}

// ==================== PIN 锁 / 生物识别 ====================
let pinLockActive = false;

function isPinLocked() {
    const pin = localStorage.getItem(LOVE_PIN_KEY);
    return !!pin && !pinLockActive;
}

/** 展示 PIN 输入模态框（解锁用） */
function showPinUnlockModal(onSuccess) {
    const pin = localStorage.getItem(LOVE_PIN_KEY);
    if (!pin) return;
    const overlay = document.createElement('div');
    overlay.id = 'pin-unlock-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    overlay.innerHTML = `
        <div style="background:var(--bg-card,#1A1A2E);border-radius:20px;padding:32px 24px;max-width:320px;width:90%;text-align:center;border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:40px;margin-bottom:8px;">🔒</div>
            <h3 style="margin:0 0 4px;font-size:18px;color:var(--text-primary);">${t('t_enterPin') || '输入 PIN 码'}</h3>
            <p style="margin:0 0 20px;font-size:13px;color:var(--text-light,rgba(255,255,255,0.6));">${t('t_enterPinHint') || '输入 PIN 码解锁应用'}</p>
            <div id="pin-dots" style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;"></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:240px;margin:0 auto;">
                ${[1,2,3,4,5,6,7,8,9,'','⌫',0,'✓'].map(n => n === '' ? '<div></div>' :
                    `<button class="pin-key" data-val="${n}" style="height:52px;border-radius:12px;border:none;background:rgba(255,255,255,0.06);color:white;font-size:22px;cursor:pointer;transition:all 0.15s;" aria-label="${n}">${n}</button>`
                ).join('')}
            </div>
            <button id="pin-biometric-btn" style="margin-top:12px;background:none;border:none;color:var(--primary-color,#FF8FB1);cursor:pointer;font-size:13px;display:none;" aria-label="${t('t_useBiometric') || '使用生物识别'}">使用 Face ID / Touch ID</button>
            <p id="pin-error" style="color:#EF4444;font-size:13px;margin-top:10px;display:none;">${t('t_wrongPin') || 'PIN 码错误'}</p>
        </div>`;
    document.body.appendChild(overlay);

    // PIN 码显示点
    const storedPin = localStorage.getItem(LOVE_PIN_KEY);
    let entered = '';
    const dots = overlay.querySelector('#pin-dots');
    function updateDots() {
        dots.innerHTML = Array(4).fill(0).map((_, i) =>
            `<div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--primary-color,#FF8FB1);transition:all 0.15s;${i < entered.length ? 'background:var(--primary-color,#FF8FB1);' : ''}"></div>`
        ).join('');
    }
    updateDots();

    function tryBiometric() {
        if (!window.PublicKeyCredential) return;
        navigator.credentials.get({ publicKey: { challenge: new Uint8Array([1]) } })
            .then(() => pinLockActive = true)
            .catch(() => {});
    }

    // 生物识别按钮
    const bioBtn = overlay.querySelector('#pin-biometric-btn');
    if (localStorage.getItem(LOVE_BIOMETRIC_KEY) === 'true') {
        bioBtn.style.display = 'block';
        bioBtn.addEventListener('click', tryBiometric);
    }

    overlay.querySelectorAll('.pin-key').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.style.transform = 'scale(0.92)';
            setTimeout(() => btn.style.transform = '', 100);
            const val = btn.dataset.val;
            if (val === '⌫') { entered = entered.slice(0, -1); }
            else if (val === '✓') {
                if (entered === storedPin) {
                    overlay.remove();
                    pinLockActive = true;
                    if (onSuccess) onSuccess();
                } else {
                    entered = '';
                    updateDots();
                    overlay.querySelector('#pin-error').style.display = 'block';
                    overlay.querySelector('#pin-error').style.animation = 'shake 0.4s';
                }
            } else if (entered.length < 4) {
                entered += val;
            }
            updateDots();
        });
    });
}

/** 展示 PIN 设置 / 修改模态框 */
function showPinSetupModal(onComplete) {
    let step = 1; // 1=设置, 2=确认
    let firstPin = '';
    let entered = '';
    const overlay = document.createElement('div');
    overlay.id = 'pin-setup-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    overlay.innerHTML = `<div style="background:var(--bg-card,#1A1A2E);border-radius:20px;padding:32px 24px;max-width:320px;width:90%;text-align:center;border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:40px;margin-bottom:8px;">🔐</div>
        <h3 id="pin-setup-title" style="margin:0 0 4px;font-size:18px;color:var(--text-primary);">${t('t_setPin') || '设置 PIN 码'}</h3>
        <p id="pin-setup-subtitle" style="margin:0 0 20px;font-size:13px;color:var(--text-light,rgba(255,255,255,0.6));">${t('t_setPinHint') || '请输入 4 位数字 PIN 码'}</p>
        <div id="pin-setup-dots" style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;"></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:240px;margin:0 auto;">
            ${[1,2,3,4,5,6,7,8,9,'','⌫',0,'✓'].map(n => n === '' ? '<div></div>' :
                `<button class="pin-key-setup" data-val="${n}" style="height:52px;border-radius:12px;border:none;background:rgba(255,255,255,0.06);color:white;font-size:22px;cursor:pointer;transition:all 0.15s;" aria-label="${n}">${n}</button>`
            ).join('')}
        </div>
    </div>`;
    document.body.appendChild(overlay);

    const dots = overlay.querySelector('#pin-setup-dots');
    const title = overlay.querySelector('#pin-setup-title');
    const subtitle = overlay.querySelector('#pin-setup-subtitle');

    function update() {
        dots.innerHTML = Array(4).fill(0).map((_, i) =>
            `<div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--primary-color,#FF8FB1);transition:all 0.15s;${i < entered.length ? 'background:var(--primary-color,#FF8FB1);' : ''}"></div>`
        ).join('');
    }
    update();

    overlay.querySelectorAll('.pin-key-setup').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.style.transform = 'scale(0.92)';
            setTimeout(() => btn.style.transform = '', 100);
            const val = btn.dataset.val;
            if (val === '⌫') { entered = entered.slice(0, -1); }
            else if (val === '✓') {
                if (step === 1) {
                    firstPin = entered;
                    if (firstPin.length !== 4) return;
                    step = 2; entered = '';
                    title.textContent = t('t_confirmPin') || '确认 PIN 码';
                    subtitle.textContent = t('t_confirmPinHint') || '请再次输入 PIN 码';
                } else {
                    if (entered === firstPin) {
                        localStorage.setItem(LOVE_PIN_KEY, entered);
                        pinLockActive = true;
                        overlay.remove();
                        showToast('✅', t('t_pinSetSuccess') || 'PIN 码已设置');
                        initPrivacyToggleState();
                        // 启用数据加密
                        enableEncryption?.();
                        if (onComplete) onComplete();
                    } else {
                        entered = ''; step = 1;
                        title.textContent = t('t_setPin') || '设置 PIN 码';
                        subtitle.textContent = t('t_setPinHint') || '请输入 4 位数字 PIN 码';
                    }
                }
                update();
            } else if (entered.length < 4) {
                entered += val;
            }
            update();
        });
    });
}

/** 初始化隐私设置 UI 状态 */
function initPrivacyToggleState() {
    const pinToggle = document.getElementById('pin-lock-toggle');
    const pinSetupRow = document.getElementById('pin-setup-row');
    const biometricToggle = document.getElementById('biometric-toggle');
    if (!pinToggle) return;
    const hasPin = !!localStorage.getItem(LOVE_PIN_KEY);
    pinToggle.checked = hasPin;
    pinSetupRow.style.display = hasPin ? 'flex' : 'none';
    const bioToggle = biometricToggle;
    if (bioToggle) {
        bioToggle.disabled = !hasPin;
        bioToggle.closest('label').style.opacity = hasPin ? '1' : '0.4';
    }
}

function initPrivacyEvents() {
    const pinToggle = document.getElementById('pin-lock-toggle');
    const changePinBtn = document.getElementById('btn-change-pin');
    const biometricToggle = document.getElementById('biometric-toggle');
    if (pinToggle) {
        pinToggle.addEventListener('change', () => {
            if (pinToggle.checked) {
                showPinSetupModal(() => { pinToggle.checked = true; pinSetupRow?.style && (pinSetupRow.style.display = 'flex'); });
            } else {
                localStorage.removeItem(LOVE_PIN_KEY);
                localStorage.removeItem(LOVE_BIOMETRIC_KEY);
                pinLockActive = false;
                pinSetupRow?.style && (pinSetupRow.style.display = 'none');
                // 禁用数据加密
                disableEncryption?.();
            }
        });
    }
    if (changePinBtn) {
        changePinBtn.addEventListener('click', showPinSetupModal);
    }
    if (biometricToggle) {
        biometricToggle.addEventListener('change', () => {
            localStorage.setItem(LOVE_BIOMETRIC_KEY, biometricToggle.checked ? 'true' : 'false');
        });
    }

    // 通知权限设置
    const notifToggle = document.getElementById('notification-toggle');
    if (notifToggle) {
        notifToggle.checked = localStorage.getItem('love_notification_enabled') === 'true';
        notifToggle.addEventListener('change', async () => {
            if (notifToggle.checked) {
                const perm = await requestNotificationPermission();
                if (perm === 'denied' || perm === 'error') {
                    notifToggle.checked = false;
                    showToast('⚠️', t('t_notificationDenied') || '请在浏览器设置中允许通知');
                    return;
                }
                localStorage.setItem('love_notification_enabled', 'true');
                showToast('✅', t('t_notificationEnabled') || '已开启纪念日提醒');
                updateAppBadge?.();
            } else {
                localStorage.setItem('love_notification_enabled', 'false');
            }
        });
    }
}

// ==================== 初始化 ====================
function hideSplashAndEnter() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    splash.classList.add('fade-out');
    setTimeout(() => {
        splash.style.display = 'none';
        try {
            if (typeof anniversaryManager !== 'undefined' && anniversaryManager.getCoupleInfo()) {
                // PIN 锁：未解锁时先展示解锁界面
                if (isPinLocked()) {
                    showPinUnlockModal(() => {
                        showMainApp();
                        loadHomeData();
                    });
                } else {
                    showMainApp();
                    loadHomeData();
                }
            } else {
                showSetupPage();
            }
        } catch (e) {
            console.error('checkFirstTime error:', e);
            showSetupPage();
        }
    }, 400);
}

function initApp() {
    // 启动页：约 600ms 后淡出，避免长时间 loading；最多 3 秒强制进入
    const minShow = 600;
    const maxWait = 3000;
    let entered = false;
    const go = () => {
        if (entered) return;
        entered = true;
        hideSplashAndEnter();
    };
    setTimeout(go, minShow);
    setTimeout(go, maxWait);

    try {
        bindGlobalEvents();
        updateTheme();
        initPrivacyEvents();
        initPrivacyToggleState();
    } catch (e) {
        console.error(`initApp ${t('t_940294')}/${t('t_7affd6')}:`, e);
    }

    // PWA & 桌面小组件初始化（不影响移动端）
    try {
        initPWA?.();
        initBubbles?.();
        initWidgetToggle?.();
        updateDesktopWidget?.();
        setInterval(() => updateDesktopWidget?.(), 60000);
    } catch (e) {}

    // 增强功能初始化（节日/音乐/照片特效/暖心文案）
    try {
        initEnhancedFeatures();
    } catch (e) {
        console.error(`${t('t_2fafad')}:`, e);
    }
}

// ==================== 首次使用检查 ====================
function checkFirstTime() {
    try {
        const coupleInfo = typeof anniversaryManager !== 'undefined' ? anniversaryManager.getCoupleInfo() : null;
        if (!coupleInfo) {
            showSetupPage();
        } else {
            showMainApp();
            loadHomeData();
        }
    } catch (e) {
        console.error('checkFirstTime:', e);
        showSetupPage();
    }
}

function showSetupPage() {
    document.getElementById('setup-page').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    
    // 绑定设置表单事件
    bindSetupEvents();
}

function showMainApp() {
    document.getElementById('setup-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    // 更新头部信息
    updateHeaderInfo();
    updateDesktopWidget?.();

    // 若设置中已开启背景音乐，尝试自动播放（需等待用户首次交互以绕过浏览器自动播放限制）
    const settings = loadJson(LOVE_SETTINGS_KEY, {});
    if (settings.musicOn) {
        if (document.body.dataset.userInteracted === 'true') {
            startBackgroundMusic();
        } else {
            // 等待首次交互后再播放
            const tryAutoPlay = () => {
                document.body.dataset.userInteracted = 'true';
                if (loadJson(LOVE_SETTINGS_KEY, {}).musicOn) startBackgroundMusic();
                ['click', 'touchstart', 'keydown'].forEach(evt => document.removeEventListener(evt, tryAutoPlay));
            };
            ['click', 'touchstart', 'keydown'].forEach(evt => document.addEventListener(evt, tryAutoPlay, { once: true }));
        }
    }
}

// ==================== 设置页事件 ====================
function bindSetupEvents() {
    const form = document.getElementById('setup-form');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    let selectedAvatar = '1';
    
    // 头像选择
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedAvatar = option.dataset.avatar;
        });
    });
    
    // 表单提交
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name1 = document.getElementById('user1-name').value.trim();
        const name2 = document.getElementById('user2-name').value.trim();
        const startDate = document.getElementById('love-start-date').value;
        
        if (!name1 || !name2 || !startDate) {
            showToast(t('fillAnniversaryInfo'), '⚠️');
            return;
        }
        
        const avatars = {
            '1': '🧑‍🤝‍🧑', '2': '👩‍❤️‍👨', '3': '👨‍❤️‍👨',
            '4': '👩‍❤️‍👩', '5': '💑', '6': '👫'
        };
        
        const coupleInfo = {
            name1,
            name2,
            startDate,
            avatar: avatars[selectedAvatar]
        };
        
        anniversaryManager.saveCoupleInfo(coupleInfo);
        syncLoveKeysFromCoupleInfo();
        showMainApp();
        loadHomeData();
        showToast(t('setupSuccess'), '✅');
    });
    
    // 默认选择今天之前的日期
    const dateInput = document.getElementById('love-start-date');
    const today = new Date();
    today.setDate(today.getDate() - 1);
    dateInput.value = today.toISOString().split('T')[0];
    dateInput.max = new Date().toISOString().split('T')[0];
}

// ==================== 全局事件绑定 ====================
function bindGlobalEvents() {
    // 底部导航
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            switchPage(page);
            updateNavActive(page);
        });
    });
    
    // 返回按钮
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            const backPage = btn.dataset.back;
            switchPage(backPage);
            if (backPage === 'home') {
                updateNavActive('home');
            } else if (backPage === 'diary' || backPage === 'anniversary') {
                updateNavActive('home');
            } else {
                updateNavActive(backPage);
            }
        });
    });
    
    // 页面跳转按钮
    document.querySelectorAll('[data-page]').forEach(el => {
        if (!el.classList.contains('nav-item')) {
            el.addEventListener('click', () => {
                const page = el.dataset.page;
                switchPage(page);
                updateNavActive(page);
            });
        }
    });
    
    // 写日记按钮
    document.getElementById('btn-new-diary')?.addEventListener('click', () => {
        openDiaryEditor();
    });
    
    document.getElementById('btn-first-diary')?.addEventListener('click', () => {
        openDiaryEditor();
    });
    
    // 保存日记
    document.getElementById('btn-save-diary')?.addEventListener('click', saveDiary);
    
    // 照片上传
    document.getElementById('btn-add-photo')?.addEventListener('click', () => {
        document.getElementById('photo-input').click();
    });
    
    document.getElementById('photo-input')?.addEventListener('change', handlePhotoSelect);

    // ========= 首页小日记（今日文字日记 + 照片上传） =========
    document.getElementById('btn-add-home-photo')?.addEventListener('click', () => {
        document.getElementById('home-photo-input')?.click();
    });
    document.getElementById('home-photo-input')?.addEventListener('change', async (e) => {
        await handleHomePhotoSelect(e);
    });
    document.getElementById('btn-save-home-diary')?.addEventListener('click', saveHomeDiary);
    
    // 日记心情选择
    document.querySelectorAll('#page-diary-edit .mood-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('#page-diary-edit .mood-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedMood = parseInt(option.dataset.mood);
        });
    });
    
    // 首页心情选择
    document.querySelectorAll('.mood-card .mood-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.mood-card .mood-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            const mood = option.dataset.mood;
            selectedMood = parseInt(mood);
            document.getElementById('mood-text').textContent = diaryManager.getMoodText(mood);
        });
    });
    
    // 添加纪念日
    document.getElementById('btn-new-anniversary')?.addEventListener('click', () => {
        openAnniversaryEditor();
    });
    
    // 保存纪念日
    document.getElementById('btn-save-anniversary')?.addEventListener('click', saveAnniversary);
    
    // 纪念日类型选择
    document.querySelectorAll('.type-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // 提醒选项选择
    document.querySelectorAll('.remind-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.remind-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // 测试相关
    document.getElementById('btn-start-quiz')?.addEventListener('click', startQuiz);
    document.getElementById('btn-retry-quiz')?.addEventListener('click', startQuiz);

    // 年度回顾选择年份
    document.getElementById('annual-year-select')?.addEventListener('change', loadStats);

    // 生日祝福特效按钮
    document.getElementById('btn-birthday-effect')?.addEventListener('click', () => {
        showBirthdayEffect();
    });

    // ========= 游戏页：AI每日问答 =========
    document.getElementById('btn-daily-qa-submit')?.addEventListener('click', async () => {
        await submitDailyQA();
    });

    // ========= 游戏页：一起做的100件事 =========
    document.getElementById('c100-list')?.addEventListener('change', (e) => {
        const target = e.target;
        if (!target || target.tagName !== 'INPUT' || !target.dataset || !target.dataset.c100Id) return;
        handleChallengeToggle(target.dataset.c100Id);
    });

    // ========= 实时聊天页 =========
    document.getElementById('btn-send-realtime-message')?.addEventListener('click', sendRealtimeChatMessage);
    document.getElementById('btn-chat-clear')?.addEventListener('click', () => {
        showConfirm(t('clearChatConfirm'), () => {
            clearRealtimeChat();
            showToast(t('chatCleared'), '🗑️');
        });
    });
    document.getElementById('chat-realtime-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendRealtimeChatMessage();
        }
    });

    // ========= 相册页 =========
    document.getElementById('btn-upload-photo')?.addEventListener('click', () => {
        document.getElementById('photo-album-input')?.click();
    });
    document.getElementById('photo-album-input')?.addEventListener('change', handlePhotoAlbumUpload);
    document.getElementById('btn-add-photo-url')?.addEventListener('click', addPhotoByUrl);

    // ========= 账单页 =========
    document.getElementById('btn-add-bill')?.addEventListener('click', addBillRecord);
    document.getElementById('btn-vault-deposit')?.addEventListener('click', depositVault);
    document.getElementById('btn-vault-withdraw')?.addEventListener('click', withdrawVault);

    // ========= 愿望页 =========
    document.getElementById('btn-add-wish')?.addEventListener('click', addWish);
    document.getElementById('wish-list')?.addEventListener('change', (e) => {
        const t = e.target;
        if (!t || t.tagName !== 'INPUT' || !t.dataset || !t.dataset.wishId) return;
        toggleWishDone(t.dataset.wishId, t.checked);
    });
    
    // 设置相关
    document.getElementById('btn-export-data')?.addEventListener('click', exportData);
    document.getElementById('btn-export-txt')?.addEventListener('click', exportDataAsTxt);
    document.getElementById('btn-export-html')?.addEventListener('click', exportDataAsHtml);
    document.getElementById('btn-export-zip')?.addEventListener('click', () => exportDataAsZip());
    document.getElementById('btn-import-data')?.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input')?.addEventListener('change', importData);
    document.getElementById('btn-clear-data')?.addEventListener('click', clearAllData);

    // 语言切换
    document.getElementById('language-select')?.addEventListener('change', (e) => {
        setLocale(e.target.value);
        showToast(t('settingsSaved') || '设置已保存', '✅');
    });

    bindLlmSettingsEvents();
    
    // 主题颜色选择
    document.querySelectorAll('.theme-color-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.theme-color-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            
            const primary = option.dataset.primary;
            const secondary = option.dataset.secondary;
            
            // 更新CSS变量
            document.documentElement.style.setProperty('--primary-color', primary);
            document.documentElement.style.setProperty('--primary-light', adjustColor(primary, 30));
            document.documentElement.style.setProperty('--secondary-color', secondary);
            document.documentElement.style.setProperty('--shadow-color', primary);
            
            localStorage.setItem('love_theme_color', JSON.stringify({
                primary: primary,
                secondary: secondary
            }));
        });
    });
    
    // 背景图案选择
    document.querySelectorAll('.bg-pattern-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.bg-pattern-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            
            const pattern = option.dataset.pattern;
            
            // 移除所有旧的背景类
            const appContainer = document.querySelector('.main-content');
            if (appContainer) {
                appContainer.className = 'main-content';
                if (pattern && pattern !== 'none') {
                    appContainer.classList.add('bg-' + pattern);
                }
            }
            
            document.documentElement.setAttribute('data-bg-pattern', pattern);
            localStorage.setItem('love_bg_pattern', pattern);
        });
    });
    
    // 自定义背景上传
    document.getElementById('custom-bg-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                document.documentElement.setAttribute('data-custom-bg', dataUrl);
                localStorage.setItem('love_custom_bg', dataUrl);
                
                // 显示预览
                const preview = document.getElementById('custom-bg-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${dataUrl}" alt="自定义背景">`;
                }
            };
            reader.readAsDataURL(file);
        }
    });
    
    // 背景动画开关
    document.getElementById('bg-animation-toggle')?.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-bg-animation', e.target.checked ? 'true' : 'false');
        localStorage.setItem('love_bg_animation', e.target.checked ? 'true' : 'false');
    });
    
    // 设置输入监听
    document.getElementById('setting-name1')?.addEventListener('change', updateSettings);
    document.getElementById('setting-name2')?.addEventListener('change', updateSettings);
    document.getElementById('setting-date')?.addEventListener('change', updateSettings);

    // 头像上传 & 背景音乐开关
    document.getElementById('avatar-upload-input')?.addEventListener('change', handleAvatarUpload);
    document.getElementById('music-toggle')?.addEventListener('change', (e) => {
        toggleBackgroundMusic(e.target.checked);
    });

    // 音乐控制按钮
    document.getElementById('music-control-btn')?.addEventListener('click', toggleMusicPanel);
    document.getElementById('music-panel-close')?.addEventListener('click', closeMusicPanel);

    // 音量控制
    document.getElementById('music-volume-slider')?.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        if (bgMusicState.audio) {
            bgMusicState.audio.volume = volume / 100;
        }
        document.getElementById('volume-value').textContent = volume + '%';
        localStorage.setItem('music_volume', volume);
    });

    // 自动节日主题
    document.getElementById('auto-holiday-toggle')?.addEventListener('change', (e) => {
        const settings = loadJson(LOVE_SETTINGS_KEY, {});
        settings.autoHoliday = !!e.target.checked;
        localStorage.setItem(LOVE_SETTINGS_KEY, JSON.stringify(settings));
        if (settings.autoHoliday) applyHolidayTheme();
        else removeHolidayTheme();
    });

    // 情人节日期
    document.getElementById('valentine-date')?.addEventListener('change', (e) => {
        const settings = loadJson(LOVE_SETTINGS_KEY, {});
        settings.valentineDate = e.target.value || null;
        localStorage.setItem(LOVE_SETTINGS_KEY, JSON.stringify(settings));
        applyHolidayTheme();
    });
    
    // 模态框关闭
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', closeModal);
    });
    
    // 确认对话框
    document.getElementById('confirm-cancel')?.addEventListener('click', closeModal);
}

// ==================== 页面切换 ====================
let _pageLoadingTimer = null;

function showPageLoading() {
    let el = document.getElementById('page-loading-indicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'page-loading-indicator';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-label', '加载中');
        el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9998;width:40px;height:40px;';
        el.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
            <circle cx="20" cy="20" r="17" fill="none" stroke="#FF8FB1" stroke-width="3" stroke-linecap="round"
                stroke-dasharray="26 80" style="transform-origin:center;animation:pageLoaderSpin 0.9s linear infinite"/>
        </svg>
        <style>@keyframes pageLoaderSpin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(el);
    }
    el.style.display = 'block';
}

function hidePageLoading() {
    const el = document.getElementById('page-loading-indicator');
    if (el) el.style.display = 'none';
}

function switchPage(page) {
    // 显示加载指示器（仅当切换耗时长时，200ms 后才显示避免闪烁）
    _pageLoadingTimer = setTimeout(showPageLoading, 200);

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // 显示目标页面
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = page;
        
        // 页面特定的初始化
        if (page === 'home') loadHomeData();
        else if (page === 'diary') loadDiaryList();
        else if (page === 'anniversary') loadAnniversaryList();
        else if (page === 'stats') loadStats();
        else if (page === 'settings') loadSettings();
        else if (page === 'quiz') loadGamePage();
        else if (page === 'photo') loadPhotoPage();
        else if (page === 'bill') loadBillPage();
        else if (page === 'wishes') loadWishesPage();
        else if (page === 'summary') loadAnnualSummary();
        // 新增页面初始化
        else if (page === 'matching') loadMatchingPage();
        else if (page === 'calendar') initCoupleCalendar();
        else if (page === 'plan') initDailyPlan();
        else if (page === 'activity') initActivityReport();
        else if (page === 'location') initLocationModule();
        else if (page === 'music') initMusicSync();
        else if (page === 'chat-realtime') initRealtimeChat();
        else if (page === 'pet') initPetModule();
        else if (page === 'decorate') initDecorateModule();
        else if (page === 'mood-room') initMoodRoomModule();
        else if (page === 'couple-task') initCoupleTaskModule();
        else if (page === 'kiss') initKissModule();
    }

    // 隐藏加载指示器
    clearTimeout(_pageLoadingTimer);
    hidePageLoading();

    // 滚动到顶部
    document.querySelector('.main-content')?.scrollTo(0, 0);
}

function updateNavActive(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
}

// ==================== 更新头部信息 ====================
function updateHeaderInfo() {
    const coupleInfo = anniversaryManager.getCoupleInfo();
    if (!coupleInfo) return;
    
    document.getElementById('display-name1').textContent = coupleInfo.name1;
    document.getElementById('display-name2').textContent = coupleInfo.name2;

    const avatarEl = document.getElementById('couple-avatar');
    const avatar = coupleInfo.avatar || '🧑‍🤝‍🧑';
    if (avatarEl) {
        if (typeof avatar === 'string' && (avatar.startsWith('data:image/') || avatar.startsWith('http'))) {
            const img = document.createElement('img');
            img.src = avatar;
            img.alt = t('t_4c50ee');
            avatarEl.innerHTML = '';
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = avatar;
        }
    }
    
    // 更新恋爱天数
    const days = anniversaryManager.getLoveDays();
    document.getElementById('love-days').textContent = days;
}

// ==================== 首页数据加载 ====================
function loadHomeData() {
    updateHeaderInfo();
    
    // 今日话题
    const topic = diaryManager.getDailyTopic();
    document.getElementById('daily-topic').textContent = topic;
    document.getElementById('topic-date').textContent = new Date().toLocaleDateString('zh-CN', {
        month: 'long', day: 'numeric', weekday: 'short'
    });

    // 默认选中当前心情（对应首页必须可用）
    document.querySelectorAll('.mood-card .mood-option').forEach(o => {
        o.classList.toggle('selected', parseInt(o.dataset.mood || '0') === selectedMood);
    });
    const moodTextEl = document.getElementById('mood-text');
    if (moodTextEl) moodTextEl.textContent = diaryManager.getMoodText(selectedMood);

    // 统计面板
    const diaryCountEl = document.getElementById('home-stat-diary-count');
    const moodDistEl = document.getElementById('home-mood-dist');
    const subEl = document.getElementById('home-stat-sub');
    const diaryCount = diaryManager.getDiaryCount();
    if (diaryCountEl) diaryCountEl.textContent = diaryCount;

    if (moodDistEl) {
        const stats = diaryManager.getMoodStats();
        const entries = Object.entries(stats)
            .map(([m, v]) => ({ mood: parseInt(m), count: v }))
            .sort((a, b) => b.count - a.count);

        if (!entries.length) {
            moodDistEl.innerHTML = `<span class="text-subtle">${t('moodDataEmpty')}</span>`;
        } else {
            moodDistEl.innerHTML = entries
                .slice(0, 7)
                .map(e => `<span class="mood-chip">${diaryManager.getMoodEmoji(e.mood)}${e.count}次</span>`)
                .join('');
        }
    }
    if (subEl) subEl.textContent = t('autoUpdated');
    
    // 加载最近日记
    loadRecentDiaries();
    
    // 加载即将到来的纪念日
    loadUpcomingAnniversaries();
}

function loadRecentDiaries() {
    const container = document.getElementById('recent-diaries-list');
    const diaries = diaryManager.getRecentDiaries(3);
    
    if (diaries.length === 0) {
        container.innerHTML = emptyStateHtml(
            'empty-diary',
            t('noDiary') || '还没有日记',
            t('t_writeFirstHint') || '记录你们的故事，留住美好回忆',
            null, null
        );
        return;
    }
    
    container.innerHTML = diaries.map(diary => `
        <div class="diary-item" onclick="viewDiary('${diary.id}')">
            <div class="diary-mood">${diaryManager.getMoodEmoji(diary.mood)}</div>
            <div class="diary-preview">
                <h4>${diaryManager.formatDate(diary.date)}</h4>
                <p>${diaryManager.getExcerpt(diary.content)}</p>
            </div>
            <div class="diary-date">
                <span class="day">${new Date(diary.date).getDate()}</span>
                <span>${new Date(diary.date).getMonth() + 1}月</span>
            </div>
        </div>
    `).join('');
}

function loadUpcomingAnniversaries() {
    const container = document.getElementById('upcoming-list');
    const upcoming = anniversaryManager.getUpcomingAnniversaries(3);
    
    if (upcoming.length === 0) {
        container.innerHTML = emptyStateHtml(
            'empty-anniversary',
            t('noAnniversary') || '还没有设置纪念日',
            t('t_addAnniversaryHint') || '记录你们的重要日子，不错过每一个甜蜜时刻',
            null, null
        );
        return;
    }
    
    container.innerHTML = upcoming.map(anni => `
        <div class="anniversary-item">
            <div class="anniversary-icon">${anniversaryManager.getTypeIcon(anni.type)}</div>
            <div class="anniversary-info">
                <h4>${anni.title}</h4>
                <p>${anniversaryManager.formatDate(anni.nextDate || anni.date)}</p>
            </div>
            <div class="anniversary-countdown">
                <span class="days">${anni.daysLeft}</span>
                <span class="label">天</span>
            </div>
        </div>
    `).join('');
}

// ==================== 日记相关 ====================
/** 生成带插画 SVG 的空状态 HTML */
function emptyStateHtml(iconId, title, sub, btnText, btnId) {
    const btn = btnText ? `<button class="btn-primary" id="${btnId || ''}">${btnText}</button>` : '';
    return `<div class="empty-state large">
        <span class="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
                <use href="#${iconId}"/>
            </svg>
        </span>
        <p>${title}</p>
        ${sub ? `<span class="empty-sub">${sub}</span>` : ''}
        ${btn}
    </div>`;
}

function loadDiaryList() {
    const container = document.getElementById('diary-list');
    const diaries = diaryManager.getAllDiaries();

    if (diaries.length === 0) {
        container.innerHTML = emptyStateHtml(
            'empty-diary',
            t('noDiary') || '还没有日记，写第一篇吧！',
            t('t_writeFirstHint') || '记录你们的故事，留住美好回忆',
            t('t_writeFirst') || '✏️ 写日记',
            'btn-first-diary'
        );
        document.getElementById('btn-first-diary')?.addEventListener('click', () => {
            openDiaryEditor();
        });
        return;
    }
    
    container.innerHTML = diaries.map(diary => `
        <div class="diary-card">
            <div class="diary-card-header">
                <div class="diary-card-mood">${diaryManager.getMoodEmoji(diary.mood)}</div>
                <div class="diary-card-date">
                    <div class="date-main">${diaryManager.formatFullDate(diary.date)}</div>
                    <div class="date-sub">${t('t_ba89e6')}值: ${diary.mood}/7</div>
                </div>
                <div class="diary-card-actions">
                    <button onclick="editDiary('${diary.id}')" title="${t('t_95b351')}">✏️</button>
                    <button onclick="deleteDiary('${diary.id}')" title="${t('t_2f4aad')}">🗑️</button>
                </div>
            </div>
            ${diary.content ? `<div class="diary-card-content">${escapeHtml(diary.content)}</div>` : ''}
            ${diary.photos?.length ? `
                <div class="diary-card-photos">
                    ${diary.photos.map(photo => `
                        <img src="${photo}" alt="${t('t_d2fb1e')}" onclick="previewImage('${photo}')">
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

function openDiaryEditor(diaryId = null) {
    currentDiaryId = diaryId;
    const title = diaryId ? `${t('t_50374b')}` : `${t('t_d26512')}`;
    document.getElementById('diary-edit-title').textContent = title;
    
    // 重置表单
    document.getElementById('diary-content').value = '';
    document.getElementById('photo-preview-list').innerHTML = '';
    diaryManager.tempPhotos = [];
    
    // 默认选中心情7（😊）
    selectedMood = 7;
    document.querySelectorAll('#page-diary-edit .mood-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.mood === '7');
    });
    
    // 如果是编辑，加载数据
    if (diaryId) {
        const diary = diaryManager.getDiaryById(diaryId);
        if (diary) {
            document.getElementById('diary-content').value = diary.content || '';
            selectedMood = diary.mood || 7;
            document.querySelectorAll('#page-diary-edit .mood-option').forEach(o => {
                o.classList.toggle('selected', o.dataset.mood === selectedMood.toString());
            });
            
            if (diary.photos?.length) {
                diaryManager.tempPhotos = [...diary.photos];
                updatePhotoPreview();
            }
        }
    }
    
    // 设置日期显示
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('editor-date-display').textContent = diaryManager.formatFullDate(today);
    
    switchPage('diary-edit');
}

function editDiary(id) {
    openDiaryEditor(id);
}

function viewDiary(id) {
    // 可以扩展为查看详情页
    editDiary(id);
}

function deleteDiary(id) {
    showConfirm(t('deleteDiaryConfirm'), () => {
        if (diaryManager.deleteDiary(id)) {
            showToast(t('diaryDeleted'), '🗑️');
            loadDiaryList();
            loadRecentDiaries();
        }
    });
}

async function handlePhotoSelect(e) {
    const files = e.target.files;
    if (!files.length) return;
    
    const photos = await diaryManager.handlePhotoUpload(files);
    diaryManager.tempPhotos.push(...photos);
    updatePhotoPreview();
    
    // 清空 input 以便重复选择相同文件
    e.target.value = '';
}

function updatePhotoPreview() {
    const container = document.getElementById('photo-preview-list');
    container.innerHTML = diaryManager.tempPhotos.map((photo, index) => `
        <div class="photo-preview">
            <img src="${photo}" alt="${t('t_645dbc')}">
            <button class="remove-photo" onclick="removePhoto(${index})">&times;</button>
        </div>
    `).join('');
}

function removePhoto(index) {
    diaryManager.tempPhotos.splice(index, 1);
    updatePhotoPreview();
}

function saveDiary() {
    const content = document.getElementById('diary-content').value.trim();
    const today = new Date().toISOString().split('T')[0];
    
    const diaryData = {
        id: currentDiaryId,
        date: today,
        content,
        mood: selectedMood,
        photos: diaryManager.tempPhotos
    };
    
    if (diaryManager.saveDiary(diaryData)) {
        showToast(t('diarySaved'), '✅');
        switchPage('diary');
        loadDiaryList();
        loadRecentDiaries();
    } else {
        showToast(t('saveFailed'), '❌');
    }
}

// ==================== 首页小日记（与核心要求对齐） ====================
async function handleHomePhotoSelect(e) {
    const files = e.target.files;
    if (!files || !files.length) return;

    const photos = await diaryManager.handlePhotoUpload(files);
    homeTempPhotos.push(...photos);
    updateHomePhotoPreview();

    e.target.value = '';
}

function updateHomePhotoPreview() {
    const container = document.getElementById('home-photo-preview-list');
    if (!container) return;

    container.innerHTML = homeTempPhotos.map((photo, index) => `
        <div class="photo-preview">
            <img src="${photo}" alt="${t('t_645dbc')}">
            <button class="remove-photo" onclick="removeHomePhoto(${index})">&times;</button>
        </div>
    `).join('');
}

function removeHomePhoto(index) {
    homeTempPhotos.splice(index, 1);
    updateHomePhotoPreview();
}

function saveHomeDiary() {
    const contentEl = document.getElementById('home-diary-content');
    const content = contentEl?.value?.trim() || '';
    const today = new Date().toISOString().split('T')[0];

    const existing = diaryManager.getDiaryByDate(today);
    const diaryData = {
        id: existing?.id || null,
        date: today,
        content,
        mood: selectedMood,
        photos: homeTempPhotos
    };

    if (diaryManager.saveDiary(diaryData)) {
        homeTempPhotos = [];
        updateHomePhotoPreview();
        contentEl.value = '';
        showToast(t('todayDiarySaved'), '✅');
        loadHomeData();
        loadRecentDiaries();
    } else {
        showToast(t('saveFailed'), '❌');
    }
}


// ==================== 纪念日相关 ====================
function loadAnniversaryList() {
    // 更新时间轴
    const timeline = anniversaryManager.getTimeline();
    const timelineEl = document.getElementById('love-timeline');
    
    const coupleInfo = anniversaryManager.getCoupleInfo();
    if (coupleInfo) {
        document.getElementById('timeline-start-date').textContent = 
            anniversaryManager.formatDate(coupleInfo.startDate);
    }
    
    // 时间轴项目
    const timelineHTML = timeline.slice(1).map(item => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <span class="timeline-date">${anniversaryManager.formatDate(item.date)}</span>
                <p class="timeline-title">${item.title}</p>
            </div>
        </div>
    `).join('');
    
    timelineEl.innerHTML = timelineEl.innerHTML.split('</div>').slice(0, 2).join('</div>') + '</div>' + timelineHTML;
    
    // 加载纪念日列表
    const container = document.getElementById('anniversary-list');
    const upcoming = anniversaryManager.getUpcomingAnniversaries(20);
    
    // 过滤掉系统生成的，只显示用户自定义的
    const userAnnis = upcoming.filter(a => !a.isSystem);
    
    if (userAnnis.length === 0) {
        container.innerHTML = emptyStateHtml(
            'empty-anniversary',
            t('noCustomAnniversary') || '还没有自定义纪念日',
            t('t_addAnniversaryHint') || '点击上方添加你们的纪念日',
            null, null
        );
        return;
    }
    
    container.innerHTML = userAnnis.map(anni => `
        <div class="anniversary-full-item" data-id="${anni.id}">
            <div class="icon">${anniversaryManager.getTypeIcon(anni.type)}</div>
            <div class="info">
                <h4>${anni.title}</h4>
                <p>${anniversaryManager.formatDate(anni.date)} · ${anniversaryManager.getTypeName(anni.type)}</p>
            </div>
            <div class="days-left">
                <div class="num">${anni.daysLeft}</div>
                <div class="text">天</div>
            </div>
            <button onclick="deleteAnniversary('${anni.id}')" style="background:none;border:none;font-size:18px;color:#999;margin-left:8px;">🗑️</button>
        </div>
    `).join('');
}

function openAnniversaryEditor(anniversaryId = null) {
    currentAnniversaryId = anniversaryId;
    
    // 重置表单
    document.getElementById('anniversary-title').value = '';
    document.getElementById('anniversary-date').value = '';
    
    // 默认选择
    document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.type-option[data-type="date"]')?.classList.add('selected');
    document.querySelectorAll('.remind-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.remind-option[data-days="0"]')?.classList.add('selected');
    
    // 设置日期默认为今天
    document.getElementById('anniversary-date').value = new Date().toISOString().split('T')[0];
    
    switchPage('anniversary-edit');
}

function saveAnniversary() {
    const title = document.getElementById('anniversary-title').value.trim();
    const date = document.getElementById('anniversary-date').value;
    const typeEl = document.querySelector('.type-option.selected');
    const remindEl = document.querySelector('.remind-option.selected');
    
    if (!title || !date) {
        showToast(t('fillAnniversaryInfo'), '⚠️');
        return;
    }
    
    const anniversaryData = {
        title,
        date,
        type: typeEl?.dataset.type || 'date',
        remindDays: parseInt(remindEl?.dataset.days || 0)
    };
    
    if (currentAnniversaryId) {
        anniversaryManager.updateAnniversary(currentAnniversaryId, anniversaryData);
    } else {
        anniversaryManager.addAnniversary(anniversaryData);
    }
    
    showToast(t('anniversarySaved'), '✅');
    switchPage('anniversary');
    loadAnniversaryList();
}

function deleteAnniversary(id) {
    showConfirm(t('deleteAnniversaryConfirm'), () => {
        if (anniversaryManager.deleteAnniversary(id)) {
            showToast(t('deleted'), '🗑️');
            loadAnniversaryList();
        }
    });
}

// ==================== 默契测试 ====================
const quizQuestions = [
    {
        question: `${t('t_68ffc3')}？`,
        options: [`${t('t_3a864e')}`, `${t('t_860176')}`, `${t('t_7dd7fb')}`, `${t('t_8f5324')}`],
        correct: 0 // 随机生成正确答案，这里只是占位
    },
    {
        question: `TA${t('t_b0d6fe')}？`,
        options: [`${t('t_975423')}/${t('t_526365')}`, `${t('t_9c9aab')}/${t('t_b2c712')}`, `${t('t_2fc96b')}/${t('t_9d2d1f')}`, `${t('t_e1e14b')}/${t('t_ddb86d')}`],
        correct: 0
    },
    {
        question: `${t('t_d4303c')}？`,
        options: [`${t('t_4a1636')}`, `${t('t_a67e39')}/${t('t_86a951')}`, `${t('t_249bdd')}/${t('t_0410d2')}`, `${t('t_861f5f')}/${t('t_32c3a8')}`],
        correct: 0
    },
    {
        question: `TA${t('t_7951ba')}？`,
        options: [`${t('t_bfdcdb')}/${t('t_daa6cf')}`, `${t('t_b74288')}/${t('t_f0d694')}`, `${t('t_ee489f')}/${t('t_3adfd9')}`, `${t('t_2eae4b')}`],
        correct: 0
    },
    {
        question: `${t('t_ebd278')}？`,
        options: [`${t('t_78623e')}`, `${t('t_47ad1a')}`, `${t('t_38349d')}`, `${t('t_9a60ba')}`],
        correct: 0
    },
    {
        question: `TA${t('t_4a7f86')}？`,
        options: [`${t('t_a74c80')}`, `${t('t_f3f3f7')}/${t('t_47b21b')}`, `${t('t_995c57')}`, `${t('t_66de78')}`],
        correct: 0
    },
    {
        question: `${t('t_5a3240')}？`,
        options: [`${t('t_2d41be')}/${t('t_5b23de')}`, `聊天/${t('t_e4bdce')}`, `${t('t_54b670')}/${t('t_9acf9c')}`, `${t('t_7f2e3e')}/${t('t_9a018b')}`],
        correct: 0
    },
    {
        question: `TA${t('t_f4407d')}？`,
        options: [`${t('t_65771d')}`, `${t('t_d41e44')}`, `${t('t_0919c3')}`, `${t('t_23c22f')}`],
        correct: 0
    },
    {
        question: `${t('t_95abba')}？`,
        options: [`${t('t_95521b')}/${t('t_d49c9b')}`, `${t('t_37b6de')}/${t('t_c24d6f')}`, `${t('t_874834')}/${t('t_fc6c4c')}`, `${t('t_c89227')}/${t('t_c5df2d')}`],
        correct: 0
    },
    {
        question: `TA${t('t_db1127')}？`,
        options: [`${t('t_4f2016')}`, `${t('t_e2b88b')}`, `${t('t_554aa2')}`, `${t('t_a93fd9')}`],
        correct: 0
    }
];

let currentQuizIndex = 0;
let quizScore = 0;
let currentQuizAnswers = [];

function resetQuiz() {
    document.getElementById('quiz-start').classList.remove('hidden');
    document.getElementById('quiz-game').classList.add('hidden');
    document.getElementById('quiz-result').classList.add('hidden');
}

function startQuiz() {
    currentQuizIndex = 0;
    quizScore = 0;
    currentQuizAnswers = [];
    
    // 随机生成每道题的答案
    quizQuestions.forEach(q => {
        q.correct = Math.floor(Math.random() * q.options.length);
    });
    
    document.getElementById('quiz-start').classList.add('hidden');
    document.getElementById('quiz-game').classList.remove('hidden');
    document.getElementById('quiz-result').classList.add('hidden');
    
    showQuizQuestion();
}

function showQuizQuestion() {
    const question = quizQuestions[currentQuizIndex];
    const progress = ((currentQuizIndex + 1) / quizQuestions.length) * 100;
    
    document.getElementById('quiz-progress-fill').style.width = `${progress}%`;
    document.getElementById('quiz-progress-text').textContent = `${currentQuizIndex + 1}/${quizQuestions.length}`;
    document.getElementById('quiz-question').textContent = question.question;
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = question.options.map((option, index) => `
        <button class="quiz-option" data-index="${index}">${option}</button>
    `).join('');
    
    // 绑定选项点击事件
    optionsContainer.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => handleQuizAnswer(parseInt(btn.dataset.index)));
    });
}

function handleQuizAnswer(selectedIndex) {
    const question = quizQuestions[currentQuizIndex];
    const isCorrect = selectedIndex === question.correct;
    
    if (isCorrect) quizScore += 10;
    currentQuizAnswers.push({
        question: question.question,
        correct: isCorrect
    });
    
    // 显示答案反馈
    const options = document.querySelectorAll('.quiz-option');
    options.forEach((btn, index) => {
        btn.disabled = true;
        if (index === question.correct) {
            btn.classList.add('correct');
        } else if (index === selectedIndex && !isCorrect) {
            btn.classList.add('wrong');
        }
    });
    
    setTimeout(() => {
        currentQuizIndex++;
        if (currentQuizIndex < quizQuestions.length) {
            showQuizQuestion();
        } else {
            showQuizResult();
        }
    }, 800);
}

function showQuizResult() {
    document.getElementById('quiz-game').classList.add('hidden');
    document.getElementById('quiz-result').classList.remove('hidden');
    
    const score = quizScore;
    document.getElementById('quiz-score').textContent = score;
    
    let title, desc;
    if (score >= 90) {
        title = `${t('t_8900dc')}！💕`;
        desc = `${t('t_3d213c')}！`;
    } else if (score >= 70) {
        title = `${t('t_0dc032')}！❤️`;
        desc = `${t('t_0ad06e')}！`;
    } else if (score >= 50) {
        title = `${t('t_6d1383')}！💝`;
        desc = `${t('t_fe2eed')}！`;
    } else {
        title = `${t('t_a8361b')}~ 💌`;
        desc = `${t('t_191100')}TA吧！`;
    }
    
    document.getElementById('quiz-result-title').textContent = title;
    document.getElementById('quiz-result-desc').textContent = desc;
}

// ==================== 统计页面 ====================
function loadStats() {
    const allDiaries = diaryManager.getAllDiaries();
    const timeDetails = anniversaryManager.getLoveTimeDetails();

    // 年度选择（填充一次）
    const yearSelect = document.getElementById('annual-year-select');
    if (yearSelect && !yearSelect.dataset.inited) {
        const years = Array.from(new Set(allDiaries.map(d => d.date?.slice(0, 4)).filter(Boolean))).sort((a, b) => parseInt(b) - parseInt(a));
        if (!years.length) years.push(String(new Date().getFullYear()));

        yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}年</option>`).join('');
        yearSelect.value = String(new Date().getFullYear());
        yearSelect.dataset.inited = '1';
    }

    const selectedYear = yearSelect ? parseInt(yearSelect.value || new Date().getFullYear()) : new Date().getFullYear();
    const diaries = allDiaries.filter(d => d.date?.startsWith(`${selectedYear}-`));

    // 年度打卡统计
    const diaryCount = diaries.length;
    const uniqueDays = new Set(diaries.map(d => d.date)).size;
    const photoCount = diaries.reduce((s, d) => s + (d.photos?.length || 0), 0);
    document.getElementById('stat-diary-count').textContent = diaryCount;
    document.getElementById('stat-days-count').textContent = uniqueDays;
    document.getElementById('stat-photo-count').textContent = photoCount;

    // 恋爱时光（累计）
    if (timeDetails) {
        document.getElementById('stat-months').textContent = timeDetails.months;
        document.getElementById('stat-weeks').textContent = timeDetails.weeks;
        document.getElementById('stat-hours').textContent = timeDetails.hours.toLocaleString();
        document.getElementById('stat-minutes').textContent = timeDetails.minutes.toLocaleString();
    }

    // 心情曲线图：按月平均心情（1-7）
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const data = labels.map((_, idx) => {
        const m = idx + 1;
        const mm = String(m).padStart(2, '0');
        const monthDiaries = diaries.filter(d => d.date?.startsWith(`${selectedYear}-${mm}`));
        if (!monthDiaries.length) return 4; // 默认平稳心情
        const sum = monthDiaries.reduce((s, d) => s + (Number(d.mood) || 4), 0);
        const avg = sum / monthDiaries.length;
        return Math.max(1, Math.min(7, Math.round(avg)));
    });

    if (!moodChart) moodChart = new LoveChart('mood-chart');
    moodChart.drawLineChart(data, labels);

    // 心情分布图
    const moodStats = createMoodStats(diaries);
    if (!pieChart) pieChart = new LoveChart('mood-pie-chart');
    pieChart.drawPieChart(moodStats);

    const moodStatsEl = document.getElementById('mood-stats');
    if (moodStats.length === 0) {
        moodStatsEl.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">暂无数据</p>';
    } else {
        moodStatsEl.innerHTML = moodStats.slice(0, 4).map(stat => `
            <div class="mood-stat-item">
                <span class="emoji">${stat.emoji}</span>
                <span class="count">${stat.value}次</span>
            </div>
        `).join('');
    }

    // 珍贵回忆自动整理
    const memoriesEl = document.getElementById('annual-memories-list');
    const memoriesSub = document.getElementById('annual-memories-sub');
    if (memoriesSub) memoriesSub.textContent = `${selectedYear}${t('t_5568dd')}`;

    if (!memoriesEl) return;
    if (!diaries.length) {
        memoriesEl.innerHTML = emptyStateHtml(
            'empty-diary',
            t('noYearDiary') || '今年还没有写日记',
            t('t_startWriting') || '写下每一天的小确幸',
            null, null
        );
        return;
    }

    const memories = diaries
        .slice()
        .sort((a, b) => {
            const ap = a.photos?.length ? 1 : 0;
            const bp = b.photos?.length ? 1 : 0;
            if (bp !== ap) return bp - ap;
            const am = Number(a.mood) || 0;
            const bm = Number(b.mood) || 0;
            if (bm !== am) return bm - am;
            return (b.content?.length || 0) - (a.content?.length || 0);
        })
        .slice(0, 6);

    memoriesEl.innerHTML = memories.map(d => {
        const firstPhoto = d.photos?.[0];
        return `
            <div class="memory-item" onclick="editDiary('${d.id}')">
                <div class="memory-top">
                    <div class="memory-mood">${diaryManager.getMoodEmoji(d.mood)}</div>
                    <div class="memory-date">${diaryManager.formatDate(d.date)}</div>
                </div>
                ${firstPhoto ? `<img class="memory-photo" src="${firstPhoto}" alt="${t('t_44e4d7')}" loading="lazy">` : ''}
                <div class="memory-text">${escapeHtml(d.content || '').slice(0, 60)}${(d.content || '').length > 60 ? '...' : ''}</div>
            </div>
        `;
    }).join('');

    // 年度回顾完成后自动播放生日祝福特效
    setTimeout(() => {
        if (!window.__bdayEffectShown) {
            window.__bdayEffectShown = true;
            showBirthdayEffect();
        }
    }, 800);
}

// ==================== 设置页面 ====================
function loadSettings() {
    const coupleInfo = anniversaryManager.getCoupleInfo();
    if (!coupleInfo) return;
    
    document.getElementById('setting-name1').value = coupleInfo.name1 || '';
    document.getElementById('setting-name2').value = coupleInfo.name2 || '';
    document.getElementById('setting-date').value = coupleInfo.startDate || '';
    
    // 加载主题颜色
    const themeColor = localStorage.getItem('love_theme_color');
    if (themeColor) {
        try {
            const { primary, secondary } = JSON.parse(themeColor);
            document.documentElement.style.setProperty('--primary-color', primary);
            document.documentElement.style.setProperty('--primary-light', adjustColor(primary, 30));
            document.documentElement.style.setProperty('--secondary-color', secondary);
            
            document.querySelectorAll('.theme-color-option').forEach(o => {
                o.classList.toggle('selected', o.dataset.primary === primary);
            });
        } catch (e) {}
    }
    
    // 加载背景图案
    const bgPattern = localStorage.getItem('love_bg_pattern');
    if (bgPattern) {
        const appContainer = document.querySelector('.main-content');
        if (appContainer) {
            if (bgPattern && bgPattern !== 'none') {
                appContainer.classList.add('bg-' + bgPattern);
            }
        }
        document.documentElement.setAttribute('data-bg-pattern', bgPattern);
        document.querySelectorAll('.bg-pattern-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.pattern === bgPattern);
        });
    } else {
        // 默认应用纯色背景
        const appContainer = document.querySelector('.main-content');
        if (appContainer) {
            appContainer.classList.remove('bg-none');
        }
    }
    
    // 加载自定义背景
    const customBg = localStorage.getItem('love_custom_bg');
    if (customBg) {
        document.documentElement.setAttribute('data-custom-bg', customBg);
        document.documentElement.style.setProperty('--custom-bg', `url(${customBg})`);
        const appContainer = document.querySelector('.main-content');
        if (appContainer) {
            appContainer.classList.add('bg-custom');
        }
        const preview = document.getElementById('custom-bg-preview');
        if (preview) preview.innerHTML = `<img src="${customBg}" alt="自定义背景">`;
    }
    
    // 加载背景动画设置
    const bgAnim = localStorage.getItem('love_bg_animation');
    if (bgAnim !== null) {
        const animEnabled = bgAnim === 'true';
        document.documentElement.setAttribute('data-bg-animation', animEnabled ? 'true' : 'false');
        document.getElementById('bg-animation-toggle') && (document.getElementById('bg-animation-toggle').checked = animEnabled);
    }

    // 背景音乐开关
    const settings = loadJson(LOVE_SETTINGS_KEY, {});
    const musicOn = settings.musicOn ?? true;
    document.getElementById('music-toggle') && (document.getElementById('music-toggle').checked = !!musicOn);

    loadLlmSettingsToForm();
    initDarkModeToggle();

    // 恢复当前语言选择
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = getLocale();

    // 刷新隐私设置 UI 状态
    initPrivacyToggleState();
}

function loadLlmSettingsToForm() {
    const s = getLlmSettings();
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v ?? '';
    };
    set('llm-api-base', s.apiBase);
    set('llm-model', s.model);
    set('llm-api-key', s.apiKey);
    set('llm-system', s.systemPrompt);
    set('tts-url', s.ttsUrl);
    set('tts-ref-audio', s.ttsRefAudio);
    set('tts-prompt', s.ttsPromptText);
    const sel = document.getElementById('blessing-template');
    if (sel) sel.value = s.blessingTemplate || 'classic';
}

function persistLlmSettingsFromForm() {
    const get = id => document.getElementById(id)?.value?.trim() ?? '';
    saveLlmSettings({
        apiBase: get('llm-api-base') || defaultLlmSettings().apiBase,
        model: get('llm-model') || defaultLlmSettings().model,
        apiKey: get('llm-api-key'),
        systemPrompt: get('llm-system') || defaultLlmSettings().systemPrompt,
        ttsUrl: get('tts-url') || defaultLlmSettings().ttsUrl,
        ttsRefAudio: get('tts-ref-audio'),
        ttsPromptText: get('tts-prompt') || `${t('t_7eca68')}`,
        blessingTemplate: document.getElementById('blessing-template')?.value || 'classic'
    });
}

function bindLlmSettingsEvents() {
    ['llm-api-base', 'llm-model', 'llm-api-key', 'llm-system', 'tts-url', 'tts-ref-audio', 'tts-prompt', 'blessing-template'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            persistLlmSettingsFromForm();
        });
    });
}

function updateSettings() {
    const coupleInfo = anniversaryManager.getCoupleInfo();
    if (!coupleInfo) return;
    
    coupleInfo.name1 = document.getElementById('setting-name1').value.trim() || coupleInfo.name1;
    coupleInfo.name2 = document.getElementById('setting-name2').value.trim() || coupleInfo.name2;
    coupleInfo.startDate = document.getElementById('setting-date').value || coupleInfo.startDate;
    
    anniversaryManager.saveCoupleInfo(coupleInfo);
    syncLoveKeysFromCoupleInfo();
    updateHeaderInfo();
    showToast(t('settingsSaved2'), '✅');
}

function updateTheme() {
    const theme = localStorage.getItem('love_theme') || 'pink';
    document.documentElement.setAttribute('data-theme', theme);
    syncLoveKeysFromCoupleInfo();
    // Dark mode toggle sync
    const isDark = localStorage.getItem('love_dark_mode') === 'true';
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) darkToggle.checked = isDark;
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// Dark mode toggle handler
function initDarkModeToggle() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (!toggle) return;
    // Sync initial state
    const isDark = localStorage.getItem('love_dark_mode') === 'true';
    toggle.checked = isDark;
    updateToggleVisual(toggle, isDark);

    toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        localStorage.setItem('love_dark_mode', enabled ? 'true' : 'false');
        updateToggleVisual(toggle, enabled);
        if (enabled) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            const colorTheme = localStorage.getItem('love_theme') || 'pink';
            document.documentElement.setAttribute('data-theme', colorTheme);
        }
        showToast(enabled ? '深色模式已开启' : '深色模式已关闭', enabled ? '🌙' : '☀️');
    });
}

function updateToggleVisual(toggle, isOn) {
    const slider = toggle.closest('.toggle-switch')?.querySelector('.toggle-slider');
    const knob = toggle.closest('.toggle-switch')?.querySelector('.toggle-knob');
    if (slider) {
        slider.style.background = isOn
            ? 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))'
            : 'rgba(255,255,255,0.1)';
    }
    if (knob) {
        knob.style.left = isOn ? '26px' : '3px';
        knob.style.background = isOn ? 'white' : 'white';
    }
}

function syncLoveKeysFromCoupleInfo() {
    const coupleInfo = anniversaryManager.getCoupleInfo();
    if (!coupleInfo) return;

    const names = { name1: coupleInfo.name1, name2: coupleInfo.name2 };
    const startDate = coupleInfo.startDate;
    const avatar = coupleInfo.avatar;
    const theme = localStorage.getItem('love_theme') || 'pink';

    // 兼容：终极版所需 keys
    localStorage.setItem(LOVE_NAMES_KEY, JSON.stringify(names));
    localStorage.setItem(LOVE_START_DATE_KEY, startDate);

    const existing = loadJson(LOVE_SETTINGS_KEY, {});
    const settings = {
        ...existing,
        names,
        avatar,
        startDate,
        theme,
        // 默认开背景音乐开关（如果后续实现音乐模块）
        musicOn: existing.musicOn ?? true
    };

    localStorage.setItem(LOVE_SETTINGS_KEY, JSON.stringify(settings));
}

// ==================== 头像上传 ====================
async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const coupleInfo = anniversaryManager.getCoupleInfo();
    if (!coupleInfo) return;

    try {
        const base64 = await diaryManager.fileToBase64(file);
        coupleInfo.avatar = base64;
        anniversaryManager.saveCoupleInfo(coupleInfo);
        syncLoveKeysFromCoupleInfo();
        updateHeaderInfo();
        showToast(t('avatarUpdated'), '✅');
    } catch (err) {
        console.error(`${t('t_4c50ee')}上传${t('t_acd5cb')}:`, err);
        showToast(t('avatarUploadFailed'), '❌');
    } finally {
        e.target.value = '';
    }
}

// ==================== 数据导入导出 ====================
function collectFullBackupPayload() {
    return {
        coupleInfo: anniversaryManager.getCoupleInfo(),
        diaries: diaryManager.diaries,
        anniversaries: anniversaryManager.anniversaries,
        photos: loadJson('love_photos', []),
        bills: loadJson('love_bills', []),
        wishes: loadJson('love_wishes', []),
        vault: loadJson('love_vault', null),
        moods: loadJson('love_moods', []),
        dailyQa: loadJson('love_daily_qa', null),
        challenge100: loadJson('love_challenge_100', null),
        settings: loadJson(LOVE_SETTINGS_KEY, {}),
        llmSettings: loadJson(LOVE_LLM_SETTINGS_KEY, {}),
        customMusic: loadJson(LOVE_CUSTOM_MUSIC_KEY, []),
        theme: localStorage.getItem('love_theme'),
        exportDate: new Date().toISOString(),
        version: '1.1'
    };
}

function exportData() {
    const data = collectFullBackupPayload();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `love-diary-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('backupExported'), '✅');
}

function exportDataAsTxt() {
    const diaries = diaryManager.getAllDiaries?.() || diaryManager.diaries || [];
    const couple = anniversaryManager.getCoupleInfo() || {};
    let text = `${t('t_2c51b1')}）\n${t('t_1cef04')}：${new Date().toLocaleString('zh-CN')}\n`;
    text += `${couple.name1 || '我'} & ${couple.name2 || 'TA'}\n\n`;
    diaries.forEach((d, i) => {
        text += `--- ${d.date || ''} ---\n${(d.title || `${t('t_44a77d')}`).trim()}\n${t('t_ba89e6')}：${d.mood || '-'}\n${d.content || ''}\n\n`;
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `love-diary-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('diaryExportedTxt'), '✅');
}

function exportDataAsHtml() {
    const diaries = diaryManager.getAllDiaries?.() || diaryManager.diaries || [];
    const couple = anniversaryManager.getCoupleInfo() || {};
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${t('t_5011b6')}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:16px;background:#fff5f8;}
    h1{color:#c2185b} .d{border:1px solid #ffc9d9;border-radius:12px;padding:12px;margin:12px 0;background:#fff}</style></head><body>`;
    html += `<h1>💕 ${esc(couple.name1)} & ${esc(couple.name2)}</h1><p>${t('t_1cef04')} ${new Date().toLocaleString('zh-CN')}</p>`;
    diaries.forEach(d => {
        html += `<div class="d"><strong>${esc(d.date)}</strong> — ${esc(d.title)}<br>${t('t_ba89e6')} ${esc(d.mood)}<p>${esc(d.content).replace(/\n/g, '<br>')}</p></div>`;
    });
    html += '</body></html>';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `love-diary-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('htmlExported'), '✅');
}

async function exportDataAsZip() {
    if (typeof JSZip === 'undefined') {
        showToast(t('zipModuleMissing'), '⚠️');
        return;
    }
    const zip = new JSZip();
    const payload = collectFullBackupPayload();
    zip.file('backup.json', JSON.stringify(payload, null, 2));
    zip.file('diaries.txt', (function txtFromDiaries() {
        let t = '';
        (payload.diaries || []).forEach(d => {
            t += `--- ${d.date} ---\n${d.title || ''}\n${d.content || ''}\n\n`;
        });
        return t;
    })());
    const photos = payload.photos || [];
    let n = 0;
    for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!p.src || !p.src.startsWith('data:')) continue;
        const m = p.src.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) continue;
        zip.file(`photos/photo_${i}.${m[1].includes('png') ? 'png' : 'jpg'}`, m[2], { base64: true });
        n++;
        if (n >= 80) break;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `love-diary-archive-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('zipExported', {photoCount: n ? t('exportZipWithPhotos', {n}) : ''}), '✅');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                showToast(t('txtReadonlyHint'), 'ℹ️');
            } catch (err) {
                showToast(t('readFailed'), '❌');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (data.coupleInfo) {
                anniversaryManager.saveCoupleInfo(data.coupleInfo);
            }
            if (Array.isArray(data.diaries)) {
                diaryManager.diaries = data.diaries;
                diaryManager.saveDiaries();
            }
            if (Array.isArray(data.anniversaries)) {
                anniversaryManager.anniversaries = data.anniversaries;
                anniversaryManager.saveAnniversaries();
            }
            if (Array.isArray(data.photos)) saveJson('love_photos', data.photos);
            if (Array.isArray(data.bills)) saveJson('love_bills', data.bills);
            if (Array.isArray(data.wishes)) saveJson('love_wishes', data.wishes);
            if (data.vault != null) saveJson('love_vault', data.vault);
            if (Array.isArray(data.moods)) saveJson('love_moods', data.moods);
            if (data.dailyQa != null) saveJson('love_daily_qa', data.dailyQa);
            if (data.challenge100 != null) saveJson('love_challenge_100', data.challenge100);
            if (data.settings && typeof data.settings === 'object') {
                saveJson(LOVE_SETTINGS_KEY, { ...loadJson(LOVE_SETTINGS_KEY, {}), ...data.settings });
            }
            if (data.llmSettings && typeof data.llmSettings === 'object') {
                saveJson(LOVE_LLM_SETTINGS_KEY, { ...loadJson(LOVE_LLM_SETTINGS_KEY, {}), ...data.llmSettings });
            }
            if (Array.isArray(data.customMusic)) saveJson(LOVE_CUSTOM_MUSIC_KEY, data.customMusic);
            if (data.theme) localStorage.setItem('love_theme', data.theme);

            showToast(t('importSuccess'), '✅');
            setTimeout(() => location.reload(), 500);
        } catch (err) {
            console.error(err);
            showToast(t('importFailed'), '❌');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function clearAllData() {
    showConfirm(t('clearAllDataConfirm'), () => {
        try { stopBackgroundMusic?.(); } catch (e) {}
        localStorage.removeItem('love_couple_info');
        localStorage.removeItem('love_diaries');
        localStorage.removeItem('love_anniversaries');
        localStorage.removeItem('love_theme');
        localStorage.removeItem('love_moods');
        localStorage.removeItem('love_photos');
        localStorage.removeItem('love_bills');
        localStorage.removeItem('love_wishes');
        localStorage.removeItem('love_settings');
        localStorage.removeItem('love_start_date');
        localStorage.removeItem('love_names');
        localStorage.removeItem('love_daily_qa');
        localStorage.removeItem('love_challenge_100');
        localStorage.removeItem('love_vault');
        localStorage.removeItem(LOVE_LLM_SETTINGS_KEY);
        localStorage.removeItem(LOVE_CUSTOM_MUSIC_KEY);

        showToast(t('dataCleared'), '🗑️');
        setTimeout(() => location.reload(), 500);
    });
}

// ==================== 图片预览 ====================
function previewImage(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    img.src = src;
    modal.classList.remove('hidden');
}

// ==================== 工具函数 ====================
function showToast(message, icon = '✅') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-icon').textContent = icon;
    document.getElementById('toast-message').textContent = message;
    
    toast.classList.remove('hidden', 'fade-out');
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2000);
}

function showConfirm(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').textContent = message;
    modal.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirm-ok');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initBubbles() {
    const container = document.getElementById('bubbles');
    if (!container) return;

    // 生成固定数量气泡，使用纯 CSS keyframes 执行动画
    const count = 16;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const b = document.createElement('div');
        b.className = 'bubble';
        const left = Math.random() * 100;
        const size = 10 + Math.random() * 30;
        const delay = Math.random() * 3;
        const duration = 7 + Math.random() * 8;

        b.style.left = `${left}%`;
        b.style.width = `${size}px`;
        b.style.height = `${size}px`;
        b.style.animationDelay = `${delay}s`;
        b.style.animationDuration = `${duration}s`;

        container.appendChild(b);
    }
}

// ==================== 键盘快捷键 ====================
document.addEventListener('keydown', (e) => {
    // ESC 关闭模态框
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ==================== 防止双击缩放 ====================
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// ==================== 新增页面功能：游戏/聊天/相册/账单/愿望 ====================

const PHOTO_STORAGE_KEY = 'love_photos';
const BILLS_STORAGE_KEY = 'love_bills';
const WISHES_STORAGE_KEY = 'love_wishes';
const VAULT_STORAGE_KEY = 'love_vault';
function loadJson(key, fallback) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (e) {
        console.error(`loadJson${t('t_acd5cb')}:`, key, e);
        return fallback;
    }
}

// 颜色调整函数
function adjustColor(hex, percent) {
    try {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        
        r = Math.min(255, Math.max(0, Math.round(r + (255 - r) * (percent / 100))));
        g = Math.min(255, Math.max(0, Math.round(g + (255 - g) * (percent / 100))));
        b = Math.min(255, Math.max(0, Math.round(b + (255 - b) * (percent / 100))));
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch (e) {
        return hex;
    }
}

function saveJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`saveJson${t('t_acd5cb')}:`, key, e);
        return false;
    }
}

// ==================== 游戏页 ====================
function loadGamePage() {
    resetQuiz();
    renderDailyQA();
    renderChallenge100();
    updateLoveIndex();
}

function renderDailyQA() {
    const elTopic = document.getElementById('daily-qa-topic');
    const elDate = document.getElementById('daily-qa-date');
    if (!elTopic || !elDate) return;

    const qa = dailyQAManager.getTodayQA();
    elTopic.textContent = qa.topic || '...';
    elDate.textContent = qa.date || '-';

    const a1 = document.getElementById('daily-qa-answer1');
    const a2 = document.getElementById('daily-qa-answer2');
    a1.value = qa.answer1 || '';
    a2.value = qa.answer2 || '';

    // 如果已有评分，直接展示结果
    const scoreEl = document.getElementById('daily-qa-score');
    const commonEl = document.getElementById('daily-qa-common');
    const cmpEl = document.getElementById('daily-qa-comparison');
    if (scoreEl && commonEl && cmpEl) {
        if (qa.score !== null && qa.score !== undefined) {
            scoreEl.textContent = `${qa.score}`;
            commonEl.textContent = qa.common || '-';
            cmpEl.textContent = qa.comparison || '-';
            // 可选：锁定再次提交
            document.getElementById('btn-daily-qa-submit')?.setAttribute('disabled', 'disabled');
        } else {
            scoreEl.textContent = '-';
            commonEl.textContent = '-';
            cmpEl.textContent = '-';
            document.getElementById('btn-daily-qa-submit')?.removeAttribute('disabled');
        }
    }
}

async function submitDailyQA() {
    const topic = document.getElementById('daily-qa-topic')?.textContent || '';
    const a1 = document.getElementById('daily-qa-answer1')?.value || '';
    const a2 = document.getElementById('daily-qa-answer2')?.value || '';
    const useLocalAI = !!document.getElementById('daily-qa-use-local-ai')?.checked;

    if (!topic) {
        showToast(t('topicLoadFailed'), '⚠️');
        return;
    }

    if (!a1.trim() || !a2.trim()) {
        showToast(t('fillBothAnswers'), '⚠️');
        return;
    }

    const qa = dailyQAManager.getTodayQA();
    const scored = await dailyQAManager.scoreWithOptionalLocalAI({
        topic,
        answer1: a1,
        answer2: a2,
        useLocalAI
    });

    const payload = {
        date: qa.date,
        topic,
        answer1: a1,
        answer2: a2,
        score: scored.score,
        common: scored.common,
        comparison: scored.comparison,
        createdAt: new Date().toISOString()
    };

    dailyQAManager.saveTodayQA(payload);
    renderDailyQA();
    showToast(t('compatGenerated'), '✅');
}

function renderChallenge100() {
    const listEl = document.getElementById('c100-list');
    const sumEl = document.getElementById('c100-summary');
    const fillEl = document.getElementById('c100-fill');
    if (!listEl || !sumEl || !fillEl) return;

    const items = challenge100Manager.getItems();
    const summary = challenge100Manager.getSummary();
    sumEl.textContent = `${summary.done}/${summary.total}`;
    fillEl.style.width = `${summary.percent}%`;

    const html = items
        .map(item => {
            const checked = item.done ? 'checked' : '';
            const doneCls = item.done ? 'c100-text-done' : '';
            return `
                <label class="c100-item">
                    <input type="checkbox" data-c100-id="${item.id}" ${checked}>
                    <span class="c100-item-text ${doneCls}">${item.text}</span>
                </label>
            `;
        })
        .join('');

    listEl.innerHTML = html;
}

function handleChallengeToggle(id) {
    const prevDone = challenge100Manager.getSummary().done;
    challenge100Manager.toggle(id);

    const unlocked = challenge100Manager.checkNewAchievements(prevDone);
    renderChallenge100();

    if (unlocked && unlocked.length) {
        // 简单成就动画：弹出心形飘落
        showC100Achievement(unlocked.join(','));
    }
}

function showC100Achievement(text) {
    showToast(t('achievementUnlocked', {text}), '🏆');

    const layerId = 'c100-achievement-layer';
    let layer = document.getElementById(layerId);
    if (!layer) {
        layer = document.createElement('div');
        layer.id = layerId;
        layer.className = 'c100-achievement-layer';
        document.body.appendChild(layer);
    }
    layer.innerHTML = '';

    for (let i = 0; i < 12; i++) {
        const heart = document.createElement('div');
        heart.className = 'c100-burst-heart';
        heart.textContent = '💕';
        heart.style.left = `${10 + Math.random() * 80}%`;
        heart.style.animationDelay = `${Math.random() * 0.2}s`;
        layer.appendChild(heart);
    }

    setTimeout(() => {
        layer?.remove();
    }, 2200);
}

function updateLoveIndex() {
    const fillEl = document.getElementById('love-index-fill');
    const textEl = document.getElementById('love-index-text');
    if (!fillEl || !textEl) return;

    const loveDays = anniversaryManager.getLoveDays();
    const diaryCount = diaryManager.getDiaryCount();
    const c100Summary = challenge100Manager.getSummary();

    // 经验公式：让数据随时间增长但始终压到 100
    const raw = (loveDays / 365) * 45 + diaryCount * 2 + c100Summary.percent * 0.25;
    const percent = Math.max(0, Math.min(100, Math.round(raw)));

    fillEl.style.width = `${percent}%`;
    textEl.textContent = `${percent}%`;
}

// ==================== 相册页 ====================
async function handlePhotoAlbumUpload(e) {
    const files = e.target.files;
    if (!files || !files.length) return;

    const photos = await diaryManager.handlePhotoUpload(files);
    const list = loadJson(PHOTO_STORAGE_KEY, []);

    photos.forEach((src) => {
        list.unshift({
            id: 'ph_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            src,
            createdAt: new Date().toISOString()
        });
    });

    saveJson(PHOTO_STORAGE_KEY, list);
    e.target.value = '';
    loadPhotoPage();
    showToast(t('photoAdded'), '📸');
}

function addPhotoByUrl() {
    const input = document.getElementById('photo-url-input');
    const url = input?.value?.trim();
    if (!url) return;

    // 简单校验（注意正则里的 / 必须写成 \/，不能多写反斜杠否则会提前结束字面量）
    if (!/^https?:\/\//.test(url) && !/^data:image\//.test(url)) {
        showToast(t('urlFormatInvalid'), '⚠️');
        return;
    }

    const list = loadJson(PHOTO_STORAGE_KEY, []);
    list.unshift({
        id: 'ph_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        src: url,
        createdAt: new Date().toISOString()
    });
    saveJson(PHOTO_STORAGE_KEY, list);
    input.value = '';

    loadPhotoPage();
    showToast(t('urlPhotoAdded'), '✅');
}

function loadPhotoPage() {
    const grid = document.getElementById('photo-grid');
    const count = document.getElementById('photo-count');
    if (!grid || !count) return;

    const photosStored = loadJson(PHOTO_STORAGE_KEY, []);

    // 若本地相册为空，则从日记照片中自动补全（符合“照片上传/相册”体验）
    const diaries = diaryManager.getAllDiaries();
    const diaryPhotos = diaries.flatMap(d => (d.photos || []).map(src => ({ src })));

    const mergedMap = new Map();
    [...photosStored.map(p => ({ ...p, src: p.src })), ...diaryPhotos]
        .forEach(p => {
            if (!p?.src) return;
            if (!mergedMap.has(p.src)) {
                mergedMap.set(p.src, {
                    id: p.id || ('ph_auto_' + mergedMap.size),
                    src: p.src,
                    createdAt: p.createdAt || new Date().toISOString()
                });
            }
        });
    const photos = Array.from(mergedMap.values());

    if (!photosStored.length && photos.length) {
        saveJson(PHOTO_STORAGE_KEY, photos);
    }

    count.textContent = `${photos.length} 张`;

    if (!photos.length) {
        grid.innerHTML = emptyStateHtml(
            'empty-photos',
            t('noPhotosYet') || '还没有照片',
            t('t_uploadFirstPhoto') || '上传你们的甜蜜瞬间，定格美好回忆',
            null, null
        );
        return;
    }

    grid.innerHTML = photos.map(p => `
        <div class="photo-item" onclick="previewImage('${p.src}')">
            <img src="${p.src}" alt="${t('t_d2fb1e')}" loading="lazy">
        </div>
    `).join('');
}


function loadPhotoPage() {
    if (typeof initAlbumModule === 'function') {
        initAlbumModule();
    }
}

// ==================== 账单页 ====================
function loadBillPage() {
    renderBills();
    renderVault();
}

function getBillType() {
    const selected = document.querySelector('#page-bill .type-option.selected');
    return selected?.dataset?.type || 'expense';
}

function addBillRecord() {
    const desc = document.getElementById('bill-desc')?.value?.trim();
    const amountRaw = document.getElementById('bill-amount')?.value;
    const amount = Number(amountRaw);
    const type = getBillType();

    if (!desc) {
        showToast(t('enterDesc'), '⚠️');
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast(t('enterValidAmount'), '⚠️');
        return;
    }

    const bills = loadJson(BILLS_STORAGE_KEY, []);
    bills.unshift({
        id: 'bill_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        type,
        desc,
        amount,
        createdAt: new Date().toISOString()
    });
    saveJson(BILLS_STORAGE_KEY, bills);

    document.getElementById('bill-desc').value = '';
    document.getElementById('bill-amount').value = '';

    renderBills();
    showToast(t('billAdded'), '✅');
}

function renderBills() {
    const listEl = document.getElementById('bill-list');
    const netEl = document.getElementById('bill-net');
    if (!listEl || !netEl) return;

    const bills = loadJson(BILLS_STORAGE_KEY, []);
    if (!bills.length) {
        listEl.innerHTML = emptyStateHtml(
            'empty-bill',
            t('noBillRecords') || '还没有账单记录',
            t('t_addFirstBill') || '一起记录每一笔花费，规划甜蜜未来',
            null, null
        );
        netEl.textContent = '¥0';
        return;
    }

    const net = bills.reduce((sum, b) => {
        const amt = Number(b.amount) || 0;
        return sum + (b.type === 'income' ? amt : -amt);
    }, 0);

    netEl.textContent = `¥${net.toFixed(2).replace(/\\.00$/, '')}`;

    const html = bills.map(b => `
        <div class="bill-row-item">
            <div class="bill-row-left">
                <div class="bill-row-type ${b.type === 'income' ? 'income' : 'expense'}">
                    ${b.type === 'income' ? '收入' : '支出'}
                </div>
                <div class="bill-row-desc">${escapeHtml(b.desc)}</div>
            </div>
            <div class="bill-row-right ${b.type === 'income' ? 'income' : 'expense'}">
                ${b.type === 'income' ? '+' : '-'}¥${(Number(b.amount) || 0).toFixed(2).replace(/\\.00$/, '')}
            </div>
        </div>
    `).join('');

    listEl.innerHTML = html;

    // 简单图表：用两行进度条显示总支出/总收入占比
    const expenseTotal = bills.filter(b => b.type === 'expense').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const incomeTotal = bills.filter(b => b.type === 'income').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const total = Math.max(expenseTotal + incomeTotal, 1e-9);

    const expEl = document.getElementById('bill-chart-expense');
    const incEl = document.getElementById('bill-chart-income');
    const expFill = document.getElementById('bill-chart-expense-fill');
    const incFill = document.getElementById('bill-chart-income-fill');
    const expVal = document.getElementById('bill-chart-expense-value');
    const incVal = document.getElementById('bill-chart-income-value');

    // 若页面尚未包含这些容器，跳过图表渲染
    if (expEl && incEl && expFill && incFill && expVal && incVal) {
        expFill.style.width = `${(expenseTotal / total) * 100}%`;
        incFill.style.width = `${(incomeTotal / total) * 100}%`;
        expVal.textContent = `¥${expenseTotal.toFixed(2).replace(/\\.00$/, '')}`;
        incVal.textContent = `¥${incomeTotal.toFixed(2).replace(/\\.00$/, '')}`;
    }
}

function renderVault() {
    const balanceEl = document.getElementById('vault-balance');
    const logEl = document.getElementById('vault-log');
    if (!balanceEl || !logEl) return;

    const vault = loadJson(VAULT_STORAGE_KEY, { balance: 0, tx: [] });
    const balance = Number(vault.balance) || 0;
    balanceEl.textContent = `¥${balance.toFixed(2).replace(/\\.00$/, '')}`;

    if (!vault.tx?.length) {
        logEl.innerHTML = emptyStateHtml(
            'empty-bill',
            t('noVaultRecords') || '还没有恋爱基金记录',
            t('t_addFirstFund') || '为你们的未来一起存钱吧',
            null, null
        );
        return;
    }

    logEl.innerHTML = vault.tx
        .slice()
        .reverse()
        .map(tx => `
            <div class="vault-tx ${tx.type}">
                <div class="vault-tx-left">
                    <span class="vault-tx-type">${tx.type === 'deposit' ? '存入' : '取出'}</span>
                    <span class="vault-tx-amt">${tx.type === 'deposit' ? '+' : '-'}¥${(Number(tx.amount) || 0).toFixed(2).replace(/\\.00$/, '')}</span>
                </div>
                <div class="vault-tx-time">${new Date(tx.createdAt).toLocaleString('zh-CN')}</div>
            </div>
        `)
        .join('');
}

function depositVault() {
    const valueRaw = document.getElementById('vault-input')?.value;
    const amount = Number(valueRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast(t('enterValidAmount'), '⚠️');
        return;
    }

    const vault = loadJson(VAULT_STORAGE_KEY, { balance: 0, tx: [] });
    vault.balance = (Number(vault.balance) || 0) + amount;
    vault.tx = vault.tx || [];
    vault.tx.push({ type: 'deposit', amount, createdAt: new Date().toISOString() });
    saveJson(VAULT_STORAGE_KEY, vault);

    document.getElementById('vault-input').value = '';
    renderVault();
    showToast(t('vaultDepositSuccess'), '✅');
}

function withdrawVault() {
    const valueRaw = document.getElementById('vault-input')?.value;
    const amount = Number(valueRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast(t('enterValidAmount'), '⚠️');
        return;
    }

    const vault = loadJson(VAULT_STORAGE_KEY, { balance: 0, tx: [] });
    const balance = Number(vault.balance) || 0;
    if (amount > balance) {
        showToast(t('vaultBalanceInsufficient'), '⚠️');
        return;
    }

    vault.balance = balance - amount;
    vault.tx = vault.tx || [];
    vault.tx.push({ type: 'withdraw', amount, createdAt: new Date().toISOString() });
    saveJson(VAULT_STORAGE_KEY, vault);

    document.getElementById('vault-input').value = '';
    renderVault();
    showToast(t('vaultWithdrawSuccess'), '✅');
}

// ==================== 匹配页 ====================
function loadMatchingPage() {
    const pairingData = getLocalPairingData();
    const unpairedEl = document.getElementById('matching-unpaired');
    const pairedEl = document.getElementById('matching-paired');
    
    if (pairingData?.paired && pairingData?.partner) {
        // 已配对状态
        if (unpairedEl) unpairedEl.classList.add('hidden');
        if (pairedEl) {
            pairedEl.classList.remove('hidden');
            
            const partner = pairingData.partner;
            document.getElementById('paired-avatars').innerHTML = `
                <span class="avatar-large">${partner.userAvatar || '💕'}</span>
            `;
            document.getElementById('partner-display-name').textContent = partner.userName || 'TA';
            document.getElementById('paired-since').textContent = `${t('t_b820b6')} ${new Date(pairingData.pairedAt).toLocaleDateString('zh-CN')}`;
            
            // 更新状态
            document.getElementById('pairing-status').textContent = `${t('t_c5ea9c')}`;
            document.getElementById('pairing-status').classList.add('connected');
        }
    } else {
        // 未配对状态
        if (pairedEl) pairedEl.classList.add('hidden');
        if (unpairedEl) unpairedEl.classList.remove('hidden');
        
        // 生成二维码
        generatePairingQR();
    }
}

function generatePairingQR() {
    const pairingData = generateLocalPairingData();
    const qrContainer = document.getElementById('qr-code-container');
    const codeDisplay = document.getElementById('pairing-code-display');
    
    if (codeDisplay && pairingData.info) {
        codeDisplay.textContent = pairingData.info.code;
    }
    
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        QRCode.toCanvas(pairingData.qrData, 200, {
            margin: 2,
            color: {
                dark: '#FF8FB1',
                light: '#ffffff'
            }
        }, (error, canvas) => {
            if (error) {
                console.error(`${t('t_60cb8f')}:`, error);
                qrContainer.innerHTML = `<p style="color:#FF8FB1;padding:20px;">二维码生成${t('t_acd5cb')}</p>`;
                return;
            }
            qrContainer.appendChild(canvas);
        });
    }
}

function copyPairingCode() {
    const code = document.getElementById('pairing-code-display')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showToast(t('pairCodeCopied'), '📋');
        }).catch(() => {
            showToast(t('copyFailed'), '⚠️');
        });
    }
}

function handleManualPairing() {
    const input = document.getElementById('manual-pairing-input');
    const code = input?.value.trim().toUpperCase();
    
    if (!code || code.length < 8) {
        showToast(t('enter8DigitCode'), '⚠️');
        return;
    }
    
    showToast(t('manualPairNeedOnline'), '📡');
}

// ==================== 愿望页 ====================
function loadWishesPage() {
    renderWishes();
}

function renderWishes() {
    const listEl = document.getElementById('wish-list');
    const progressEl = document.getElementById('wish-progress');
    if (!listEl || !progressEl) return;

    const wishes = loadJson(WISHES_STORAGE_KEY, []);
    const total = wishes.length;
    const done = wishes.filter(w => w.done).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    progressEl.textContent = `${percent}%`;

    if (!total) {
        listEl.innerHTML = emptyStateHtml(
            'empty-wish',
            t('makeWish') || '还没有愿望清单',
            t('t_addFirstWish') || '写下你们的小愿望，一起努力实现',
            null, null
        );
        return;
    }

    listEl.innerHTML = wishes
        .map(w => {
            const checked = w.done ? 'checked' : '';
            const doneCls = w.done ? 'wish-text-done' : '';
            return `
                <div class="wish-item">
                    <label class="wish-label">
                        <input type="checkbox" data-wish-id="${w.id}" ${checked}>
                        <span class="wish-text ${doneCls}">${escapeHtml(w.text)}</span>
                    </label>
                    <button class="wish-del" data-wish-del="${w.id}" title="${t('t_2f4aad')}">×</button>
                </div>
            `;
        })
        .join('');

    // 删除按钮事件（简单做法：遍历绑定）
    listEl.querySelectorAll('button[data-wish-del]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-wish-del');
            deleteWish(id);
        });
    });
}

function addWish() {
    const input = document.getElementById('wish-input');
    const text = input?.value?.trim();
    if (!text) return;

    const wishes = loadJson(WISHES_STORAGE_KEY, []);
    wishes.unshift({
        id: 'wish_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        text,
        done: false,
        doneAt: null,
        createdAt: new Date().toISOString()
    });

    saveJson(WISHES_STORAGE_KEY, wishes);
    input.value = '';
    renderWishes();
    showToast(t('wishAdded'), '✅');
}

function toggleWishDone(id, checked) {
    const wishes = loadJson(WISHES_STORAGE_KEY, []);
    const target = wishes.find(w => w.id === id);
    if (!target) return;
    target.done = !!checked;
    target.doneAt = target.done ? new Date().toISOString() : null;
    saveJson(WISHES_STORAGE_KEY, wishes);
    renderWishes();
}

function deleteWish(id) {
    if (!id) return;
    showConfirm(`${t('t_1d7b49')}？`, () => {
        const wishes = loadJson(WISHES_STORAGE_KEY, []);
        const next = wishes.filter(w => w.id !== id);
        saveJson(WISHES_STORAGE_KEY, next);
        renderWishes();
        showToast(t('deleted'), '🗑️');
    });
}


// ==================== 实时聊天 ====================
const CHAT_REALTIME_KEY = 'love_chat_realtime_messages';

function initRealtimeChat() {
    renderRealtimeMessages();
    checkChatRealtimeAccess();
}

function checkChatRealtimeAccess() {
    const paired = typeof isPaired === 'function' ? isPaired() : false;
    const mask = document.getElementById('chat-unpaired-mask');
    const inputArea = document.getElementById('chat-realtime-input-area');
    if (!mask || !inputArea) return;

    if (!paired) {
        mask.style.display = 'block';
        inputArea.style.display = 'none';
    } else {
        mask.style.display = 'none';
        inputArea.style.display = 'flex';
    }
}

function renderRealtimeMessages() {
    const container = document.getElementById('chat-realtime-messages');
    if (!container) return;

    const messages = loadJson(CHAT_REALTIME_KEY, []);
    const paired = typeof isPaired === 'function' ? isPaired() : false;
    const myAvatar = '💕';
    const pairData = typeof getLocalPairingData === 'function' ? getLocalPairingData() : null;
    const partnerName = paired && pairData?.partner?.userName ? pairData.partner.userName : 'TA';
    const partnerAvatar = paired && pairData?.partner?.userAvatar ? pairData.partner.userAvatar : '💖';

    if (!messages.length) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: var(--text-light);">
                <p style="font-size: 32px; margin-bottom: 8px;">💬</p>
                <p>${t('noChatHistory')}</p>
                <p style="font-size: 12px; margin-top: 4px;">发送第一条消息，开启甜蜜对话吧~</p>
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(m => {
        const isMe = m.sender === 'me';
        const timeStr = m.time ? formatChatTime(m.time) : '';
        const avatar = isMe ? myAvatar : partnerAvatar;
        const sender = isMe ? '我' : partnerName;
        const msgCls = isMe ? 'message-me' : 'message-partner';

        let contentHtml = escapeHtml(m.text || '');
        if (m.type === 'image') {
            contentHtml = `<img src="${escapeHtml(m.text)}" class="chat-image" onclick="previewImage('${escapeHtml(m.text)}')" style="max-width:180px; border-radius:8px; cursor:pointer; display:block;">`;
        } else if (m.type === 'location') {
            contentHtml = `<div class="chat-location">📍 <a href="${escapeHtml(m.text)}" target="_blank">${t('t_40b624')}</a></div>`;
        } else if (m.type === 'link') {
            contentHtml = `<div class="chat-link">🔗 <a href="${escapeHtml(m.text)}" target="_blank">${escapeHtml(m.text)}</a></div>`;
        }

        return `
            <div class="chat-message ${msgCls}">
                <div class="message-avatar">${avatar}</div>
                <div class="message-bubble">
                    <span class="message-sender">${escapeHtml(sender)}</span>
                    <div class="chat-text">${contentHtml}</div>
                    <span class="message-time">${timeStr}</span>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

function formatChatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    if (isToday) return `${hours}:${mins}`;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日 ${hours}:${mins}`;
}

function sendRealtimeChatMessage() {
    const paired = typeof isPaired === 'function' ? isPaired() : false;
    if (!paired) {
        showToast(t('pairFirst'), '💕');
        switchPage('matching');
        return;
    }

    const input = document.getElementById('chat-realtime-input');
    const text = input?.value?.trim();
    if (!text) return;

    addRealtimeMessage('text', text);
    input.value = '';
}

function addRealtimeMessage(type, text) {
    const messages = loadJson(CHAT_REALTIME_KEY, []);
    messages.push({
        id: 'msg_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        type: type || 'text',
        text: text,
        sender: 'me',
        time: new Date().toISOString()
    });
    saveJson(CHAT_REALTIME_KEY, messages);
    renderRealtimeMessages();
}

function sendRealtimeChatImage() {
    const paired = typeof isPaired === 'function' ? isPaired() : false;
    if (!paired) {
        showToast(t('pairFirst'), '💕');
        return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => addRealtimeMessage('image', reader.result);
        reader.readAsDataURL(file);
    };
    input.click();
}

function sendRealtimeChatLocation() {
    const paired = typeof isPaired === 'function' ? isPaired() : false;
    if (!paired) {
        showToast(t('pairFirst'), '💕');
        return;
    }
    if (!navigator.geolocation) {
        showToast(t('geolocationNotSupported'), '⚠️');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
            addRealtimeMessage('location', url);
        },
        () => {
            showToast(t('locationFailed'), '⚠️');
        }
    );
}

function showRealtimeLinkInput() {
    const paired = typeof isPaired === 'function' ? isPaired() : false;
    if (!paired) {
        showToast(t('pairFirst'), '💕');
        return;
    }
    const link = prompt(`${t('t_d2455e')}：`);
    if (!link) return;
    if (!/^https?:\/\//.test(link)) {
        showToast(t('linkFormatInvalid'), '⚠️');
        return;
    }
    addRealtimeMessage('link', link);
}

function clearRealtimeChat() {
    saveJson(CHAT_REALTIME_KEY, []);
    renderRealtimeMessages();
}


// ==================== 音乐控制 ====================
/**
 * 内置曲目：文件名仅 ASCII，避免路径/编码问题
 * 音乐CDN配置：
 * 如需使用公网音乐，可在此处配置外部URL：
 *   { id: 'custom1', name: '歌曲名', src: 'https://your-cdn.com/music.mp3' }
 * 支持格式：MP3, WAV, OGG, AAC, M4A
 * CDN建议：Cloudflare R2, 阿里云OSS, 腾讯COS, 七牛云
 */
function getBuiltinMusicTracks() {
    return [
        { id: 'b_violet', name: `${t('t_62bdb4')}`, src: 'audio/violet.mp3' },
        { id: 'b_youni', name: `${t('t_34e189')}`, src: 'audio/you-have-me.mp3' },
        { id: 'b_lovemsg', name: `${t('t_bd7ff2')}`, src: 'audio/love-message.mp3' }
        // --- 添加公网CDN音乐示例 ---
        // { id: 'cdn1', name: '爱情讯息', artist: '敦静', src: 'https://your-cdn.example.com/audio/爱情讯息.mp3' },
        // { id: 'cdn2', name: '有我呢', artist: '敦静', src: 'https://your-cdn.example.com/audio/有我呢.mp3' },
    ];
}

function getCustomMusicTracks() {
    return loadJson(LOVE_CUSTOM_MUSIC_KEY, []);
}

function getAllMusicTracks() {
    return [...getBuiltinMusicTracks(), ...getCustomMusicTracks()];
}

function removeCustomMusicTrack(id) {
    if (!id) return;
    const next = getCustomMusicTracks().filter(t => t.id !== id);
    saveJson(LOVE_CUSTOM_MUSIC_KEY, next);
    rebuildMusicTrackList();
    showToast(t('localMusicRemoved'), '🗑️');
}

let bgMusicState = {
    audio: null,
    currentIndex: -1,
    isPlaying: false,
    panelOpen: false,
    autoPlayBlocked: false
};

function attachBgAudioHandlers() {
    if (!bgMusicState.audio || bgMusicState._handlersBound) return;
    bgMusicState._handlersBound = true;
    bgMusicState.audio.addEventListener('ended', () => {
        const tracks = getAllMusicTracks();
        if (!tracks.length) return;
        const nextIdx = (bgMusicState.currentIndex + 1) % tracks.length;
        playTrack(nextIdx);
    });
    bgMusicState.audio.addEventListener('error', () => {
        const tracks = getAllMusicTracks();
        const idx = bgMusicState.currentIndex;
        const t = tracks[idx];
        console.warn(`[${t('t_95521b')}] ${t('t_0c2142')}`, t?.name, t?.src);
        showToast(`Unable to play 「${t?.name || 'Track'}」, trying next`, '⚠️');
        if (tracks.length <= 1) return;
        const nextIdx = (idx + 1) % tracks.length;
        setTimeout(() => playTrack(nextIdx), 400);
    });
}

function rebuildMusicTrackList() {
    const listEl = document.getElementById('music-track-list');
    if (!listEl) return;
    const tracks = getAllMusicTracks();
    const builtins = getBuiltinMusicTracks().length;
    listEl.innerHTML = tracks.map((t, i) => {
        const isCustom = i >= builtins;
        const del = isCustom
            ? `<button type="button" class="music-track-del" data-del="${t.id}" title="${t('t_86048b')}">✕</button>`
            : '';
        return `
            <div class="music-track${i === bgMusicState.currentIndex ? ' active' : ''}" data-track="${i}">
                <span class="music-track-icon">${isCustom ? '📁' : '🎵'}</span>
                <span class="music-track-name">${t.name}</span>
                ${del}
                ${i === bgMusicState.currentIndex ? '<span class="music-track-active-dot"></span>' : ''}
            </div>`;
    }).join('');

    listEl.querySelectorAll('.music-track').forEach(el => {
        el.addEventListener('click', (ev) => {
            if (ev.target.closest('.music-track-del')) return;
            const idx = parseInt(el.dataset.track, 10);
            playTrack(idx);
            closeMusicPanel();
        });
    });
    listEl.querySelectorAll('.music-track-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCustomMusicTrack(btn.dataset.del);
        });
    });
}

async function handleCustomMusicUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
        showToast(t('fileTooLarge'), '⚠️');
        e.target.value = '';
        return;
    }
    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
        const list = getCustomMusicTracks();
        list.push({
            id: 'c_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            name: file.name.replace(/\.[^.]+$/, '') || `${t('t_fef4c2')}`,
            src: dataUrl
        });
        saveJson(LOVE_CUSTOM_MUSIC_KEY, list);
        rebuildMusicTrackList();
        showToast(t('addedToPlaylist'), '✅');
    } catch (err) {
        console.error(err);
        showToast(t('musicReadFailed'), '❌');
    }
    e.target.value = '';
}

function initMusicControl() {
    const btn = document.getElementById('music-control-btn');
    const panel = document.getElementById('music-panel');
    if (!btn) return;

    rebuildMusicTrackList();

    document.getElementById('music-upload-input')?.addEventListener('change', handleCustomMusicUpload);

    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (bgMusicState.panelOpen && panel && !panel.contains(e.target) && !btn.contains(e.target)) {
            closeMusicPanel();
        }
    });
}

/** 启动页进入后自动播放（设置里开启时） */
function startBackgroundMusic() {
    const tracks = getAllMusicTracks();
    if (!tracks.length) return;
    playTrack(0);
}

function stopBackgroundMusic() {
    try {
        bgMusicState.audio?.pause();
        bgMusicState.isPlaying = false;
        updateMusicBtnUI();
    } catch (err) {}
}

function toggleMusicPanel() {
    bgMusicState.panelOpen = !bgMusicState.panelOpen;
    const panel = document.getElementById('music-panel');
    if (!panel) return;
    panel.classList.toggle('show', bgMusicState.panelOpen);
}

function closeMusicPanel() {
    bgMusicState.panelOpen = false;
    document.getElementById('music-panel')?.classList.remove('show');
}

function playTrack(idx) {
    const tracks = getAllMusicTracks();
    if (idx < 0 || idx >= tracks.length) return;

    const track = tracks[idx];
    const btn = document.getElementById('music-control-btn');
    const icon = document.getElementById('music-btn-icon');

    if (!bgMusicState.audio) {
        bgMusicState.audio = new Audio();
        bgMusicState.audio.volume = 0.4;
        attachBgAudioHandlers();
    }

    bgMusicState.currentIndex = idx;
    bgMusicState.audio.src = track.src;
    bgMusicState.isPlaying = true;

    if (btn) {
        btn.classList.add('playing');
        btn.classList.remove('paused');
    }
    if (icon) icon.textContent = '🎵';

    bgMusicState.audio.play().catch(err => {
        if (err.name === 'NotAllowedError') {
            bgMusicState.autoPlayBlocked = true;
            bgMusicState.isPlaying = false;
            updateMusicBtnUI();
            // 静默处理，等待用户交互后手动播放
        } else {
            showToast(t('playFailed'), '⚠️');
            console.warn('Audio play error:', err);
        }
    });

    rebuildMusicTrackList();

    const settings = loadJson(LOVE_SETTINGS_KEY, {});
    settings.musicOn = true;
    localStorage.setItem(LOVE_SETTINGS_KEY, JSON.stringify(settings));
}

function togglePlayPause() {
    if (!bgMusicState.audio || !bgMusicState.audio.src) {
        playTrack(0);
        return;
    }
    const btn = document.getElementById('music-control-btn');
    const icon = document.getElementById('music-btn-icon');
    if (bgMusicState.isPlaying) {
        bgMusicState.audio.pause();
        bgMusicState.isPlaying = false;
        btn?.classList.remove('playing');
        btn?.classList.add('paused');
        if (icon) icon.textContent = '🎶';
    } else {
        bgMusicState.audio.play().catch(() => {});
        bgMusicState.isPlaying = true;
        btn?.classList.add('playing');
        btn?.classList.remove('paused');
        if (icon) icon.textContent = '🎵';
    }
}

function toggleBackgroundMusic(on) {
    const settings = loadJson(LOVE_SETTINGS_KEY, {});
    settings.musicOn = !!on;
    localStorage.setItem(LOVE_SETTINGS_KEY, JSON.stringify(settings));
    try {
        if (on) {
            if (!bgMusicState.audio || !bgMusicState.audio.src) playTrack(0);
            else bgMusicState.audio.play().catch(() => {});
            bgMusicState.isPlaying = true;
        } else {
            bgMusicState.audio?.pause();
            bgMusicState.isPlaying = false;
        }
        updateMusicBtnUI();
    } catch (e) {}
}

function updateMusicBtnUI() {
    const btn = document.getElementById('music-control-btn');
    const icon = document.getElementById('music-btn-icon');
    if (!btn) return;
    btn.classList.toggle('playing', bgMusicState.isPlaying);
    btn.classList.toggle('paused', !bgMusicState.isPlaying);
    if (icon) icon.textContent = bgMusicState.isPlaying ? '🎵' : '🎶';
}


// ==================== 节日主题系统 ====================
const HOLIDAYS = {
    valentine: {
        name: `${t('t_c4328f')}`,
        badge: `💕 ${t('t_ac7d21')}`,
        dates: [[2, 14], [5, 20]], // 月, 日
        cssClass: 'valentine'
    },
    christmas: {
        name: `${t('t_d0d78a')}`,
        badge: `🎄 ${t('t_d4fa2f')}`,
        dates: [[12, 25]],
        cssClass: 'christmas'
    },
    newyear: {
        name: `${t('t_d46d5b')}`,
        badge: `🎆 ${t('t_9c5ba7')}`,
        dates: [[1, 1]],
        cssClass: 'newyear'
    },
    sakura: {
        name: `${t('t_284bd9')}`,
        badge: `🌸 ${t('t_284bd9')}`,
        dates: [[3, 15], [3, 20], [3, 25], [4, 1], [4, 5]],
        cssClass: 'sakura'
    }
};

function isHolidayToday(holiday) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // 检查固定日期
    if (holiday.dates.some(([m, d]) => m === month && d === day)) return true;

    // 检查用户自定义情人节
    if (holiday === HOLIDAYS.valentine) {
        const settings = loadJson(LOVE_SETTINGS_KEY, {});
        if (settings.valentineDate) {
            const [m, d] = settings.valentineDate.split('-').map(Number);
            if (m === month && d === day) return true;
        }
    }

    // 纪念日里程碑检查
    const loveDays = anniversaryManager?.getLoveDays?.() || 0;
    const milestoneDays = [100, 200, 365, 500, 1000, 1500, 2000, 3000];
    if (milestoneDays.includes(loveDays)) return true;

    return false;
}

function applyHolidayTheme() {
    removeHolidayTheme();
    const settings = loadJson(LOVE_SETTINGS_KEY, {});
    if (!settings.autoHoliday) return;

    const body = document.body;
    const badge = document.getElementById('holiday-badge');
    if (!badge) return;

    // 检查各种节日
    for (const [key, holiday] of Object.entries(HOLIDAYS)) {
        if (isHolidayToday(holiday)) {
            body.setAttribute('data-holiday', key);
            badge.textContent = holiday.badge;
            badge.className = `holiday-badge ${holiday.cssClass}`;
            badge.style.display = 'block';

            // 纪念日里程碑
            const loveDays = anniversaryManager?.getLoveDays?.() || 0;
            const milestones = { 100: `💯 100${t('t_f9eb45')}`, 200: '💕 200天', 365: `🎉 ${t('t_812163')}`, 500: '🌟 500天', 1000: '💖 1000天', 1500: '✨ 1500天', 2000: '🌈 2000天', 3000: '💎 3000天' };
            if (milestones[loveDays]) {
                badge.textContent = milestones[loveDays];
                badge.className = 'holiday-badge milestone';
                body.setAttribute('data-holiday', 'milestone');
                body.setAttribute('data-holiday-custom', milestones[loveDays]);
                body.style.setProperty('--primary-color', '#9B59B6');
                body.style.setProperty('--secondary-color', '#F39C12');
            }

            // 触发节日照片特效
            setTimeout(() => triggerHolidayPhotoEffect(key), 1500);
            return;
        }
    }
}

function removeHolidayTheme() {
    const body = document.body;
    body.removeAttribute('data-holiday');
    body.removeAttribute('data-holiday-custom');
    body.style.removeProperty('--primary-color');
    body.style.removeProperty('--secondary-color');
    const badge = document.getElementById('holiday-badge');
    if (badge) badge.style.display = 'none';
}

function checkMilestoneAnniversary() {
    if (!anniversaryManager) return;
    const loveDays = anniversaryManager.getLoveDays();
    const milestones = [100, 200, 365, 500, 1000, 1500, 2000];
    if (milestones.includes(loveDays)) {
        setTimeout(() => showHeartbeatPopup(getMilestoneMessage(loveDays)), 3000);
        setTimeout(() => triggerHolidayPhotoEffect('milestone'), 4500);
    }
}

function getMilestoneMessage(days) {
    const msgs = {
        100: { title: '💯 100天！', text: `${t('t_9dab7f')}。` },
        200: { title: '💕 200天！', text: `200${t('t_04c96e')}。` },
        365: { title: `🎉 ${t('t_812163')}！`, text: `${t('t_5f7114')}。` },
        500: { title: '🌟 500天！', text: `500${t('t_6a85ba')}。` },
        1000: { title: '💖 1000天！', text: `${t('t_913928')}。` },
        1500: { title: '✨ 1500天！', text: `1500${t('t_4e93cd')}。` },
        2000: { title: '🌈 2000天！', text: `2000${t('t_9d9966')}。` },
    };
    return msgs[days] || { title: '💕 纪念日', text: `${t('t_2c1d6b')}！` };
}


// ==================== 照片空间漂浮特效 ====================
let _photoFloatTimer = null;

function startPhotoFloating() {
    if (_photoFloatTimer) clearInterval(_photoFloatTimer);
    // 每30~60秒随机漂浮一张照片
    const scheduleNext = () => {
        const delay = 30000 + Math.random() * 30000;
        _photoFloatTimer = setTimeout(() => {
            if (document.visibilityState === 'visible') {
                triggerFloatingPhoto();
            }
            scheduleNext();
        }, delay);
    };
    scheduleNext();
}

function triggerFloatingPhoto() {
    const photos = loadJson('love_photos', []);
    const diaries = diaryManager?.getAllDiaries?.() || [];
    const allPhotos = [
        ...photos.map(p => p.src),
        ...diaries.flatMap(d => d.photos || [])
    ];
    if (!allPhotos.length) return;

    const src = allPhotos[Math.floor(Math.random() * allPhotos.length)];
    spawnFloatingPhoto(src);
}

function spawnFloatingPhoto(src) {
    const container = document.getElementById('floating-photo-container');
    if (!container) return;

    const el = document.createElement('img');
    el.src = src;
    el.className = 'floating-photo';
    el.alt = `${t('t_548431')}`;

    const size = 80 + Math.random() * 60;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${10 + Math.random() * 60}%`;
    el.style.bottom = `${Math.random() * 40}%`;
    el.style.animationDuration = `${3 + Math.random() * 2}s`;

    container.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

function triggerHolidayPhotoEffect(holidayKey) {
    const photos = loadJson('love_photos', []);
    const diaries = diaryManager?.getAllDiaries?.() || [];
    const allPhotos = [...photos.map(p => p.src), ...diaries.flatMap(d => d.photos || [])];
    if (!allPhotos.length) return;

    // 节日时连续漂浮3张
    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnFloatingPhoto(allPhotos[Math.floor(Math.random() * allPhotos.length)]), i * 800);
    }

    // 纪念日特别效果
    if (holidayKey === 'milestone') {
        showHeartbeatPopup(getMilestoneMessage(anniversaryManager?.getLoveDays?.() || 0));
    }
}


// ==================== 情绪价值增强 ====================
// 暖心文案库
const WARM_TEXTS = [
    `💕 ${t('t_f36abb')}。`,
    `🌸 ${t('t_1d4909')}。`,
    `☀️ ${t('t_03b78b')}。`,
    `🌙 ${t('t_0a0854')}。`,
    `🎶 ${t('t_c0ccb6')}。`,
    `🌈 ${t('t_71a769')}。`,
    `✨ ${t('t_d84116')}。`,
    `💝 ${t('t_cf90ba')}。`,
    `🌹 ${t('t_162aab')}。`,
    `🍃 ${t('t_829bd0')}。`,
    `🎈 ${t('t_c7c7a7')}。`,
    `💫 ${t('t_3e286e')}。`,
    `🌻 ${t('t_09eb80')}。`,
    `🦋 ${t('t_edf3ff')}。`,
    `🎁 ${t('t_a51606')}。`,
    `💖 ${t('t_a1a133')}。`,
    `🌤️ ${t('t_ae413d')}。`,
    `📖 ${t('t_edf781')}。`,
    `🎠 ${t('t_27227b')}。`,
    `🌺 ${t('t_3f3a12')}。`
];

let _warmTextIndex = 0;

function getNextWarmText() {
    _warmTextIndex = (_warmTextIndex + 1) % WARM_TEXTS.length;
    return WARM_TEXTS[_warmTextIndex];
}

function injectWarmTextZone() {
    // 首页注入暖心文案区
    const homeDash = document.querySelector('#page-home .home-dashboard');
    if (!homeDash) return;
    const existing = document.getElementById('warm-text-zone');
    if (existing) return;

    const zone = document.createElement('div');
    zone.className = 'warm-text-zone';
    zone.id = 'warm-text-zone';
    zone.innerHTML = `
        <div class="warm-text-content" id="warm-text-content">${WARM_TEXTS[0]}</div>
        <button class="warm-text-refresh" id="warm-text-refresh">换一句 💕</button>
    `;
    homeDash.insertBefore(zone, homeDash.children[Math.min(2, homeDash.children.length)]);
    document.getElementById('warm-text-refresh')?.addEventListener('click', () => {
        document.getElementById('warm-text-content').textContent = getNextWarmText();
    });

    // 每30秒自动换一句
    setInterval(() => {
        const el = document.getElementById('warm-text-content');
        if (el) el.textContent = getNextWarmText();
    }, 30000);
}

function showHeartbeatPopup(msg) {
    if (!msg) return;
    const existing = document.getElementById('heartbeat-popup');
    if (existing) existing.remove();

    const title = typeof msg === 'string' ? msg : (msg.title || '💕');
    const text = typeof msg === 'string' ? `${t('t_331672')}！` : (msg.text || '');

    const popup = document.createElement('div');
    popup.id = 'heartbeat-popup';
    popup.className = 'heartbeat-popup';
    popup.innerHTML = `
        <div class="heartbeat-popup-content">
            <h3>${title}</h3>
            <p>${text}</p>
            <button class="heartbeat-popup-dismiss" onclick="this.closest('#heartbeat-popup').remove()">${t('t_26922a')}了 💕</button>
        </div>
    `;
    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 8000);
}

// 每日首次进入首页弹出暖心提示
let _homeVisitCount = 0;
const OLD_LOVE_NOTIFS = [
    { hours: 0, emoji: '🌙', text: `${t('t_06584a')}。` },
    { hours: 8, emoji: '🌅', text: `${t('t_83e8ab')}。` },
    { hours: 12, emoji: '☀️', text: `${t('t_3649ec')} 💕` },
    { hours: 18, emoji: '🌆', text: `${t('t_304d29')}。` },
    { hours: 21, emoji: '🌙', text: `${t('t_ba79f7')}。` }
];

function checkDailyNotif() {
    const lastNotif = localStorage.getItem('love_last_notif_date');
    const today = new Date().toDateString();
    if (lastNotif === today) return;
    localStorage.setItem('love_last_notif_date', today);

    const hour = new Date().getHours();
    const notif = OLD_LOVE_NOTIFS.find(n => Math.abs(n.hours - hour) <= 1) || OLD_LOVE_NOTIFS[0];

    setTimeout(() => showHeartbeatPopup({ title: `${notif.emoji} ${t('t_a21de3')}`, text: notif.text }), 2000);
}


// ==================== 年度总结生成 ====================
function loadAnnualSummary() {
    const container = document.getElementById('annual-summary-content');
    if (!container) return;

    const coupleInfo = anniversaryManager?.getCoupleInfo?.() || {};
    const diaries = diaryManager?.getAllDiaries?.() || [];
    const allPhotos = [
        ...loadJson('love_photos', []).map(p => p.src),
        ...diaries.flatMap(d => d.photos || [])
    ];

    const currentYear = new Date().getFullYear();
    const yearDiaries = diaries.filter(d => d.date?.startsWith(`${currentYear}-`));
    const diaryCount = yearDiaries.length;
    const uniqueDays = new Set(yearDiaries.map(d => d.date)).size;
    const photoCount = yearDiaries.reduce((s, d) => s + (d.photos?.length || 0), 0);

    const moodStats = {};
    yearDiaries.forEach(d => {
        const m = d.mood || 4;
        moodStats[m] = (moodStats[m] || 0) + 1;
    });
    const topMood = Object.entries(moodStats).sort((a, b) => b[1] - a[1])[0];
    const topMoodText = topMood ? diaryManager?.getMoodText?.(parseInt(topMood[0])) : `${t('t_bbb5cc')}`;

    const loveDays = anniversaryManager?.getLoveDays?.() || 0;

    // 找出年度最甜日记
    const sweetest = yearDiaries
        .filter(d => d.mood >= 6)
        .sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))[0];

    const diaryExcerpts = yearDiaries
        .filter(d => d.content && String(d.content).trim().length > 8)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 5)
        .map(d => ({
            date: d.date,
            snippet: String(d.content).replace(/\s+/g, ' ').trim().slice(0, 120)
        }));

    const photoGallery = loadJson('love_photos', []).slice(0, 6);

    // 生成情话
    const loveQuotes = [
        `💕 ${t('t_58cf0b')}。`,
        `🌟 ${t('t_f44ab9')}。`,
        `💖 ${t('t_917012')}。`,
        `✨ ${t('t_f39d57')}。`,
        `🌈 ${t('t_f5e7eb')}。`,
        `🎁 ${t('t_81c26d')}。`
    ];
    const yearQuote = loveQuotes[currentYear % loveQuotes.length];

    // 里程碑文字
    const milestones = {
        100: `💯 100${t('t_f8bbf6')}！`,
        200: `💕 200${t('t_8cbc56')}！`,
        365: `🎉 ${t('t_ec8ed7')}！`,
        500: '🌟 500天！',
        1000: '💖 1000天！'
    };
    const milestoneKey = Object.keys(milestones).map(Number).filter(d => d <= loveDays).pop();
    const milestoneHtml = milestoneKey
        ? `<div class="milestone-special-card">
            <div class="milestone-days-big">${milestoneKey}</div>
            <div class="milestone-label">${milestones[milestoneKey]}</div>
            <div class="milestone-message">${getMilestoneMessage(milestoneKey).text}</div>
           </div>`
        : '';

    // 高光时刻
    const highlightMoments = [];
    if (sweetest) {
        highlightMoments.push({ icon: '📝', text: sweetest.content?.slice(0, 80) || `${t('t_a11438')}` });
    }
    if (photoCount > 0) {
        highlightMoments.push({ icon: '📸', text: `${t('t_fc1b7d')} ${photoCount} 张${t('t_d2fb1e')}` });
    }
    if (uniqueDays > 20) {
        highlightMoments.push({ icon: '🏆', text: `${t('t_a53d56')} ${uniqueDays} 天` });
    }
    if (highlightMoments.length === 0) {
        highlightMoments.push({ icon: '💕', text: `${t('t_3f9a74')}` });
    }

    container.innerHTML = `
        <div class="summary-hero-card">
            <div class="summary-year-big">${currentYear}</div>
            <div class="summary-subtitle">${t('t_6f3a06')}年度${t('t_548431')}</div>
            <div class="summary-couple-names">${coupleInfo.name1 || '我'} & ${coupleInfo.name2 || 'TA'}</div>
        </div>

        ${milestoneHtml}

        <div class="summary-stats-grid">
            <div class="summary-stat-card">
                <span class="summary-stat-icon">📝</span>
                <div class="summary-stat-value">${diaryCount}</div>
                <div class="summary-stat-label">${t('t_7af7b8')}</div>
            </div>
            <div class="summary-stat-card">
                <span class="summary-stat-icon">📅</span>
                <div class="summary-stat-value">${uniqueDays}</div>
                <div class="summary-stat-label">天记录</div>
            </div>
            <div class="summary-stat-card">
                <span class="summary-stat-icon">📸</span>
                <div class="summary-stat-value">${photoCount}</div>
                <div class="summary-stat-label">张${t('t_d2fb1e')}</div>
            </div>
        </div>

        <div class="glass-card" style="padding:16px;">
            <h3 style="margin-bottom:12px;">🥰 年度${t('t_ba89e6')}</h3>
            <p style="font-size:15px;line-height:1.7;">${currentYear}年，你的总体${t('t_ba89e6')}是：<strong>${topMoodText}</strong></p>
        </div>

        <div class="summary-quote">${yearQuote}</div>

        <div class="glass-card" style="padding:16px;">
            <h3 style="margin-bottom:12px;">🌟 年度高光时刻</h3>
            <div class="summary-highlight-moments">
                ${highlightMoments.map(m => `
                    <div class="summary-moment">
                        <span class="summary-moment-icon">${m.icon}</span>
                        <span class="summary-moment-text">${m.text}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        ${diaryExcerpts.length ? `
        <div class="glass-card" style="padding:16px;">
            <h3 style="margin-bottom:12px;">📖 日记摘录</h3>
            <div class="summary-excerpt-list">
                ${diaryExcerpts.map(x => `
                    <div class="summary-excerpt-item">
                        <span class="summary-excerpt-date">${x.date}</span>
                        <p class="summary-excerpt-text">${x.snippet}${x.snippet.length >= 120 ? '…' : ''}</p>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        ${photoGallery.length ? `
        <div class="glass-card" style="padding:16px;">
            <h3 style="margin-bottom:12px;">📸 相册精选</h3>
            <div class="summary-photo-strip">
                ${photoGallery.map(p => `<img class="summary-thumb" src="${String(p.src).replace(/"/g, '&quot;')}" alt="" loading="lazy" onclick="previewImage(this.src)">`).join('')}
            </div>
        </div>` : ''}

        <button class="summary-share-btn" onclick="shareAnnualSummary()">
            📤 分享年度总结
        </button>
    `;
}

function shareAnnualSummary() {
    const coupleInfo = anniversaryManager?.getCoupleInfo?.() || {};
    const diaries = diaryManager?.getAllDiaries?.() || [];
    const currentYear = new Date().getFullYear();
    const yearDiaries = diaries.filter(d => d.date?.startsWith(`${currentYear}-`));

    const text = `💕 ${t('t_6f3a06')} ${currentYear} 年度总结 💕\n\n` +
        `${coupleInfo.name1 || '我'} & ${coupleInfo.name2 || 'TA'}\n` +
        `📝 ${t('t_1de405')} ${yearDiaries.length} ${t('t_7af7b8')}\n` +
        `📸 ${yearDiaries.reduce((s, d) => s + (d.photos?.length || 0), 0)} 张${t('t_d2fb1e')}\n` +
        `💖 ${t('t_b04a67')} ${anniversaryManager?.getLoveDays?.() || 0} 天\n\n` +
        `Made with 💕 ${t('t_5011b6')}`;

    if (navigator.share) {
        navigator.share({ title: '年度总结', text }).catch(() => {
            navigator.clipboard?.writeText(text);
            showToast(t('copiedToClipboard'), '📋');
        });
    } else {
        navigator.clipboard?.writeText(text);
        showToast(t('copiedToClipboard'), '📋');
    }
}


// ==================== 初始化增强功能 ====================
function initEnhancedFeatures() {
    // 初始化音乐控制
    initMusicControl();

    // 节日主题
    applyHolidayTheme();

    // 检查里程碑
    checkMilestoneAnniversary();

    // 每日通知
    checkDailyNotif();

    // 照片漂浮
    startPhotoFloating();

    // 暖心文案区
    injectWarmTextZone();

    // 设置页音乐/节日相关
    loadSettingsEnhancements();
    
    // 初始化首页飘落特效
    initFallingEffect();
}

function loadSettingsEnhancements() {
    const settings = loadJson(LOVE_SETTINGS_KEY, {});

    // 音乐开关状态
    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) musicToggle.checked = settings.musicOn !== false;

    // 自动节日
    const autoHolidayToggle = document.getElementById('auto-holiday-toggle');
    if (autoHolidayToggle) autoHolidayToggle.checked = settings.autoHoliday !== false;

    // 情人节日期
    const vd = document.getElementById('valentine-date');
    if (vd && settings.valentineDate) vd.value = settings.valentineDate;

    loadLlmSettingsToForm();
}

// ==================== 首页飘落特效 ====================
const FallingEffects = {
    container: null,
    interval: null,
    effectType: 'hearts',
    
    symbols: {
        hearts: ['💕', '❤️', '💗', '💖', '💓', '💘', '♥️', '💝'],
        petals: ['🌸', '🌺', '🪷', '🌷', '💮', '🏵️', '🌹'],
        stars: ['✨', '⭐', '🌟', '💫', '⚡', '🌠'],
        snow: ['❄️', '❅', '❆', '☃️', '⛄', '🌨️']
    },
    
    init(type = 'hearts') {
        this.effectType = type;
        this.createContainer();
        this.startEffect();
    },
    
    createContainer() {
        if (this.container) this.container.remove();
        this.container = document.createElement('div');
        this.container.id = 'falling-effects-container';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 1;
        `;
        document.body.appendChild(this.container);
    },
    
    startEffect() {
        this.stopEffect();
        if (this.effectType === 'none') return;
        
        const symbols = this.symbols[this.effectType] || this.symbols.hearts;
        const count = 20;
        
        for (let i = 0; i < count; i++) {
            setTimeout(() => this.createParticle(symbols), i * 300);
        }
        
        this.interval = setInterval(() => {
            this.createParticle(symbols);
        }, 600);
    },
    
    createParticle(symbols) {
        const particle = document.createElement('div');
        const type = this.effectType;
        particle.className = `floating-${type === 'hearts' ? 'heart' : type === 'petals' ? 'petal' : type === 'stars' ? 'star' : 'snow'}`;
        particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        particle.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: -50px;
            font-size: ${20 + Math.random() * 14}px;
            text-shadow: 0 0 10px rgba(255, 143, 177, 0.4);
        `;
        
        this.container.appendChild(particle);
        
        setTimeout(() => particle.remove(), 15000);
    },
    
    stopEffect() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    },
    
    setEffect(type) {
        this.effectType = type;
        this.startEffect();
    }
};

function initFallingEffect() {
    const effect = localStorage.getItem('love_fall_effect') || 'hearts';
    FallingEffects.init(effect);
}

function setFallingEffect(type) {
    localStorage.setItem('love_fall_effect', type);
    FallingEffects.setEffect(type);
}

