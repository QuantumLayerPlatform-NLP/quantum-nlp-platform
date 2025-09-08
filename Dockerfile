# Backend Dockerfile for Quantum NLP Platform services
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY backend/ ./backend/

# Build the application
ARG SERVICE_NAME=nlp-gateway
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags '-extldflags "-static"' -o main ./backend/services/${SERVICE_NAME}/cmd/ && \
    chmod +x main

# Final runtime image
FROM alpine:3.18

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata curl

# Copy timezone data
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy SSL certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Create non-root user
RUN adduser -D -s /bin/sh quantum && \
    mkdir -p /app && \
    chown quantum:quantum /app

WORKDIR /app

# Copy the binary from builder stage with proper ownership
COPY --from=builder --chown=quantum:quantum /app/main ./main

# Switch to non-root user
USER quantum

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the binary
CMD ["./main"]