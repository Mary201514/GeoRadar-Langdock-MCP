FROM node:22-alpine
WORKDIR /app
COPY georadar-v2 ./georadar-v2
COPY server.cjs ./server.cjs
ENV HOST=0.0.0.0
ENV PORT=8787
USER node
EXPOSE 8787
CMD ["node", "server.cjs"]
