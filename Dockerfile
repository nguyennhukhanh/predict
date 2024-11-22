
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package*.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose the port the app runs on
EXPOSE 1505

# Command to run the app
CMD ["bun", "app.ts"]