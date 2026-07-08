# base image
FROM node:22.22.1-alpine AS base
LABEL maintainer="dify-node-api"

# if you located in China, you can use aliyun mirror to speed up
# RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# if you located in China, you can use taobao registry to speed up
# RUN npm config set registry https://registry.npmmirror.com

RUN apk add --no-cache tzdata
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"


# install packages (monorepo workspace context required)
FROM base AS packages

WORKDIR /app

# Copy workspace root config first for proper pnpm resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy api-node package manifest
COPY api-node/package.json api-node/

# Install only api-node dependencies (frozen lockfile)
RUN pnpm install --frozen-lockfile --filter @dify/api-node


# build
FROM base AS builder

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy installed node_modules from packages stage
COPY --from=packages /app/node_modules ./node_modules
COPY --from=packages /app/api-node/node_modules ./api-node/node_modules

# Copy api-node source
COPY api-node/ ./api-node/

# Build with tsup
RUN pnpm --filter @dify/api-node build


# production stage
FROM base AS production

ENV NODE_ENV=production
ENV EDITION=SELF_HOSTED
ENV DEPLOY_ENV=PRODUCTION
ENV PORT=5001
ENV HOST=0.0.0.0

# Environment URLs (match existing api/Dockerfile defaults)
ENV CONSOLE_API_URL=http://127.0.0.1:5001
ENV CONSOLE_WEB_URL=http://127.0.0.1:3000
ENV SERVICE_API_URL=http://127.0.0.1:5001
ENV APP_WEB_URL=http://127.0.0.1:3000

# set timezone
ENV TZ=UTC
RUN ln -s /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

# Create non-root user
ARG dify_uid=1001
RUN addgroup -S -g ${dify_uid} dify && \
    adduser -S -u ${dify_uid} -G dify -s /bin/ash -h /home/dify dify && \
    mkdir -p /app && \
    chown -R dify:dify /app

WORKDIR /app

# Copy built output and production dependencies
COPY --from=builder --chown=dify:dify /app/api-node/dist ./dist
COPY --from=packages --chown=dify:dify /app/api-node/node_modules ./node_modules
COPY --from=builder --chown=dify:dify /app/api-node/package.json ./package.json

ARG COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA}

USER dify
EXPOSE 5001

CMD ["node", "dist/index.js"]
