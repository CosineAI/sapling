# syntax=docker/dockerfile:1

FROM node:18-bullseye-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.19 --activate

COPY package.json yarn.lock ./
COPY reviewstack/package.json reviewstack/package.json
COPY reviewstack.dev/package.json reviewstack.dev/package.json
COPY shared/package.json shared/package.json
COPY textmate/package.json textmate/package.json

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn --cwd /app/reviewstack run graphql

WORKDIR /app/reviewstack.dev
RUN yarn run release

FROM nginxinc/nginx-unprivileged:1.25-alpine

COPY reviewstack.dev/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/reviewstack.dev/build /usr/share/nginx/html

EXPOSE 8080
