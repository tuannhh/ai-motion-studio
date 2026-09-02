# AI Motion Studio — 1 container: web (build tĩnh) + API + render engine (Remotion).
# Học cách chạy Remotion headless từ auto-video-maker: node bookworm-slim +
# thư viện Chrome Headless Shell + ensureBrowser() bake sẵn trình duyệt lúc build.
FROM node:24-bookworm-slim

# Thư viện hệ thống cho Chrome Headless Shell (Remotion) + mysql client (áp
# migration lúc khởi động) + font (Liberation + Noto phủ dấu tiếng Việt cho
# ảnh/nhãn hệ thống; Be Vietnam Pro nhúng sẵn qua @remotion/google-fonts).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 \
      libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
      libpango-1.0-0 libcairo2 libcups2 \
      fonts-liberation fonts-noto-core ca-certificates default-mysql-client \
      unzip poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Ghim pnpm 9.15.0 (khớp bản sinh lockfile trên host; tránh policy minimumReleaseAge của pnpm 10)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Cài dependencies theo lockfile (tận dụng layer cache: manifest trước, source sau)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/motion-engine/package.json ./packages/motion-engine/
COPY packages/pipeline/package.json ./packages/pipeline/
RUN pnpm install --frozen-lockfile

# Bake Chrome Headless Shell cho Remotion (tránh tải lúc chạy). Đặt TRƯỚC COPY
# source để đổi code không phải tải lại trình duyệt. Chạy trong workspace engine
# vì pnpm symlink: @remotion/renderer là dep của @ams/motion-engine.
RUN cd packages/motion-engine \
    && node --input-type=module -e "import { ensureBrowser } from '@remotion/renderer'; await ensureBrowser();"

# Source
COPY . .

# Build web (Vite → apps/web/dist) để server phục vụ tĩnh cùng origin
RUN pnpm --filter @ams/web build

# Pre-warm + KIỂM CHỨNG render chạy được trong container: bundle Remotion + cache
# Google Fonts vào image (render lúc chạy không cần egress tải font).
RUN pnpm --filter @ams/motion-engine render examples/demo-ai-workflow.json --stills-only

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["pnpm", "--filter", "@ams/server", "start"]
