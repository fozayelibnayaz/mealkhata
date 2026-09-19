import {it,expect} from 'vitest';
import worker from '../server/setup';
it('setup deployment discloses no connected database or real login',async()=>{
 const r=await worker.fetch(new Request('https://example.com/api/health'));
 expect(await r.json()).toMatchObject({phase:'setup',productionReady:false,database:'not-connected'});
});
it('setup never enables sandbox or Google login',async()=>{
 const r=await worker.fetch(new Request('https://example.com/api/auth/config'));
 expect(await r.json()).toEqual({googleConfigured:false,sandbox:false});
});
it('setup refuses financial mutations and sandbox sign-in',async()=>{
 for(const path of ['/api/workspaces','/api/auth/sandbox','/api/auth/google']) {
 const r=await worker.fetch(new Request('https://example.com'+path,{method:'POST'}));
 expect(r.status).toBe(503);
 }
});
