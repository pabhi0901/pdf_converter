FROM node:18-bullseye-slim

# Install LibreOffice, Chromium, and fonts for better PDF rendering
RUN apt-get update && apt-get install -y \
    libreoffice \
    chromium \
    fonts-liberation \
    fonts-noto \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Set environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=5000

# Expose port and start
EXPOSE $PORT
CMD ["npm", "start"]