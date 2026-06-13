/**
 * 恋爱日记 - 相册模块
 * 包含共同相册和个人相册
 */

const AlbumModule = {
    STORAGE_KEY: 'album_photos',
    PERSONAL_KEY: 'personal_album',
    
    // 获取相册数据
    getPhotos() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },
    
    // 获取个人相册
    getPersonalPhotos() {
        try {
            const data = localStorage.getItem(this.PERSONAL_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },
    
    // 保存共同相册
    savePhotos(photos) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(photos));
    },
    
    // 保存个人相册
    savePersonalPhotos(photos) {
        localStorage.setItem(this.PERSONAL_KEY, JSON.stringify(photos));
    },
    
    // 添加照片到共同相册
    addPhoto(src, uploader = 'me') {
        const photos = this.getPhotos();
        const newPhoto = {
            id: Date.now().toString(),
            src: src,
            uploader: uploader,
            timestamp: new Date().toISOString()
        };
        photos.unshift(newPhoto);
        this.savePhotos(photos);
        return newPhoto;
    },
    
    // 添加照片到个人相册
    addPersonalPhoto(src) {
        const photos = this.getPersonalPhotos();
        const newPhoto = {
            id: Date.now().toString(),
            src: src,
            timestamp: new Date().toISOString()
        };
        photos.unshift(newPhoto);
        this.savePersonalPhotos(photos);
        return newPhoto;
    },
    
    // 删除共同相册照片
    deletePhoto(photoId) {
        const photos = this.getPhotos();
        const filtered = photos.filter(p => p.id !== photoId);
        this.savePhotos(filtered);
    },
    
    // 删除个人照片
    deletePersonalPhoto(photoId) {
        const photos = this.getPersonalPhotos();
        const filtered = photos.filter(p => p.id !== photoId);
        this.savePersonalPhotos(filtered);
    },
    
    // 绑定个人相册到共同相册
    bindToShared(bindingId) {
        const settings = this.getSettings();
        settings.personalBinding = bindingId;
        this.saveSettings(settings);
    },
    
    // 获取设置
    getSettings() {
        try {
            const data = localStorage.getItem('album_settings');
            return data ? JSON.parse(data) : { personalBinding: null };
        } catch (e) {
            return { personalBinding: null };
        }
    },
    
    // 保存设置
    saveSettings(settings) {
        localStorage.setItem('album_settings', JSON.stringify(settings));
    }
};

// 相册页面状态
let currentAlbumTab = 'shared'; // 'shared' | 'personal'

function initAlbumModule() {
    renderAlbumTabs();
    renderAlbumPhotos();
    bindAlbumEvents();
}

function renderAlbumTabs() {
    const container = document.getElementById('album-tabs-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="album-tabs">
            <button class="album-tab ${currentAlbumTab === 'shared' ? 'active' : ''}" onclick="switchAlbumTab('shared')">
                📸 共同相册
            </button>
            <button class="album-tab ${currentAlbumTab === 'personal' ? 'active' : ''}" onclick="switchAlbumTab('personal')">
                👤 个人相册
            </button>
        </div>
    `;
}

function switchAlbumTab(tab) {
    currentAlbumTab = tab;
    renderAlbumTabs();
    renderAlbumPhotos();
}

function renderAlbumPhotos() {
    const container = document.getElementById('album-photos-grid');
    if (!container) return;
    
    let photos = [];
    let emptyMessage = '';
    
    if (currentAlbumTab === 'shared') {
        photos = AlbumModule.getPhotos();
        emptyMessage = `${t('t_d77612')}~`;
    } else {
        photos = AlbumModule.getPersonalPhotos();
        emptyMessage = `${t('t_3c8693')}~`;
    }
    
    if (photos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📷</span>
                <p>${emptyMessage}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = photos.map(photo => `
        <div class="album-item" onclick="previewPhoto('${photo.src}')">
            <img src="${photo.src}" alt="${t('t_d2fb1e')}" loading="lazy">
            ${photo.uploader ? `<span class="album-item-badge">${photo.uploader === 'me' ? '我' : 'TA'}</span>` : ''}
            <button class="album-item-delete" onclick="event.stopPropagation();deletePhoto('${photo.id}')">🗑️</button>
        </div>
    `).join('');
}

function previewPhoto(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    
    if (img) {
        img.src = src;
    }
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function deletePhoto(photoId) {
    showConfirm(`${t('t_a50645')}？`, () => {
        if (currentAlbumTab === 'shared') {
            AlbumModule.deletePhoto(photoId);
        } else {
            AlbumModule.deletePersonalPhoto(photoId);
        }
        renderAlbumPhotos();
        showToast(`${t('t_50ebb7')}`, '🗑️');
    });
}

function handleAlbumUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const src = event.target.result;
            
            if (currentAlbumTab === 'shared') {
                AlbumModule.addPhoto(src, 'me');
            } else {
                AlbumModule.addPersonalPhoto(src);
            }
            
            renderAlbumPhotos();
        };
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
    showToast(`${t('t_ede542')} 💕`, '✅');
}

function addPhotoFromUrl() {
    const input = document.getElementById('album-url-input');
    const url = input?.value.trim();
    
    if (!url) {
        showToast(`${t('t_6c19ad')}URL`, '⚠️');
        return;
    }
    
    if (currentAlbumTab === 'shared') {
        AlbumModule.addPhoto(url, 'me');
    } else {
        AlbumModule.addPersonalPhoto(url);
    }
    
    input.value = '';
    renderAlbumPhotos();
    showToast(`${t('t_c2d66c')}`, '✅');
}

function bindAlbumEvents() {
    document.getElementById('btn-upload-album')?.addEventListener('click', () => {
        document.getElementById('album-upload-input')?.click();
    });
    
    document.getElementById('album-upload-input')?.addEventListener('change', handleAlbumUpload);
    document.getElementById('btn-add-album-url')?.addEventListener('click', addPhotoFromUrl);
    
    // 模态框关闭
    document.getElementById('image-modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
            document.getElementById('image-modal')?.classList.add('hidden');
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 导出
window.AlbumModule = AlbumModule;
window.initAlbumModule = initAlbumModule;
window.switchAlbumTab = switchAlbumTab;
window.renderAlbumPhotos = renderAlbumPhotos;
window.previewPhoto = previewPhoto;
window.deletePhoto = deletePhoto;
