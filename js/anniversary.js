/**
 * 恋爱日记 - 纪念日模块
 * 处理纪念日的管理、倒计时计算、时间轴展示
 */

class AnniversaryManager {
    constructor() {
        this.STORAGE_KEY = 'love_anniversaries';
        this.COUPLE_KEY = 'love_couple_info';
        this.anniversaries = this.loadAnniversaries();
    }
    
    /**
     * 加载纪念日数据
     */
    loadAnniversaries() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`${t('t_46ba37')}:`, e);
            return [];
        }
    }
    
    /**
     * 保存纪念日数据
     */
    saveAnniversaries() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.anniversaries));
            return true;
        } catch (e) {
            console.error(`${t('t_d40bb2')}:`, e);
            return false;
        }
    }
    
    /**
     * 获取情侣信息
     */
    getCoupleInfo() {
        try {
            const data = localStorage.getItem(this.COUPLE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`${t('t_a8db4a')}:`, e);
            return null;
        }
    }
    
    /**
     * 保存情侣信息
     */
    saveCoupleInfo(info) {
        try {
            localStorage.setItem(this.COUPLE_KEY, JSON.stringify(info));
            return true;
        } catch (e) {
            console.error(`${t('t_aa16cf')}:`, e);
            return false;
        }
    }
    
    /**
     * 计算恋爱天数
     */
    getLoveDays() {
        const coupleInfo = this.getCoupleInfo();
        if (!coupleInfo || !coupleInfo.startDate) return 0;
        
        const startDate = new Date(coupleInfo.startDate);
        const today = new Date();
        
        // 重置时间为当天零点，只计算天数差
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today - startDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays + 1); // 第1天是开始的那一天
    }
    
    /**
     * 获取恋爱时间详情
     */
    getLoveTimeDetails() {
        const coupleInfo = this.getCoupleInfo();
        if (!coupleInfo || !coupleInfo.startDate) return null;
        
        const startDate = new Date(coupleInfo.startDate);
        const now = new Date();
        
        const diffTime = now - startDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        return {
            days: diffDays,
            months: Math.floor(diffDays / 30.44),
            weeks: Math.floor(diffDays / 7),
            hours: Math.floor(diffTime / (1000 * 60 * 60)),
            minutes: Math.floor(diffTime / (1000 * 60)),
            years: (diffDays / 365.25).toFixed(1)
        };
    }
    
    /**
     * 获取所有纪念日（包含系统生成的）
     */
    getAllAnniversaries() {
        const coupleInfo = this.getCoupleInfo();
        const all = [];
        
        if (coupleInfo && coupleInfo.startDate) {
            // 添加恋爱开始日
            all.push({
                id: 'start_date',
                title: `${t('t_7b28ff')}`,
                date: coupleInfo.startDate,
                type: 'anniversary',
                isSystem: true
            });
            
            // 添加年度纪念日
            const startDate = new Date(coupleInfo.startDate);
            const today = new Date();
            const years = today.getFullYear() - startDate.getFullYear();
            
            for (let i = 1; i <= years + 1; i++) {
                const anniDate = new Date(startDate);
                anniDate.setFullYear(startDate.getFullYear() + i);
                
                all.push({
                    id: `anniversary_${i}`,
                    title: `${i}${t('t_eacb01')}`,
                    date: anniDate.toISOString().split('T')[0],
                    type: 'anniversary',
                    isSystem: true
                });
            }
        }
        
        // 添加用户自定义纪念日
        all.push(...this.anniversaries);
        
        return all;
    }
    
    /**
     * 获取即将到来的纪念日
     */
    getUpcomingAnniversaries(count = 3) {
        const all = this.getAllAnniversaries();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 计算距离天数并排序
        const withDays = all.map(anni => {
            const anniDate = new Date(anni.date);
            anniDate.setHours(0, 0, 0, 0);
            
            // 将纪念日调整为今年或明年
            const thisYear = new Date(today);
            thisYear.setMonth(anniDate.getMonth(), anniDate.getDate());
            
            if (thisYear < today) {
                thisYear.setFullYear(thisYear.getFullYear() + 1);
            }
            
            const daysLeft = Math.floor((thisYear - today) / (1000 * 60 * 60 * 24));
            
            return {
                ...anni,
                daysLeft,
                nextDate: thisYear.toISOString().split('T')[0]
            };
        });
        
        // 按距离天数排序
        withDays.sort((a, b) => a.daysLeft - b.daysLeft);
        
        return withDays.slice(0, count);
    }
    
    /**
     * 添加纪念日
     */
    addAnniversary(anniversary) {
        const newAnniversary = {
            id: 'anni_' + Date.now(),
            ...anniversary,
            createdAt: new Date().toISOString()
        };
        
        this.anniversaries.push(newAnniversary);
        return this.saveAnniversaries();
    }
    
    /**
     * 更新纪念日
     */
    updateAnniversary(id, updates) {
        const index = this.anniversaries.findIndex(a => a.id === id);
        if (index !== -1) {
            this.anniversaries[index] = {
                ...this.anniversaries[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            return this.saveAnniversaries();
        }
        return false;
    }
    
    /**
     * 删除纪念日
     */
    deleteAnniversary(id) {
        const index = this.anniversaries.findIndex(a => a.id === id);
        if (index !== -1) {
            this.anniversaries.splice(index, 1);
            return this.saveAnniversaries();
        }
        return false;
    }
    
    /**
     * 获取纪念日类型图标
     */
    getTypeIcon(type) {
        const icons = {
            date: '📅',
            birthday: '🎂',
            meeting: '✨',
            anniversary: '💍',
            travel: '✈️',
            movie: '🎬',
            food: '🍽️',
            gift: '🎁'
        };
        return icons[type] || '📅';
    }
    
    /**
     * 获取纪念日类型名称
     */
    getTypeName(type) {
        const names = {
            date: `${t('t_35242c')}`,
            birthday: `${t('t_8483ed')}`,
            meeting: `${t('t_2a6a9b')}`,
            anniversary: '纪念日',
            travel: `${t('t_874834')}`,
            movie: `${t('t_51e974')}`,
            food: `${t('t_c89227')}`,
            gift: `${t('t_117f5c')}`
        };
        return names[type] || `${t('t_35242c')}`;
    }
    
    /**
     * 格式化日期显示
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}年${month}月${day}日`;
    }
    
    /**
     * 获取距离描述
     */
    getDaysLeftText(days) {
        if (days === 0) return '今天';
        if (days === 1) return `${t('t_8bcbd7')}`;
        return `${days}${t('t_17fbc2')}`;
    }
    
    /**
     * 获取恋爱时间轴数据
     */
    getTimeline() {
        const coupleInfo = this.getCoupleInfo();
        if (!coupleInfo || !coupleInfo.startDate) return [];
        
        const timeline = [];
        const startDate = new Date(coupleInfo.startDate);
        
        // 开始日期
        timeline.push({
            date: coupleInfo.startDate,
            title: `${t('t_7b28ff')} 💕`,
            description: `${t('t_cbc716')}`
        });
        
        // 添加重要里程碑
        const milestones = [100, 200, 300, 365, 520, 666, 999, 1000];
        const today = new Date();
        
        milestones.forEach(days => {
            const milestoneDate = new Date(startDate);
            milestoneDate.setDate(milestoneDate.getDate() + days - 1);
            
            if (milestoneDate <= today) {
                let title = '';
                if (days === 365) title = `${t('t_e0b748')}1${t('t_738b91')} 💍`;
                else if (days === 520) title = `520${t('t_f8bbf6')} ❤️`;
                else if (days === 999) title = `999${t('t_f7343c')} 💑`;
                else if (days === 1000) title = `1000${t('t_f8bbf6')} 🎉`;
                else title = `${t('t_e0b748')}${days}天`;
                
                timeline.push({
                    date: milestoneDate.toISOString().split('T')[0],
                    title,
                    description: `${t('t_1613dd')}${days}天`
                });
            }
        });
        
        // 添加用户自定义纪念日
        const allAnniversaries = this.getAllAnniversaries();
        allAnniversaries.forEach(anni => {
            if (!anni.isSystem) {
                timeline.push({
                    date: anni.date,
                    title: anni.title,
                    description: anni.description || this.getTypeName(anni.type)
                });
            }
        });
        
        // 按日期排序
        timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return timeline;
    }
    
    /**
     * 导出所有数据
     */
    exportData() {
        return {
            coupleInfo: this.getCoupleInfo(),
            anniversaries: this.anniversaries,
            exportDate: new Date().toISOString()
        };
    }
    
    /**
     * 导入数据
     */
    importData(data) {
        if (data.coupleInfo) {
            this.saveCoupleInfo(data.coupleInfo);
        }
        if (Array.isArray(data.anniversaries)) {
            this.anniversaries = data.anniversaries;
            this.saveAnniversaries();
        }
        return true;
    }
}

// 创建全局实例
const anniversaryManager = new AnniversaryManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnniversaryManager;
}
