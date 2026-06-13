/**
 * 恋爱日记 - 情侣匹配模块
 * 负责生成二维码、扫描二维码、情侣绑定
 */

// 生成唯一的配对码
function generatePairingCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 生成配对信息（包含用户信息和配对码）
function generatePairingInfo() {
    const coupleInfo = typeof anniversaryManager !== 'undefined' ? anniversaryManager.getCoupleInfo() : null;
    const userName = coupleInfo ? coupleInfo.name1 : '我';
    const userAvatar = coupleInfo ? coupleInfo.avatar : '💕';
    
    const pairingCode = generatePairingCode();
    const timestamp = Date.now();
    
    const pairingInfo = {
        code: pairingCode,
        userName: userName,
        userAvatar: userAvatar,
        timestamp: timestamp,
        platform: 'love-diary-app'
    };
    
    return pairingInfo;
}

// 将配对信息编码为JSON字符串
function encodePairingInfo(info) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(info))));
}

// 解码配对信息
function decodePairingInfo(encoded) {
    try {
        const json = decodeURIComponent(escape(atob(encoded)));
        return JSON.parse(json);
    } catch (e) {
        console.error(`${t('t_e13a69')}:`, e);
        return null;
    }
}

// 生成本地配对码（用于本地存储验证）
function generateLocalPairingData() {
    const info = generatePairingInfo();
    const encoded = encodePairingInfo(info);
    
    // 保存到本地存储
    localStorage.setItem('love_pairing_info', JSON.stringify({
        ...info,
        encoded: encoded,
        createdAt: new Date().toISOString()
    }));
    
    return {
        info: info,
        encoded: encoded,
        qrData: `LOVE:${encoded}`
    };
}

// 获取本地配对信息
function getLocalPairingInfo() {
    try {
        const stored = localStorage.getItem('love_pairing_info');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error(`${t('t_b54bea')}:`, e);
    }
    return null;
}

// 检查是否已配对
function isPaired() {
    const pairingData = getLocalPairingData();
    return pairingData && pairingData.paired && pairingData.partner;
}

// 获取配对数据
function getLocalPairingData() {
    try {
        const stored = localStorage.getItem('love_pairing_data');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error(`${t('t_617878')}:`, e);
    }
    return null;
}

// 保存配对数据
function savePairingData(data) {
    localStorage.setItem('love_pairing_data', JSON.stringify(data));
}

// 处理扫描到的配对码
function handleScannedPairingCode(scannedData) {
    // 移除前缀
    let encoded = scannedData;
    if (scannedData.startsWith('LOVE:')) {
        encoded = scannedData.substring(5);
    }
    
    const partnerInfo = decodePairingInfo(encoded);
    if (!partnerInfo) {
        showToast(`${t('t_1dceab')}`, '❌');
        return null;
    }
    
    // 检查是否扫描自己的码
    const localInfo = getLocalPairingInfo();
    if (localInfo && localInfo.code === partnerInfo.code) {
        showToast(`${t('t_70f3a4')}`, '⚠️');
        return null;
    }
    
    return partnerInfo;
}

// 完成配对
function completePairing(partnerInfo) {
    const pairingData = {
        paired: true,
        pairedAt: new Date().toISOString(),
        partner: partnerInfo,
        local: getLocalPairingInfo()
    };
    
    savePairingData(pairingData);
    
    // 更新本地配对信息，添加伙伴信息
    const localInfo = getLocalPairingInfo();
    if (localInfo) {
        localInfo.partner = partnerInfo;
        localStorage.setItem('love_pairing_info', JSON.stringify(localInfo));
    }
    
    // 更新UI
    updateCoupleHeaderWithPartner(partnerInfo);
    
    showToast(`与 ${partnerInfo.userName} 配对成功！💕`, '🎉');
    
    // 触发配对成功事件
    window.dispatchEvent(new CustomEvent('couple-paired', { detail: pairingData }));
    
    return pairingData;
}

// 更新顶部栏显示匹配后的双方头像
function updateCoupleHeaderWithPartner(partnerInfo) {
    const coupleAvatar = document.getElementById('couple-avatar');
    const displayName2 = document.getElementById('display-name2');
    
    if (partnerInfo) {
        // 显示双方头像
        const localInfo = getLocalPairingInfo();
        const myAvatar = localInfo ? localInfo.userAvatar : '💕';
        const partnerAvatar = partnerInfo.userAvatar;
        
        coupleAvatar.innerHTML = `
            <div class="couple-avatars-row">
                <span class="avatar-mini">${myAvatar}</span>
                <span class="heart-connector">💕</span>
                <span class="avatar-mini">${partnerAvatar}</span>
            </div>
        `;
        
        // 更新伴侣名字
        if (displayName2) {
            displayName2.textContent = partnerInfo.userName;
        }
    }
}

// 解除配对
function unpairCouple() {
    showConfirm(`${t('t_de09cf')}。`, () => {
        localStorage.removeItem('love_pairing_data');
        // 重置显示
        const coupleInfo = anniversaryManager.getCoupleInfo();
        if (coupleInfo) {
            document.getElementById('couple-avatar').innerHTML = coupleInfo.avatar;
            document.getElementById('display-name2').textContent = 'TA';
        }
        showToast(`${t('t_4eec96')}`, '👋');
        window.dispatchEvent(new CustomEvent('couple-unpaired'));
    });
}

// 显示匹配页面
function showMatchingPage() {
    // 初始化配对信息
    const pairingData = generateLocalPairingData();
    
    // 生成二维码
    const qrContainer = document.getElementById('qr-code-container');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        QRCode.toCanvas(qrData, 220, {
            margin: 2,
            color: {
                dark: '#FF8FB1',
                light: '#ffffff'
            }
        }, (error, canvas) => {
            if (error) {
                console.error(`${t('t_60cb8f')}:`, error);
                qrContainer.innerHTML = `<p style="color:#FF8FB1;">二维码生成${t('t_acd5cb')}</p>`;
                return;
            }
            canvas.id = 'pairing-qr-canvas';
            qrContainer.appendChild(canvas);
        });
    }
    
    // 显示配对码
    const codeDisplay = document.getElementById('pairing-code-display');
    if (codeDisplay && pairingData.info) {
        codeDisplay.textContent = pairingData.info.code;
    }
    
    // 切换到匹配页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-matching')?.classList.add('active');
}

// 打开扫描器
function openScanner() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) {
        scannerModal.classList.remove('hidden');
        startScanner();
    }
}

// 关闭扫描器
function closeScanner() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) {
        scannerModal.classList.add('hidden');
        stopScanner();
    }
}

// 启动扫描器
function startScanner() {
    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-canvas');
    const ctx = canvas?.getContext('2d');
    
    if (!video || !canvas || !ctx) return;
    
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
    }).then(stream => {
        video.srcObject = stream;
        video.play();
        
        const scanFrame = () => {
            if (!video.srcObject) return;
            
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                try {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code && code.data) {
                        handleScannedPairingCode(code.data);
                        closeScanner();
                        return;
                    }
                } catch (e) {}
            }
            
            requestAnimationFrame(scanFrame);
        };
        
        scanFrame();
    }).catch(err => {
        console.error(`${t('t_2a0d17')}:`, err);
        showToast(`${t('t_97564e')}`, '📷');
        closeScanner();
    });
}

// 停止扫描器
function stopScanner() {
    const video = document.getElementById('scanner-video');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

// 手动输入配对码
function handleManualPairingCode() {
    const input = document.getElementById('manual-pairing-input');
    if (!input) return;
    
    const code = input.value.trim().toUpperCase();
    if (code.length < 8) {
        showToast(`${t('t_892e52')}`, '⚠️');
        return;
    }
    
    // 这里需要通过网络或其他方式验证配对码
    // 由于是纯前端应用，暂时使用本地存储模拟
    showToast(`${t('t_8ad173')}`, '📡');
}

// 导出配对模块
window.MatchingModule = {
    generateLocalPairingData,
    getLocalPairingInfo,
    getLocalPairingData,
    isPaired,
    handleScannedPairingCode,
    completePairing,
    unpairCouple,
    showMatchingPage,
    openScanner,
    closeScanner,
    handleManualPairingCode,
    updateCoupleHeaderWithPartner
};
