# ─────────────────────────────────────────────
# Makefile — golfnme
# ─────────────────────────────────────────────

.PHONY: help dev prod build stop logs shell-app shell-worker \
        migrate migrate-create seed reset db-studio health

# ─────────────────────────────────────────────
# Default target
# ─────────────────────────────────────────────
help:
	@echo ""
	@echo "  golfnme — available commands"
	@echo ""
	@echo "  Dev"
	@echo "    make dev            Start dev stack (hot reload, pgAdmin, Bull Board)"
	@echo "    make stop           Stop all containers"
	@echo "    make logs           Tail all container logs"
	@echo "    make logs-app       Tail app logs only"
	@echo "    make logs-worker    Tail worker logs only"
	@echo ""
	@echo "  Database"
	@echo "    make migrate        Apply pending migrations (prisma migrate deploy)"
	@echo "    make migrate-create name=my_change   Create new migration"
	@echo "    make seed           Run database seed"
	@echo "    make reset          Drop + recreate DB + migrate + seed (DEV ONLY)"
	@echo "    make db-studio      Open Prisma Studio"
	@echo ""
	@echo "  Production"
	@echo "    make build          Build all images"
	@echo "    make prod           Start production stack (detached)"
	@echo ""
	@echo "  Debug"
	@echo "    make shell-app      sh into running app container"
	@echo "    make shell-worker   sh into running worker container"
	@echo "    make health         Hit /api/health"
	@echo ""

# ─────────────────────────────────────────────
# Dev
# ─────────────────────────────────────────────
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-build:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

stop:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

logs-app:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f app

logs-worker:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f worker

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
migrate:
	docker compose exec app npx prisma migrate deploy

# Usage: make migrate-create name=add_user_stats
migrate-create:
	docker compose exec app npx prisma migrate dev --name $(name)

seed:
	docker compose exec app npx tsx prisma/seed.ts

# Full dev reset — nukes and recreates the DB
reset:
	@echo "⚠️  This will DROP and recreate the database. Ctrl+C to cancel..."
	@sleep 3
	docker compose exec postgres psql -U $${POSTGRES_USER:-golf} \
		-c "DROP DATABASE IF EXISTS $${POSTGRES_DB:-golfnme};" \
		-c "CREATE DATABASE $${POSTGRES_DB:-golfnme};"
	docker compose exec app npx prisma migrate deploy
	docker compose exec app npx tsx prisma/seed.ts

db-studio:
	docker compose exec app npx prisma studio

# ─────────────────────────────────────────────
# Production
# ─────────────────────────────────────────────
build:
	docker compose build

prod:
	docker compose up -d

prod-down:
	docker compose down

# ─────────────────────────────────────────────
# Debug
# ─────────────────────────────────────────────
shell-app:
	docker compose exec app sh

shell-worker:
	docker compose exec worker sh

health:
	curl -s http://localhost:3000/api/health | python3 -m json.tool
