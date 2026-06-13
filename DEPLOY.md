# 恋爱日记 App 部署指南

## 快速部署（推荐）

### 方式一：Vercel（免费，自动 HTTPS，全球 CDN）

**前提条件：** GitHub 账号

1. 将项目上传到 GitHub 仓库：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/love-diary-app.git
   git push -u origin main
   ```

2. 登录 [vercel.com](https://vercel.com)，点击 "Add New Project"

3. 导入你的 GitHub 仓库，选择 "Import"

4. 保持默认配置（Framework: Other），点击 "Deploy"

5. 等待部署完成，获得一个 `.vercel.app` 域名

6. **（可选）** 绑定自定义域名：Settings → Domains

---

### 方式二：Railway.app（支持 Docker，自动 HTTPS）

1. 将项目上传到 GitHub 仓库

2. 登录 [railway.app](https://railway.app)

3. 点击 "New Project" → "Deploy from GitHub repo"

4. 选择你的仓库，Railway 会自动检测 Dockerfile 并部署

5. Railway 提供一个 `.up.railway.app` 域名

---

### 方式三：Docker 自托管（VPS / 云服务器）

```bash
# 方式 A: 直接构建运行
docker build -t love-diary .
docker run -d -p 80:80 --name love-diary -e PORT=80 love-diary

# 方式 B: Docker Compose
docker-compose up -d

# 方式 C: 使用已有镜像（如部署到服务器）
scp Dockerfile nginx.conf www.tar.gz user@your-server:/opt/love-diary/
```

---

## 背景音乐配置

### 内置音乐

将 MP3 文件放入 `audio/` 目录，推荐文件命名（纯 ASCII）：

```
audio/
  violet.mp3          # 歌曲1
  you-have-me.mp3    # 歌曲2
  love-message.mp3   # 歌曲3
```

### 公网 CDN 音乐

在 `js/app.js` 的 `getBuiltinMusicTracks()` 函数中添加 CDN URL：

```javascript
{ id: 'cdn1', name: '歌曲名', src: 'https://your-cdn.com/music.mp3' }
```

推荐 CDN 服务：
- **Cloudflare R2**（免费 10GB/月）
- **阿里云 OSS**（付费，但国内速度快）
- **腾讯 COS**（付费）
- **七牛云**（免费 10GB）

### 获取音乐

1. 网易云音乐（搜索 → 下载）
2. QQ 音乐 / 酷狗音乐
3. YouTube Music → 音频提取
4. Spotify 下载后转换格式

> **注意：** 请尊重版权，仅使用你有权使用的音乐文件。

---

## 目录结构说明

```
love-diary-app/
├── index.html          # 主入口 HTML
├── css/style.css       # 样式表
├── js/app.js          # 主应用逻辑
├── js/diary.js        # 日记模块
├── js/anniversary.js  # 纪念日模块
├── js/chart.js        # 图表模块
├── js/i18n.js         # 国际化
├── sw.js              # Service Worker（PWA离线）
├── manifest.json      # PWA清单
├── audio/             # 背景音乐目录
│   └── MUSIC_NOTICE.txt  # 音乐配置说明
├── assets/icons.svg   # 统一SVG图标库
├── vercel.json        # Vercel部署配置
├── Dockerfile         # Docker部署配置
├── nginx.conf         # Nginx配置
└── railway.json       # Railway部署配置
```

---

## HTTPS 与安全

- Vercel / Railway 默认提供免费 HTTPS 证书
- Docker 自托管需要配置 Let's Encrypt：
  ```bash
  certbot --nginx -d yourdomain.com
  ```

---

## PWA 安装到手机

部署后，用手机访问网站，浏览器会提示"添加到主屏幕"，安装后即可离线使用。

---

## 性能优化建议

1. 音乐文件使用 CDN 加载，不占用应用体积
2. 图片使用 WebP 格式
3. 启用 Vercel 的 Edge Caching
4. 背景音乐延迟加载（首屏不加载）
