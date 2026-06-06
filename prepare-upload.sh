#!/bin/bash
# 将所有需要上传到云存储的图片归集到 upload/ 目录
# 上传后云存储的目录结构应为:
#   claw-assets/bg/T1.jpg
#   claw-assets/bg/T2.jpg
#   claw-assets/bg/T3.jpg
#   claw-assets/color/MI.png
#   claw-assets/picture/100/*.png
#   claw-assets/picture/50/*.png
#   claw-assets/picture/SK/*.png
#   claw-assets/picture/e/*.png
#   claw-assets/picture/e/g/*.png
#   claw-assets/picture/y/*.png
#   claw-assets/picture/z/*.png

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPLOAD_DIR="$SCRIPT_DIR/upload-to-cloud"

rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"

# 复制背景图
cp -r "$SCRIPT_DIR/assets/bg" "$UPLOAD_DIR/bg"

# 复制颜色参考图
cp -r "$SCRIPT_DIR/assets/color" "$UPLOAD_DIR/color"

# 复制柜体图片
cp -r "$SCRIPT_DIR/packageDesign/picture" "$UPLOAD_DIR/picture"

# 清理 .DS_Store
find "$UPLOAD_DIR" -name ".DS_Store" -delete

echo "✅ 上传目录已准备好: $UPLOAD_DIR"
echo ""
echo "📁 目录结构:"
find "$UPLOAD_DIR" -type f | wc -l | xargs -I{} echo "   共 {} 个文件"
du -sh "$UPLOAD_DIR" | awk '{print "   总大小: "$1}'
echo ""
echo "📌 请将 $UPLOAD_DIR 下的所有内容上传到云存储"
echo "   上传路径前缀应为: claw-assets/"
echo "   即云存储中的路径为: claw-assets/bg/T1.jpg 等"
echo ""
echo "⚠️  上传完成后，请修改以下两个文件中的 CDN_BASE_URL:"
echo "   1. utils/assets.js"
echo "   2. utils/assets.wxs"
echo "   将 CDN_BASE_URL 改为你的实际云存储地址"
