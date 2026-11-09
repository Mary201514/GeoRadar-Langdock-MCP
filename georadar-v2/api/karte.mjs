import api from '../backend/maps-api.cjs';
const handlers=api.createMapsApi();
export const GET=request=>handlers.karte(request);
export const POST=request=>handlers.karte(request);
