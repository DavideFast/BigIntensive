FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip docker.io \
  && rm -rf /var/lib/apt/lists/*

COPY ./package*.json /app/backend-api/
WORKDIR /app/backend-api
RUN npm ci

COPY . /app/backend-api
COPY ./scripts /app/scripts


RUN pip3 install --no-cache-dir --break-system-packages -r /app/scripts/requirements.txt

ENV PYTHON_BIN=python3

EXPOSE 3001

CMD ["npm", "start"]
