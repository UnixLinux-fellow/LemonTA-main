// 云函数 login - 获取微信用户的 openid 作为登录凭证
// 这是方案A（纯 openid 登录）的后端部分：不收集手机号/邮箱，openid 即身份
// 返回的 openid 会被小程序端写入 globalData 和本地缓存，后续所有云数据库操作
// 由云开发自动按 _openid 做数据隔离（每个用户只能读写自己的记录）

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  // getWXContext 会从调用方的 wx 登录态自动解析出 openid/appid
  // 无需小程序端手动传 code，云开发已帮我们处理
  const wxContext = cloud.getWXContext();
  return {
    success: true,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    // unionid 仅在小程序已关联开放平台账号时才有，普通场景可忽略
    unionid: wxContext.UNIONID || ''
  };
};
