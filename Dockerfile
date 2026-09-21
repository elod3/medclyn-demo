# Demo static MedClyn - nginx, fara build step, fara dependinte de runtime.
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="medclyn-demo" \
      org.opencontainers.image.description="Demo de concept WebGL pentru rebuild-ul site-ului MedClyn"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
