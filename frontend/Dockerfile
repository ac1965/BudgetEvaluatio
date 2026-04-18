FROM node:20-slim AS development
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY src/ ./src/
ENV REACT_APP_API_URL=http://localhost:8000
EXPOSE 3005
CMD ["npm", "start"]

FROM node:20-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY src/ ./src/
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' \
    > /etc/nginx/conf.d/default.conf
EXPOSE 80
