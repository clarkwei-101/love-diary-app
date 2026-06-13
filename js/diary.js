/**
 * 恋爱日记 - 日记模块
 * 处理日记的增删改查、心情记录、照片管理
 */

class DiaryManager {
    constructor() {
        this.STORAGE_KEY = 'love_diaries';
        this.MOODS_KEY = 'love_moods';
        this.diaries = this.loadDiaries();
        this.moods = this.loadMoods();
        this.tempPhotos = []; // 临时存储编辑中的照片
    }
    
    /**
     * 从 LocalStorage 加载日记
     */
    loadDiaries() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`${t('t_5ffa3f')}:`, e);
            return [];
        }
    }

    /**
     * 从 LocalStorage 加载心情记录（独立 key 以符合终极版要求）
     */
    loadMoods() {
        try {
            const data = localStorage.getItem(this.MOODS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error(`${t('t_0011a0')}:`, e);
            return {};
        }
    }

    saveMoods() {
        try {
            localStorage.setItem(this.MOODS_KEY, JSON.stringify(this.moods));
            return true;
        } catch (e) {
            console.error(`${t('t_3e8be4')}:`, e);
            return false;
        }
    }
    
    /**
     * 保存日记到 LocalStorage
     */
    saveDiaries() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.diaries));
            return true;
        } catch (e) {
            console.error(`${t('t_8e2f85')}:`, e);
            return false;
        }
    }
    
    /**
     * 获取所有日记（按日期倒序）
     */
    getAllDiaries() {
        return [...this.diaries].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    /**
     * 获取最近的 N 篇日记
     */
    getRecentDiaries(count = 5) {
        return this.getAllDiaries().slice(0, count);
    }
    
    /**
     * 根据 ID 获取日记
     */
    getDiaryById(id) {
        return this.diaries.find(d => d.id === id);
    }
    
    /**
     * 根据日期获取日记
     */
    getDiaryByDate(date) {
        return this.diaries.find(d => d.date === date);
    }
    
    /**
     * 添加/更新日记
     */
    saveDiary(diaryData) {
        const now = new Date().toISOString();
        
        if (diaryData.id) {
            // 更新现有日记
            const index = this.diaries.findIndex(d => d.id === diaryData.id);
            if (index !== -1) {
                this.diaries[index] = {
                    ...this.diaries[index],
                    ...diaryData,
                    updatedAt: now
                };
            }
        } else {
            // 创建新日记
            const newDiary = {
                id: 'diary_' + Date.now(),
                ...diaryData,
                createdAt: now,
                updatedAt: now
            };
            this.diaries.push(newDiary);
        }
        
        const ok = this.saveDiaries();

        // 同步心情记录：按日期存储 mood（用于首页/年度回顾）
        if (ok && diaryData?.date) {
            this.moods[diaryData.date] = diaryData.mood || 7;
            this.saveMoods();
        }

        return ok;
    }
    
    /**
     * 删除日记
     */
    deleteDiary(id) {
        const index = this.diaries.findIndex(d => d.id === id);
        if (index !== -1) {
            const removed = this.diaries[index];
            this.diaries.splice(index, 1);

            const ok = this.saveDiaries();
            if (ok && removed?.date && this.moods?.[removed.date] !== undefined) {
                delete this.moods[removed.date];
                this.saveMoods();
            }
            return ok;
        }
        return false;
    }
    
    /**
     * 获取日记数量
     */
    getDiaryCount() {
        return this.diaries.length;
    }
    
    /**
     * 获取照片数量
     */
    getPhotoCount() {
        return this.diaries.reduce((count, diary) => count + (diary.photos?.length || 0), 0);
    }
    
    /**
     * 获取有记录的天数
     */
    getRecordedDays() {
        const uniqueDates = new Set(this.diaries.map(d => d.date));
        return uniqueDates.size;
    }
    
    /**
     * 获取心情统计数据
     */
    getMoodStats() {
        const stats = {};
        this.diaries.forEach(diary => {
            const mood = diary.mood || 7;
            stats[mood] = (stats[mood] || 0) + 1;
        });
        return stats;
    }
    
    /**
     * 处理图片文件转 Base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * 压缩图片
     */
    compressImage(base64, maxWidth = 800, maxHeight = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                
                // 计算缩放比例
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64;
        });
    }
    
    /**
     * 处理照片上传
     */
    async handlePhotoUpload(files) {
        const photos = [];
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            
            try {
                const base64 = await this.fileToBase64(file);
                const compressed = await this.compressImage(base64);
                photos.push(compressed);
            } catch (e) {
                console.error(`${t('t_bfabba')}:`, e);
            }
        }
        
        return photos;
    }
    
    /**
     * 获取心情文本
     */
    getMoodText(mood) {
        // 心情表情（必须包含：😊😢😡🥰😴😐🤔）
        const moodTexts = {
            1: `${t('t_51ce1c')}...`,
            2: `${t('t_78f5f4')}...`,
            3: `${t('t_91ac4d')}...`,
            4: `${t('t_334b0e')}...`,
            5: `${t('t_55e35f')}`,
            6: `${t('t_787aac')}`,
            7: `${t('t_3d3358')} 💕`
        };
        return moodTexts[mood] || `${t('t_9ed249')}？`;
    }
    
    /**
     * 获取心情表情
     */
    getMoodEmoji(mood) {
        // 心情表情必须包含：😊😢😡🥰😴😐🤔
        const emojis = {
            1: '😢',
            2: '😡',
            3: '😴',
            4: '🥰',
            5: '😐',
            6: '🤔',
            7: '😊'
        };
        return emojis[mood] || '😐';
    }
    
    /**
     * 格式化日期显示
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (dateStr === today.toISOString().split('T')[0]) {
            return '今天';
        } else if (dateStr === yesterday.toISOString().split('T')[0]) {
            return `${t('t_2f8d6f')}`;
        } else {
            return `${date.getMonth() + 1}月${date.getDate()}日`;
        }
    }
    
    /**
     * 格式化完整日期
     */
    formatFullDate(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = [`${t('t_562d74')}`, `${t('t_1603b0')}`, `${t('t_b5a6a0')}`, `${t('t_e60725')}`, `${t('t_170fc8')}`, `${t('t_eb79ce')}`, `${t('t_245751')}`];
        const weekday = weekdays[date.getDay()];
        
        return `${year}年${month}月${day}日 ${weekday}`;
    }
    
    /**
     * 生成摘要
     */
    getExcerpt(content, maxLength = 50) {
        if (!content) return `${t('t_74647c')}`;
        const text = content.replace(/\n/g, ' ').trim();
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    /**
     * 获取每日话题
     */
    getDailyTopic() {
        const topics = [
            `${t('t_a76264')}？`,
            `${t('t_adec45')}`,
            `${t('t_c0db39')}TA${t('t_c8c180')}`,
            `${t('t_9139e2')}？`,
            `${t('t_161fca')}TA${t('t_2c029a')}`,
            `${t('t_708b9e')}？`,
            `${t('t_4bd04c')}TA${t('t_c9c4a5')}`,
            `${t('t_afc7d8')}`,
            `今天TA${t('t_6a677c')}？`,
            `给TA${t('t_9a6b50')}`,
            `${t('t_c0db39')}TA${t('t_63f7e3')}`,
            `${t('t_277c70')}TA${t('t_6f5c4b')}`,
            `${t('t_2bf811')}？`,
            `和TA${t('t_8ba0d8')}`,
            `${t('t_059ad3')}TA${t('t_b8acb3')}？`,
            `${t('t_b951fa')}TA${t('t_a23fb1')}？`,
            `TA${t('t_793014')}？`,
            `${t('t_c0db39')}TA${t('t_1f1096')}`,
            `${t('t_ba666f')}`,
            `${t('t_9a63cb')}TA${t('t_0626fa')}`
        ];
        
        // 根据日期选择一个话题，保证同一天的话题一致
        const today = new Date().toDateString();
        const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const index = seed % topics.length;
        
        return topics[index];
    }
}

// 创建全局实例
const diaryManager = new DiaryManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiaryManager;
}
