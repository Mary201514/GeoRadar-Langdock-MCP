import server from '../mcp/server.cjs';
import transport from '../mcp/transport.cjs';

const handleRequest=transport.createTransport({dispatch:server.handle});
export const POST=handleRequest;
export const GET=handleRequest;
export const DELETE=handleRequest;
export const OPTIONS=handleRequest;
export const PUT=handleRequest;
export const PATCH=handleRequest;
export const HEAD=handleRequest;
