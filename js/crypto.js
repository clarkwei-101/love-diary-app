/**
 * 恋爱日记 - 本地数据加密模块
 * 使用 Web Crypto API（AES-GCM + PBKDF2）加密本地存储数据
 * 用户设置 PIN 后自动启用加密
 */

const ENCRYPTION_ENABLED_KEY = 'love_encryption_enabled';
const ENCRYPTION_SALT_KEY  = 'love_encryption_salt';
const ENCRYPTION_IV_LEN   = 12;   // AES-GCM 推荐 IV 长度
const PBKDF2_ITERATIONS   = 100000; // PBKDF2 迭代次数（OWASP 2023 建议）
const PBKDF2_KEY_LEN      = 256;   // AES-256
const ALGO                 = 'AES-GCM';

/** 检查是否启用了数据加密 */
function isEncryptionEnabled() {
    return localStorage.getItem(ENCRYPTION_ENABLED_KEY) === 'true';
}

/** 获取加密密钥（从 PIN 派生）*/
async function getEncryptionKey() {
    const saltB64 = localStorage.getItem(ENCRYPTION_SALT_KEY);
    if (!saltB64) return null;

    const pin = localStorage.getItem('love_pin_code');
    if (!pin) return null;

    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

    const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pin),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        baseKey,
        { name: ALGO, length: PBKDF2_KEY_LEN },
        false,
        ['encrypt', 'decrypt']
    );
}

/** 初始化盐（首次启用加密时调用）*/
async function initEncryption() {
    if (!isEncryptionEnabled()) return false;

    const existingSalt = localStorage.getItem(ENCRYPTION_SALT_KEY);
    if (!existingSalt) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        localStorage.setItem(ENCRYPTION_SALT_KEY, btoa(String.fromCharCode(...salt)));
    }
    return true;
}

/** 加密字符串 → base64 编码的密文 */
async function encrypt(plaintext) {
    const key = await getEncryptionKey();
    if (!key) return plaintext;

    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LEN));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        key,
        encoded
    );

    // 格式：base64(iv) + ':' + base64(ciphertext)
    const ivB64    = btoa(String.fromCharCode(...iv));
    const ctB64    = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    return ivB64 + ':' + ctB64;
}

/** 解密 base64 密文 → 原始字符串 */
async function decrypt(ciphertext) {
    if (!isEncryptionEnabled()) return ciphertext;
    if (!ciphertext.includes(':')) {
        // 没有 ':' 说明是未加密数据，直接返回
        return ciphertext;
    }

    try {
        const key = await getEncryptionKey();
        if (!key) return ciphertext;

        const [ivB64, ctB64] = ciphertext.split(':');
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));

        const plaintext = await crypto.subtle.decrypt(
            { name: ALGO, iv },
            key,
            ct
        );

        return new TextDecoder().decode(plaintext);
    } catch (e) {
        console.warn('Decryption failed (wrong PIN or corrupted data):', e);
        return ciphertext; // 回退：返回原始密文避免破坏应用
    }
}

/** 异步加密存储（设置值）*/
async function encryptedSetItem(key, value) {
    if (!isEncryptionEnabled()) {
        localStorage.setItem(key, value);
        return;
    }
    const encrypted = await encrypt(value);
    localStorage.setItem(key, encrypted);
}

/** 异步解密读取（获取值）*/
async function encryptedGetItem(key) {
    if (!isEncryptionEnabled()) {
        return localStorage.getItem(key);
    }
    const raw = localStorage.getItem(key);
    if (!raw) return raw;
    return decrypt(raw);
}

/** 加密存储 JSON 对象 */
async function encryptedSaveJson(key, data) {
    await encryptedSetItem(key, JSON.stringify(data));
}

/** 解密读取 JSON 对象 */
async function encryptedLoadJson(key, defaultVal = null) {
    const raw = await encryptedGetItem(key);
    if (!raw) return defaultVal;
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn(`Failed to parse encrypted JSON for key: ${key}`, e);
        return defaultVal;
    }
}

/** 迁移现有数据到加密格式（一次性）*/
async function migrateToEncryption() {
    if (!isEncryptionEnabled()) return;

    const PIN_KEYS = [
        'love_diaries', 'love_anniversaries', 'love_bills', 'love_vault',
        'love_wishes', 'love_quiz_results', 'love_photos', 'love_messages',
        'love_settings', 'love_llm_settings', 'love_custom_music_tracks'
    ];

    for (const key of PIN_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw && !raw.includes(':')) {
            // 尚未加密，进行加密
            const encrypted = await encrypt(raw);
            localStorage.setItem(key, encrypted);
        }
    }
}

/** 启用加密（用户设置 PIN 后调用）*/
async function enableEncryption() {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(ENCRYPTION_SALT_KEY, btoa(String.fromCharCode(...salt)));
    localStorage.setItem(ENCRYPTION_ENABLED_KEY, 'true');
    await migrateToEncryption();
}

/** 禁用加密（用户关闭时调用）*/
async function disableEncryption() {
    if (!isEncryptionEnabled()) return;

    const PIN_KEYS = [
        'love_diaries', 'love_anniversaries', 'love_bills', 'love_vault',
        'love_wishes', 'love_quiz_results', 'love_photos', 'love_messages',
        'love_settings', 'love_llm_settings', 'love_custom_music_tracks'
    ];

    for (const key of PIN_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw && raw.includes(':')) {
            // 已加密，先解密再存储明文
            try {
                const decrypted = await decrypt(raw);
                localStorage.setItem(key, decrypted);
            } catch (e) {}
        }
    }

    localStorage.removeItem(ENCRYPTION_ENABLED_KEY);
    localStorage.removeItem(ENCRYPTION_SALT_KEY);
}
