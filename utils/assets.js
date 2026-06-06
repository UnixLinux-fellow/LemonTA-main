/**
 * 图片资源路径管理工具
 * 
 * 统一管理所有图片资源路径，支持本地路径和 CDN 网络路径切换。
 * 
 * 使用方式:
 * var assets = require('../../utils/assets.js');
 * var bgPath = assets.bg('T1');
 * var picturePath = assets.picture('100/a-100-230');
 * 
 * 切换为网络路径:
 * 将 USE_CDN 设为 true，并配置 CDN_BASE_URL 为你的图片托管地址。
 */

// ====== 配置区 ======
// 是否使用 CDN 网络路径加载图片（设为 true 可大幅减小主包体积）
var USE_CDN = true;

// CDN 基础 URL（末尾不要加 /）
// 微信云开发云存储 cloud:// 协议
var CDN_BASE_URL = 'cloud://cloud1-5gbuna7d27dafeba.636c-cloud1-5gbuna7d27dafeba-1417087823/claw-assets';

// ====== 内部方法 ======

/**
 * 获取资源完整路径
 * @param {string} relativePath - 相对于 assets/ 的路径，如 'bg/T1.png'
 * @returns {string} 完整路径
 */
function getAssetPath(relativePath) {
  if (USE_CDN && CDN_BASE_URL) {
    return CDN_BASE_URL + '/' + relativePath;
  }
  return '/assets/' + relativePath;
}

// ====== 导出 API ======

module.exports = {
  /**
   * 是否正在使用 CDN
   */
  isUsingCDN: function() {
    return USE_CDN && !!CDN_BASE_URL;
  },

  /**
   * 获取背景图路径
   * @param {string} name - 背景图名称，如 'T1'、'T2'、'T3'
   * @returns {string}
   */
  bg: function(name) {
    return getAssetPath('bg/' + name + '.jpg');
  },

  /**
   * 获取柜体图片路径
   * @param {string} subPath - picture/ 下的子路径，如 '100/a-100-230'、'e/a-75-230'、'SK/SK-2-230'
   * @returns {string}
   */
  picture: function(subPath) {
    if (USE_CDN && CDN_BASE_URL) {
      return CDN_BASE_URL + '/picture/' + subPath + '.png';
    }
    return '/packageDesign/picture/' + subPath + '.png';
  },

  /**
   * 获取图标路径
   * 注意：tabBar 图标必须是本地路径，此方法始终返回本地路径
   * @param {string} name - 图标名，如 'home'、'home-active'
   * @returns {string}
   */
  icon: function(name) {
    // tabBar 图标必须是本地的，不走 CDN
    return '/assets/icons/' + name + '.png';
  },

  /**
   * 获取颜色参考图路径
   * @param {string} name - 颜色名，如 'MI'
   * @returns {string}
   */
  color: function(name) {
    if (USE_CDN && CDN_BASE_URL) {
      return CDN_BASE_URL + '/color/' + name + '.png';
    }
    return '/assets/color/' + name + '.png';
  },

  /**
   * 获取柜体 3D 模型路径 (GLB)
   * @param {string} name - 模型名，如 'a-50-230'、'z-110-230'
   * @returns {string}
   */
  model: function(name) {
    if (USE_CDN && CDN_BASE_URL) {
      return CDN_BASE_URL + '/models/' + name + '.glb';
    }
    return '/assets/models/' + name + '.glb';
  },

  /**
   * 获取常用柜体 3D 模型预览列表
   * @returns {Array<{label: string, name: string, url: string}>}
   */
  modelCatalog: function() {
    var self = this;
    var list = [
      { label: 'A型 50cm', name: 'a-50-230' },
      { label: 'A型 100cm', name: 'a-100-230' },
      { label: 'B型 50cm', name: 'b-50-230' },
      { label: 'B型 100cm', name: 'b-100-230' },
      { label: 'C型 50cm', name: 'c-50-230' },
      { label: 'C型 100cm', name: 'c-100-230' },
      { label: 'D型 50cm', name: 'd-50-230' },
      { label: 'D型 100cm', name: 'd-100-230' },
      { label: '左转角 110cm', name: 'z-110-230' },
      { label: '右转角 110cm', name: 'y-110-230' }
    ];
    for (var i = 0; i < list.length; i++) {
      list[i].url = self.model(list[i].name);
    }
    return list;
  },

  /**
   * 获取任意资源路径（通用方法）
   * @param {string} relativePath - 相对于 assets/ 的完整路径
   * @returns {string}
   */
  get: function(relativePath) {
    return getAssetPath(relativePath);
  }
};
