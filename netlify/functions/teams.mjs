import process from 'node:process';
import { getSession } from '../../server/auth.mjs';
import { createTeamsHandler } from '../../server/teams.mjs';

const handle = createTeamsHandler({ readSession: getSession });
export default (request) => handle(request, process.env);
export const config = { path: ['/api/teams', '/api/teams/*'] };
