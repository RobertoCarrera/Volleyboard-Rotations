import process from 'node:process';
import { handleAuth } from '../../server/auth.mjs';

export default async function auth(request) {
  return handleAuth(request, process.env);
}

export const config = { path: '/api/auth/*' };
