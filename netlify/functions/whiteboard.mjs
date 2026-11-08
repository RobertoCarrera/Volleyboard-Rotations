import { getSession } from '../../server/auth.mjs';
import { createWhiteboardHandler } from '../../server/whiteboard.mjs';

const handle = createWhiteboardHandler({ readSession: getSession });
export default (request) => handle(request, process.env);
export const config = { path: '/api/whiteboard' };
