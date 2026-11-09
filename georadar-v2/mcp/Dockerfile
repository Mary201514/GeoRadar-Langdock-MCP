FROM node:22-alpine
WORKDIR /app
COPY dist ./dist
COPY mcp ./mcp
ENV HOST=0.0.0.0
ENV PORT=8787
USER node
EXPOSE 8787
CMD ["node", "mcp/server.cjs"]
