// Jest 配置文件 - 微信小程序单元测试环境-测测
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./__tests__/helpers/wx-mock.js'],
  testMatch: ['**/__tests__/**/*.test.js']
};
