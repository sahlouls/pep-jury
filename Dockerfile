# Image de l'API (FastAPI + modele). Le model.joblib et le bundle sont montes en volume
# (pas dans l'image) -> voir docker-compose.yml. Deps installees via uv (sans le groupe dev).
FROM python:3.12-slim

# uv (gestionnaire de paquets)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# 1) deps seules (cache tant que pyproject/uv.lock ne bougent pas)
# README.md requis : pyproject declare readme = "README.md" (lu par hatchling au build).
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

# 2) code + installation du package (inclut src/cve_exploit/data/cwe_family.json)
COPY src ./src
RUN uv sync --frozen --no-dev

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "cve_exploit.api:app", "--host", "0.0.0.0", "--port", "8000"]
