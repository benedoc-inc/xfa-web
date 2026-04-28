.PHONY: setup build build-frontend build-backend dev-backend dev-frontend run docker-build docker-run docker-stop clean

setup:
	cd web && bun install
	go mod tidy

build: build-frontend build-backend

build-frontend:
	cd web && bun run build

build-backend:
	go build -o xfa-web ./cmd/server

dev-backend:
	go run ./cmd/server

dev-frontend:
	cd web && bun run dev

run: build
	./xfa-web

docker-build:
	docker build -f Dockerfile -t xfa-web ..

docker-run: docker-build
	docker run --rm -p 8080:8080 xfa-web

docker-stop:
	docker stop $$(docker ps -q --filter ancestor=xfa-web) 2>/dev/null || true

clean:
	rm -f xfa-web
	rm -rf web/dist
