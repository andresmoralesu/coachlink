FROM node:24-slim AS build

RUN npm install -g pnpm@10.28.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm -r build
RUN pnpm --filter @coachlink/api deploy --prod --legacy /prod/api

FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /prod/api ./

USER node
EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/no-existe.js"]