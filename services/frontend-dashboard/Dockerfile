FROM node:20-alpine

WORKDIR /app/frontend-dashboard

COPY frontend-dashboard/package*.json ./
RUN npm ci

COPY frontend-dashboard ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
