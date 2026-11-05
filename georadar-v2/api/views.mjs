import web from '../backend/private-views.cjs';
const handler=web.createPrivateViews().views;
export const GET=handler,POST=handler,PUT=handler,DELETE=handler,PATCH=handler,OPTIONS=handler;
