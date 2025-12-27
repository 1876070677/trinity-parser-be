FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

RUN npx nest build ${APP_NAME}

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
