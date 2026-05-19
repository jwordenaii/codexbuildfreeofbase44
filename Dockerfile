FROM node:20-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY --from=frontend /app/dist ./dist

ENV WS_PIN=""
ENV SESSION_SECRET=""
ENV ANTHROPIC_API_KEY=""

EXPOSE 8010
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8010"]
