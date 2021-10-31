FROM node:latest

RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

COPY package.json /usr/src/bot
RUN yarn install

COPY . /usr/src/bot

CMD ["node", "index.ts"]