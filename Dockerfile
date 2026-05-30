FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY index.html app.js styles.css README.md ./
ENV HOST=0.0.0.0
EXPOSE 5173
CMD ["npm", "start"]
