FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma on alpine
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
