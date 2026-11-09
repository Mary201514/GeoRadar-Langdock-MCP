import web from '../backend/private-views.cjs';
import k from '../backend/kunden.cjs';
import api from '../backend/kunden-api.cjs';
export const GET=api.createKundenApi({views:web.createPrivateViews(),kunden:k.createKunden()});
