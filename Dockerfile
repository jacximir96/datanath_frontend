# ===== STAGE 1: Build Angular =====
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build -- --configuration production

# ===== STAGE 2: Nginx =====
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ⚠️ AJUSTA ESTE NOMBRE SI ES NECESARIO
COPY --from=build /app/dist/datanath-frontend /usr/share/nginx/html

EXPOSE 4200

CMD ["nginx", "-g", "daemon off;"]
