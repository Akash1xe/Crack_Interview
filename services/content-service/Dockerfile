FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4001
CMD ["sh","-c","npm run migrate && npm run seed && npm start"]
