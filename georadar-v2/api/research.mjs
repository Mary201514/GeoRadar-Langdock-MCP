import api from '../backend/research-api.cjs';
import web from '../backend/private-views.cjs';
const handle=api.createResearchApi({views:web.createPrivateViews()});
export const GET=handle;
export const POST=handle;
export const PUT=handle;
export const DELETE=handle;
export const PATCH=handle;
export const OPTIONS=handle;
