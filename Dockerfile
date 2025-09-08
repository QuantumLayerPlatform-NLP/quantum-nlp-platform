# Multi-stage Dockerfile for Quantum NLP Platform

# Stage 1: Build Go backend
FROM golang:1.21-alpine AS go-builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY backend/ ./backend/
COPY pkg/ ./pkg/

# Build the application
ARG SERVICE_NAME=nlp-gateway
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./backend/services/${SERVICE_NAME}/cmd/

# Stage 2: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY frontend/web-portal/package.json frontend/web-portal/package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY frontend/web-portal/ ./

# Build the application
RUN npm run build

# Stage 3: Final runtime image
FROM alpine:3.18

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy timezone data
COPY --from=go-builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy SSL certificates
COPY --from=go-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the binary from builder stage
COPY --from=go-builder /app/main .

# Copy configuration files
COPY config/ ./config/

# Copy frontend build (if building web service)
COPY --from=frontend-builder /app/dist ./static/

# Create non-root user
RUN adduser -D -s /bin/sh quantum
USER quantum

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the binary
CMD ["./main"]