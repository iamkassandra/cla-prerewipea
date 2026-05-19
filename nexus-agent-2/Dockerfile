FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /data/vault

ENV NODE_ENV=production
ENV PORT=3000
ENV VAULT_PATH=/data/vault

EXPOSE 3000

CMD ["node", "server.js"]
