# Build context must be the parent benedoc/ directory:
#   docker build -f xfa-web/Dockerfile -t xfa-web .
# Or use: docker compose up  (see docker-compose.yml)

FROM oven/bun:1 AS frontend
WORKDIR /build/web
COPY xfa-web/web/package.json xfa-web/web/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY xfa-web/web/ ./
RUN bun run build

FROM golang:1.21-alpine AS backend
WORKDIR /build
COPY pdfer/ ./pdfer/
COPY xfa-web/go.mod xfa-web/go.sum* ./xfa-web/
WORKDIR /build/xfa-web
RUN go mod download
COPY xfa-web/ ./
COPY --from=frontend /build/web/dist ./web/dist
RUN go build -o xfa-web ./cmd/server

FROM alpine:3.19
WORKDIR /app
COPY --from=backend /build/xfa-web/xfa-web ./
COPY --from=frontend /build/web/dist ./web/dist
EXPOSE 8080
CMD ["./xfa-web"]
