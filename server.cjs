'use strict';
const api=require('./georadar-v2/mcp/server.cjs');
if(require.main===module)api.start();
module.exports=api;
