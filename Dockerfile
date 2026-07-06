FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev

COPY . .

EXPOSE 3422

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
