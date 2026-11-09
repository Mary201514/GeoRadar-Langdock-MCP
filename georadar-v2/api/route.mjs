import api from '../backend/maps-api.cjs';
const handlers=api.createMapsApi();
export const POST=request=>handlers.route(request);
export const GET=request=>handlers.route(request);
