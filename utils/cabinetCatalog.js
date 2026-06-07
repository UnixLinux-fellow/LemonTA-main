/**
 * 柜体模型目录管理工具
 *
 * 统一管理所有柜体 3D 模型的元数据和路径，支持模型查询和路径获取。
 *
 * 使用方式:
 * var catalog = require('../../utils/cabinetCatalog.js');
 * var models = catalog.listModels();
 * var path = catalog.getModelPath('100G1');
 */

var MODELS = [
  {
    id: '100G1',
    label: '100G1 标准柜',
    path: 'utils/100G1.glb'
  }
];

/**
 * 获取所有柜体模型列表
 * @returns {Array<{id:string, label:string, path:string}>} 模型数组副本
 */
function listModels() {
  return MODELS.slice();
}

/**
 * 根据模型 ID 获取模型文件路径
 * @param {string} id - 模型 ID，如 '100G1'
 * @returns {string|null} 模型文件路径，未找到返回 null
 */
function getModelPath(id) {
  for (var i = 0; i < MODELS.length; i++) {
    if (MODELS[i].id === id) return MODELS[i].path;
  }
  return null;
}

module.exports = {
  listModels: listModels,
  getModelPath: getModelPath
};
