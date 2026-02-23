FROM node:20-alpine
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install

COPY . .
RUN npm run build -w @karaoke/shared && npm run build -w @karaoke/frontend

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@karaoke/frontend"]
