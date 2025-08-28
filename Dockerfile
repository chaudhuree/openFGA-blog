# Use Node.js LTS
FROM node:20-alpine

# Create app dir
WORKDIR /app

# Install deps first
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "start"]
