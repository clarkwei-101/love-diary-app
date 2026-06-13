# ============================================================
# 恋爱日记 - 纯静态 Nginx 镜像
# ============================================================
FROM nginx:1.27-alpine

# 删除默认配置
RUN rm -rf /etc/nginx/conf.d/default.conf \
            /usr/share/nginx/html/*

# 复制应用文件
COPY index.html .
COPY css/ ./css/
COPY js/ ./js/
COPY audio/ ./audio/
COPY images/ ./images/ 2>/dev/null || true
COPY manifest.json .
COPY sw.js .
COPY nginx.conf /etc/nginx/nginx.conf

# 安全与缓存头
RUN sed -i 's/listen 80 default_server/listen 8080/g' /etc/nginx/nginx.conf || true

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
