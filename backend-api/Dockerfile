FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY backend-api/package*.json /app/backend-api/
WORKDIR /app/backend-api
RUN npm ci

COPY backend-api /app/backend-api
COPY scripts/python /app/scripts/python

RUN pip3 install --no-cache-dir --break-system-packages -r /app/scripts/python/requirements.txt

ENV PYTHON_BIN=python3

EXPOSE 3001

CMD ["npm", "start"]
