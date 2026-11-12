# Web-App bauen und zusammen mit dem Backend-Server ausliefern
FROM node:20-alpine AS web
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx expo export --platform web --output-dir dist

FROM node:20-alpine
WORKDIR /app
COPY --from=web /app/dist ./dist
COPY app.json ./
COPY src ./src
COPY server ./server
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/server/data"]
CMD ["node", "server/index.mjs"]
