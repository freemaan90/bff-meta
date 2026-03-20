# ----------- DOCKER -----------
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

restart:
	docker compose down
	docker compose up -d

# ----------- DATABASE -----------
db-reset:
	docker compose down -v
	docker compose up -d

migrate:
	npx prisma migrate dev

studio:
	npx prisma studio

# ----------- BACKEND -----------
dev:
	npm run start:dev

build:
	npm run build

start:
	npm run start

# ----------- UTILITIES -----------
psql:
	docker exec -it postgres-db psql -U postgres -d whatsapp_platform

redis-cli:
	docker exec -it redis redis-cli
