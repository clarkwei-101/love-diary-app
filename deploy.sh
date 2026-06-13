#!/bin/bash
# 恋爱日记 - 一键部署脚本
# 使用方法: ./deploy.sh

set -e

echo "========================================"
echo "  恋爱日记 App - 部署脚本"
echo "========================================"
echo ""

# Check for vercel
if ! command -v vercel &> /dev/null; then
    echo "正在安装 Vercel CLI..."
    npm install -g vercel
fi

# Check if already logged in
if ! vercel whoami &> /dev/null; then
    echo ""
    echo "请在浏览器中授权 Vercel CLI"
    echo "如果浏览器没有自动打开，请访问: https://vercel.com/verify"
    vercel login
fi

echo ""
echo "正在部署到 Vercel..."
echo ""

cd "$(dirname "$0")"

vercel --yes

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "下一步："
echo "1. 将音乐文件放入 audio/ 目录"
echo "2. 编辑 audio/MUSIC_NOTICE.txt 查看音乐配置"
echo "3. 查看 DEPLOY.md 了解更多部署选项"
echo ""
