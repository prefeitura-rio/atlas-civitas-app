# syntax=docker/dockerfile:1.7

FROM docker.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:8000
ARG VITE_MAPBOX_TOKEN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

RUN npm run build

FROM docker.io/library/nginx:1.27-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html
RUN touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

EXPOSE 8080
USER nginx
CMD ["nginx", "-g", "daemon off;"]
