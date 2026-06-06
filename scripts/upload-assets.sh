#!/bin/bash
# ====================================================================
# Claw 小程序图片资源上传到腾讯云 COS 的辅助脚本
# 
# 使用前请先安装 COSCMD 工具:
#   pip install coscmd
#
# 使用方法:
#   1. 配置下方的 COS 参数
#   2. chmod +x scripts/upload-assets.sh
#   3. ./scripts/upload-assets.sh
#
# 上传完成后:
#   1. 修改 utils/assets.js 中的 USE_CDN = true 和 CDN_BASE_URL
#   2. 修改 utils/assets.wxs 中的 USE_CDN = true 和 CDN_BASE_URL
#   3. （可选）在 project.config.json 的 packOptions.ignore 中排除图片目录
# ====================================================================

# === 请修改以下配置 ===
COS_BUCKET="your-bucket-name"
COS_REGION="ap-guangzhou"
COS_UPLOAD_PATH="/claw-assets"
# ====================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_DIR/assets"

echo "========================================="
echo "Claw 小程序图片资源上传工具"
echo "========================================="
echo ""
echo "项目目录: $PROJECT_DIR"
echo "资源目录: $ASSETS_DIR"
echo "COS 存储桶: $COS_BUCKET"
echo "COS 地域: $COS_REGION"
echo "上传路径: $COS_UPLOAD_PATH"
echo ""

# 检查 coscmd 是否安装
if ! command -v coscmd &> /dev/null; then
    echo "❌ 错误: 未安装 coscmd 工具"
    echo "请先执行: pip install coscmd"
    echo "然后执行: coscmd config -a <SecretId> -s <SecretKey> -b $COS_BUCKET -r $COS_REGION"
    exit 1
fi

# 上传背景图
echo "📤 上传背景图 (bg/)..."
coscmd upload -r "$ASSETS_DIR/bg/" "$COS_UPLOAD_PATH/bg/"

# 上传柜体图片
echo "📤 上传柜体图片 (picture/)..."
coscmd upload -r "$ASSETS_DIR/picture/" "$COS_UPLOAD_PATH/picture/"

# 上传颜色参考图
echo "📤 上传颜色图 (color/)..."
coscmd upload -r "$ASSETS_DIR/color/" "$COS_UPLOAD_PATH/color/"

echo ""
echo "========================================="
echo "✅ 上传完成！"
echo ""
echo "接下来请修改以下文件："
echo ""
echo "1. utils/assets.js:"
echo "   var USE_CDN = true;"
echo "   var CDN_BASE_URL = 'https://$COS_BUCKET.cos.$COS_REGION.myqcloud.com$COS_UPLOAD_PATH';"
echo ""
echo "2. utils/assets.wxs:"
echo "   var USE_CDN = true;"
echo "   var CDN_BASE_URL = 'https://$COS_BUCKET.cos.$COS_REGION.myqcloud.com$COS_UPLOAD_PATH';"
echo ""
echo "3. (可选) project.config.json - packOptions.ignore 添加:"
echo '   { "type": "folder", "value": "assets/bg" },'
echo '   { "type": "folder", "value": "assets/picture" },'
echo '   { "type": "folder", "value": "assets/color" }'
echo "========================================="
