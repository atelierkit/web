# 静态产物镜像：Angular 构建在 CI（或本地 `yarn build`）完成，镜像只负责托管
FROM nginx:alpine

ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata \
  && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  # 清掉 nginx 自带的示例页面，避免残留文件被误访问
  && rm -rf /usr/share/nginx/html/*

# 注意：默认的 /etc/nginx/conf.d/default.conf 里已有一个监听 80 的 server，
# 这里用整份 nginx.conf 覆盖，default.conf 不再被 include，因此不会冲突
COPY nginx.conf /etc/nginx/nginx.conf
COPY dist/web/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null 2>&1 || exit 1
