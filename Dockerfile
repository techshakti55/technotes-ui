FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_BASE_URL
ARG VITE_OAUTH_ISSUER
ARG VITE_SITE_URL
ARG VITE_OAUTH_CLIENT_ID=technotes-web
ARG VITE_OAUTH_SCOPE="openid profile notes.read notes.write notes.review taxonomy.write profile.read"

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_OAUTH_ISSUER=$VITE_OAUTH_ISSUER \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_OAUTH_CLIENT_ID=$VITE_OAUTH_CLIENT_ID \
    VITE_OAUTH_SCOPE=$VITE_OAUTH_SCOPE \
    VITE_DEMO_MODE=false

RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
