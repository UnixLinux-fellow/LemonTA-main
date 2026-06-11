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
  { id: '50A',  label: '50A',  path: 'utils/cabinet-model/50A.glb',  width: 50,  type: 'A'  },
  { id: '50B',  label: '50B',  path: 'utils/cabinet-model/50B.glb',  width: 50,  type: 'B'  },
  { id: '50C',  label: '50C',  path: 'utils/cabinet-model/50C.glb',  width: 50,  type: 'C'  },
  { id: '50D',  label: '50D',  path: 'utils/cabinet-model/50D.glb',  width: 50,  type: 'D'  },
  { id: '50G1', label: '50G1', path: 'utils/cabinet-model/50G1.glb', width: 50,  type: 'G1' },
  { id: '50G2', label: '50G2', path: 'utils/cabinet-model/50G2.glb', width: 50,  type: 'G2' },
  { id: '100A', label: '100A', path: 'utils/cabinet-model/100A.glb', width: 100, type: 'A'  },
  { id: '100B', label: '100B', path: 'utils/cabinet-model/100B.glb', width: 100, type: 'B'  },
  { id: '100C', label: '100C', path: 'utils/cabinet-model/100C.glb', width: 100, type: 'C'  },
  { id: '100D', label: '100D', path: 'utils/cabinet-model/100D.glb', width: 100, type: 'D'  },
  { id: '100G1', label: '100G1', path: 'utils/cabinet-model/100G1.glb', width: 100, type: 'G1' },
  { id: '100G2', label: '100G2', path: 'utils/cabinet-model/100G2.glb', width: 100, type: 'G2' }
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

/**
 * 按宽度分组获取模型列表
 * @returns {{width: number, label: string, models: Array}} 分组后的模型数组
 */
function listByWidth() {
  var groups = [];
  var seen = {};
  for (var i = 0; i < MODELS.length; i++) {
    var w = MODELS[i].width;
    if (!seen[w]) {
      seen[w] = { width: w, label: w + 'cm', models: [] };
      groups.push(seen[w]);
    }
    seen[w].models.push(MODELS[i]);
  }
  return groups;
}

module.exports = {
  listModels: listModels,
  getModelPath: getModelPath,
  listByWidth: listByWidth
};
