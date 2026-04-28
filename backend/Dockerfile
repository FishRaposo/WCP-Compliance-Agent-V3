FROM python:3.12-slim AS base

WORKDIR /app

RUN pip install --no-cache-dir poetry

COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-interaction --no-ansi --only main

COPY . .

EXPOSE 8000

CMD ["uvicorn", "wcp_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
