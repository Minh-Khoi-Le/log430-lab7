FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/notification-service/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy shared modules
COPY shared/ ./shared/

# Copy service source
COPY services/notification-service/ ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["node", "index.js"]