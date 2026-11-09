import api from '../backend/research-api.cjs';
const handle=api.createResearchApi();
export const GET=handle;
export const POST=handle;
export const PUT=handle;
export const DELETE=handle;
export const PATCH=handle;
export const OPTIONS=handle;
