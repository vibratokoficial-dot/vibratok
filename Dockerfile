FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV HOST=0.0.0.0
EXPOSE 4317
CMD ["node", "server.js"]
