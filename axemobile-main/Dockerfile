# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ARG VITE_SUPABASE_URL=https://ikvpkjbextmtjnszjexp.supabase.co
ARG VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImlrdnBramJleHRtdGpuc3pqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzQ2OTcsImV4cCI6MjA4ODU1MDY5N30.nde8E8EJJYwvScvk3XCFgdxXduvwJ0voQMcEYNAM86U

RUN printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$VITE_SUPABASE_URL" "$VITE_SUPABASE_PUBLISHABLE_KEY" > .env.production && \
    node -e "const fs=require('fs');const keys=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'];const files=['.env.production','.env'];const text=files.filter(fs.existsSync).map(f=>fs.readFileSync(f,'utf8')).join('\n');const missing=keys.filter(k=>!process.env[k]&&!new RegExp('^'+k+'=','m').test(text));if(missing.length){console.error('Missing build env: '+missing.join(', '));process.exit(1)}" && \
    npm run build:umbrel

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
RUN rm -f /etc/nginx/conf.d/default.conf
COPY axemobile-main/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
