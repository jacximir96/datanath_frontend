# Usar Node.js 18 Alpine para imagen ligera
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todo el código fuente
COPY . .

# Exponer puerto 4200
EXPOSE 4200

# Comando para ejecutar la aplicación
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--port", "4200"]
