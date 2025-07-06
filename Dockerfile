FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache build-base cairo-dev jpeg-dev pango-dev giflib-dev python3
RUN npm install
COPY . .
EXPOSE 3000
HEALTHCHECK CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "index.js"]
