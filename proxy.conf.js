/**
 * For more configuration, please refer to https://angular.io/guide/build#proxying-to-a-backend-server
 *
 * 更多配置描述请参考 https://angular.cn/guide/build#proxying-to-a-backend-server
 *
 * Note: The proxy is only valid for real requests, Mock does not actually generate requests, so the priority of Mock will be higher than the proxy
 *
 * 注：后端地址不在这里配 —— 已改为运行时配置 `src/assets/config.json` 的 `baseUrl`
 * （部署时改该文件即可切换后端，无需重新构建），因此开发态也是一次跨域直连，
 * 由服务端 `enableCors` 放行。需要走代理时再放开下面的示例即可。
 */
module.exports = {
  /**
   * The following means that all requests are directed to the backend `https://localhost:9000/`
   */
  // '/api': {
  //   target: 'https://localhost:9000/',
  //   secure: false, // Ignore invalid SSL certificates
  //   changeOrigin: true
  // }
};
