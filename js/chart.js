/**
 * 恋爱日记 - 图表模块
 * 轻量级 Canvas 图表绘制，无需外部依赖
 */

class LoveChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        
        // 设置 canvas 尺寸
        this.resize();
        
        // 主题色
        this.colors = {
            primary: '#FF8FB1',
            secondary: '#B76E9F',
            accent: '#FDCB6E',
            success: '#00B894',
            text: '#636E72',
            grid: '#E8E8E8',
            moods: ['#FF6B6B', '#FFA07A', '#FFD93D', '#6BCB77', '#4D96FF', '#9B7EDE', '#FF8FB1']
        };
    }
    
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
        this.width = rect.width;
        this.height = rect.height;
    }
    
    /**
     * 绘制折线图 - 心情趋势
     */
    drawLineChart(data, labels) {
        if (!this.ctx || data.length === 0) return;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const padding = { top: 30, right: 20, bottom: 40, left: 40 };
        const chartWidth = this.width - padding.left - padding.right;
        const chartHeight = this.height - padding.top - padding.bottom;
        
        const maxValue = 7;
        const minValue = 1;
        const valueRange = maxValue - minValue;
        
        // 绘制网格线
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;
        
        // 水平网格线
        for (let i = 0; i <= 6; i++) {
            const y = padding.top + (chartHeight / 6) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(padding.left, y);
            this.ctx.lineTo(this.width - padding.right, y);
            this.ctx.stroke();
            
            // Y轴标签
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = '12px sans-serif';
            this.ctx.textAlign = 'right';
            this.ctx.fillText((7 - i).toString(), padding.left - 8, y + 4);
        }
        
        if (data.length === 0) {
            this.drawNoData();
            return;
        }
        
        const stepX = chartWidth / (Math.max(data.length - 1, 1));
        
        // 绘制渐变填充
        const gradient = this.ctx.createLinearGradient(0, padding.top, 0, this.height - padding.bottom);
        gradient.addColorStop(0, 'rgba(255, 143, 177, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 143, 177, 0.0)');
        
        this.ctx.beginPath();
        this.ctx.moveTo(padding.left, this.height - padding.bottom);
        
        data.forEach((value, index) => {
            const x = padding.left + index * stepX;
            const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
            
            if (index === 0) {
                this.ctx.lineTo(x, y);
            } else {
                // 使用贝塞尔曲线使线条平滑
                const prevX = padding.left + (index - 1) * stepX;
                const prevY = padding.top + chartHeight - ((data[index - 1] - minValue) / valueRange) * chartHeight;
                const cpX = (prevX + x) / 2;
                this.ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
                this.ctx.quadraticCurveTo(x, y, x, y);
            }
        });
        
        this.ctx.lineTo(padding.left + (data.length - 1) * stepX, this.height - padding.bottom);
        this.ctx.closePath();
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // 绘制线条
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        data.forEach((value, index) => {
            const x = padding.left + index * stepX;
            const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                const prevX = padding.left + (index - 1) * stepX;
                const prevY = padding.top + chartHeight - ((data[index - 1] - minValue) / valueRange) * chartHeight;
                const cpX = (prevX + x) / 2;
                this.ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
                this.ctx.quadraticCurveTo(x, y, x, y);
            }
        });
        
        this.ctx.stroke();
        
        // 绘制数据点
        data.forEach((value, index) => {
            const x = padding.left + index * stepX;
            const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
            
            // 外圈
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, Math.PI * 2);
            this.ctx.fillStyle = 'white';
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.primary;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // 内圈
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = this.colors.primary;
            this.ctx.fill();
        });
        
        // X轴标签
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        
        labels.forEach((label, index) => {
            const x = padding.left + index * stepX;
            this.ctx.fillText(label, x, this.height - padding.bottom + 18);
        });
    }
    
    /**
     * 绘制饼图 - 心情分布
     */
    drawPieChart(data) {
        if (!this.ctx || data.length === 0) {
            this.drawNoData();
            return;
        }
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        const total = data.reduce((sum, item) => sum + item.value, 0);
        
        if (total === 0) {
            this.drawNoData();
            return;
        }
        
        let currentAngle = -Math.PI / 2;
        
        data.forEach((item, index) => {
            const sliceAngle = (item.value / total) * Math.PI * 2;
            const endAngle = currentAngle + sliceAngle;
            
            // 绘制扇形
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
            this.ctx.closePath();
            this.ctx.fillStyle = this.colors.moods[index % this.colors.moods.length];
            this.ctx.fill();
            
            // 绘制边框
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // 绘制标签
            if (sliceAngle > 0.3) {
                const labelAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 14px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(item.emoji || '', labelX, labelY);
            }
            
            currentAngle = endAngle;
        });
        
        // 中心圆
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 0.35, 0, Math.PI * 2);
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        
        // 中心文字
        this.ctx.fillStyle = this.colors.primary;
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${t('t_ba89e6')}`, centerX, centerY - 8);
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(`${t('t_b2c9e4')}`, centerX, centerY + 10);
    }
    
    /**
     * 无数据提示
     */
    drawNoData() {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('暂无数据', this.width / 2, this.height / 2);
    }
}

/**
 * 创建心情统计数据
 */
function createMoodStats(diaries) {
    const moodMap = {
        1: { emoji: '😢', label: '难过', color: '#FF6B6B' },
        2: { emoji: '😡', label: '生气', color: '#FF4757' },
        3: { emoji: '😴', label: '困倦', color: '#B2BEC3' },
        4: { emoji: '🥰', label: '甜蜜', color: '#9B7EDE' },
        5: { emoji: '😐', label: '平静', color: '#FFD93D' },
        6: { emoji: '🤔', label: `${t('t_e3b622')}`, color: '#FFA07A' },
        7: { emoji: '😊', label: '开心', color: '#4D96FF' }
    };
    
    const counts = {};
    diaries.forEach(diary => {
        counts[diary.mood] = (counts[diary.mood] || 0) + 1;
    });
    
    return Object.entries(counts)
        .map(([mood, count]) => ({
            mood: parseInt(mood),
            value: count,
            ...moodMap[mood]
        }))
        .sort((a, b) => b.value - a.value);
}

/**
 * 获取最近7天的心情数据
 */
function getRecentMoodData(diaries) {
    const dates = [];
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const label = i === 0 ? '今天' : i === 1 ? `${t('t_2f8d6f')}` : `${date.getMonth() + 1}/${date.getDate()}`;
        
        dates.push(label);
        
        const diary = diaries.find(d => d.date === dateStr);
        data.push(diary ? diary.mood : 7); // 默认心情7（😊）
    }
    
    return { labels: dates, data };
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoveChart, createMoodStats, getRecentMoodData };
}
