/** First public deployment only: no sign-in, sessions or financial writes. */
export default {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (request.method === 'GET' && path === '/api/health') {
      return new Response(JSON.stringify({service:'MealKhata',phase:'setup',productionReady:false,authentication:'disabled',database:'not-connected'}),{headers});
    }
    if (request.method === 'GET' && path === '/api/auth/config') {
      return new Response(JSON.stringify({googleConfigured:false,sandbox:false}),{headers});
    }
    if (request.method === 'GET' && path === '/api/auth/me') {
      return new Response(JSON.stringify({user:null}),{headers});
    }
    return new Response(JSON.stringify({error:'MealKhata setup is not complete. Sign-in and shared records are disabled.'}),{status:503,headers});
  }
};
