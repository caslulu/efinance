# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Create uploads directory for avatars
RUN mkdir -p uploads/avatars

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
