/**
 * 全局转发配置
 *
 * 为什么独立成模块：
 * - 16+ 个页面都要支持转发（onShareAppMessage / onShareTimeline），
 *   把文案、封面图、跳转路径集中在这里维护，避免散落各页面后改不动；
 * - 不同页面有不同卖点（设计页强调"我做了套陈列方案"，知识库强调具体文章），
 *   通过 type 区分；
 * - 失败兜底统一在这里处理。
 *
 * 使用方式（在每个页面 .js 里）：
 *   var share = require('相对路径/utils/share.js');
 *   Page({
 *     ...
 *     onShareAppMessage: function(res) { return share.onShare('home', this, res); },
 *     onShareTimeline:   function()    { return share.onTimeline('home', this);    }
 *   });
 */

// 默认封面图：留空 → 由微信自动截取当前页面作为封面
// （想统一封面时，把图片放到 /assets/share-cover.png 并把这里改回路径即可）
var DEFAULT_COVER = '';

// 通用兜底文案
var DEFAULT_TITLE = '柠檬塔定制系统｜专业陈列方案设计工具';

/**
 * 各页面的转发配置表
 * key 为业务约定的页面 type，value 为：
 *   - title:       转发卡片标题（必填）
 *   - path:        转发后落地页（不填则用当前页路径）
 *   - imageUrl:    转发卡片封面图（不填则用 DEFAULT_COVER）
 *
 * title 支持函数形式 function(page) { return '...'; }，
 * 用于把页面 data 拼进标题（比如知识库详情页带文章标题）。
 */
var SHARE_MAP = {
  // 首页
  home: {
    title: '简单，透明，三步完成定制设计',
    path: '/pages/home/home'
  },

  // 设计 tab（我的设计列表）
  design: {
    title: '我用「柠檬塔定制系统」做了一套陈列方案，快来看看',
    path: '/pages/design/design'
  },

  // 知识库 tab
  knowledge: {
    title: '柠檬塔门店运营知识库｜选品、陈列、成本一站搞定',
    path: '/pages/knowledge/knowledge'
  },

  // 知识库详情（按文章标题动态生成）
  knowledgeDetail: {
    title: function(page) {
      var t = page && page.data && page.data.title;
      return t ? ('【柠檬塔知识库】' + t) : '柠檬塔门店运营知识库';
    },
    path: function(page) {
      var id = page && page.data && page.data.id;
      var type = (page && page.data && page.data.type) || 'article';
      return id ? ('/pages/knowledge/detail/detail?id=' + id + '&type=' + type)
                : '/pages/knowledge/knowledge';
    }
  },

  // 我的 tab
  profile: {
    title: DEFAULT_TITLE,
    path: '/pages/home/home' // 个人页转发到首页，避免落到别人的"我的"
  },

  // 注册引导
  register: {
    title: '柠檬塔定制系统｜门店陈列方案在线设计',
    path: '/pages/home/home'
  },

  // 选品 / 预设
  preset: {
    title: '我在搭一套柠檬塔陈列，一起来设计吧',
    path: '/pages/home/home'
  },

  // 3D 布局
  layout: {
    title: '我刚搭好一套柠檬塔陈列方案，效果不错',
    path: '/pages/home/home'
  },

  // 成本透视
  cost: {
    title: '柠檬塔陈列方案｜成本一目了然',
    path: '/pages/home/home'
  },

  // 知识库子页（预算 / 需求 / 验收）
  budget: {
    title: '柠檬塔门店预算速算｜一分钟出报价',
    path: '/pages/knowledge/budget/budget'
  },
  needs: {
    title: '柠檬塔门店开店需求清单｜避免踩坑',
    path: '/pages/knowledge/needs/needs'
  },
  inspect: {
    title: '柠檬塔门店验收对照表｜开业前自查',
    path: '/pages/knowledge/inspect/inspect'
  },
  checklist: {
    title: '柠檬塔新家物品清单｜106项核对零遗漏',
    path: '/pages/knowledge/checklist/checklist'
  },
  move: {
    title: '柠檬塔搬家核对清单｜从准备到入住零遗漏',
    path: '/pages/knowledge/move/move'
  },

  // 个人中心子页：转发统一回首页（这些页面对外没传播价值）
  feedback:  { title: DEFAULT_TITLE, path: '/pages/home/home' },
  contact:   { title: DEFAULT_TITLE, path: '/pages/home/home' },
  email:     { title: DEFAULT_TITLE, path: '/pages/home/home' },
  downloads: { title: DEFAULT_TITLE, path: '/pages/home/home' }
};

/**
 * 解析配置项里可能存在的"函数形式"字段
 */
function _resolve(val, page) {
  if (typeof val === 'function') {
    try { return val(page); } catch (e) { return ''; }
  }
  return val;
}

/**
 * 给页面 onShareAppMessage 用
 * @param {string} type - SHARE_MAP 的 key
 * @param {Page}   page - 当前页面 this
 * @param {Object} res  - onShareAppMessage 原始回调参数（用于来源判断，可选）
 */
function onShare(type, page, res) {
  var cfg = SHARE_MAP[type] || {};
  var title = _resolve(cfg.title, page) || DEFAULT_TITLE;
  var path  = _resolve(cfg.path,  page) || '/pages/home/home';
  var imageUrl = _resolve(cfg.imageUrl, page) || DEFAULT_COVER;

  var ret = { title: title, path: path };
  if (imageUrl) ret.imageUrl = imageUrl; // 没配封面图时留空，由微信自动截图
  return ret;
}

/**
 * 给页面 onShareTimeline 用（朋友圈分享，需在 app.json 或页面 json 配置已开启）
 * 注意：朋友圈分享的 path 由微信固定（小程序首页），title 是 query 也不能传 path，
 * 所以这里只返回 title + query + imageUrl。
 */
function onTimeline(type, page) {
  var cfg = SHARE_MAP[type] || {};
  var title = _resolve(cfg.title, page) || DEFAULT_TITLE;
  var imageUrl = _resolve(cfg.imageUrl, page) || DEFAULT_COVER;

  // 把目标页路径作为 query 传过去，朋友圈点进来后落到首页可二次跳转（如有需要）
  var fullPath = _resolve(cfg.path, page) || '';
  var query = '';
  var qIdx = fullPath.indexOf('?');
  if (qIdx >= 0) query = fullPath.substring(qIdx + 1);

  var ret = { title: title, query: query };
  if (imageUrl) ret.imageUrl = imageUrl;
  return ret;
}

module.exports = {
  onShare: onShare,
  onTimeline: onTimeline
};
