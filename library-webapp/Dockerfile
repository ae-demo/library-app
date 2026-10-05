FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

# nginxinc/nginx-unprivileged, not stock nginx:alpine: the platform runs pods
# under an arbitrary non-root UID (GID 0), and stock nginx:alpine's
# /var/cache/nginx, /var/run and /etc/nginx are root-owned and not
# group-writable — the entrypoint's `sed -i` on default.conf, and nginx's own
# temp-dir/pid creation, both fail with Permission denied before the server
# ever binds its port. The unprivileged image pre-arranges those paths as
# group-writable under gid 0 and defaults its pid/temp paths under /tmp.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/15-aep-api-proxy.sh /docker-entrypoint.d/15-aep-api-proxy.sh
USER root
RUN chmod +x /docker-entrypoint.d/15-aep-api-proxy.sh \
    && chgrp -R 0 /etc/nginx/conf.d /usr/share/nginx/html /docker-entrypoint.d \
    && chmod -R g=u /etc/nginx/conf.d /usr/share/nginx/html /docker-entrypoint.d
USER 101
EXPOSE 9090
CMD ["nginx", "-g", "daemon off;"]
