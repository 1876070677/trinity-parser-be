FROM node:22-alpine AS builder
WORKDIR /app
ARG APP_NAME
COPY . .
RUN npx nest build ${APP_NAME}

FROM node:22-alpine AS runner
WORKDIR /app
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
