FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Optional override at build-time. Defaults to the production Railway API domain.
ARG VITE_BACKEND_URL=https://api.inveniatechlabs.in
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ARG VITE_GOOGLE_CLIENT_ID=130212797010-1537g33b5i3qjb3jru5v9c40qhod083c.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Runtime upstream for API and uploads proxy.
ARG BACKEND_UPSTREAM=http://127.0.0.1:8000
ENV BACKEND_UPSTREAM=${BACKEND_UPSTREAM}
ENV PORT=80

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
