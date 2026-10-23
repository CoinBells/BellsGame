// Bells Village Rush — Cloudflare Worker + D1 backend
// Keep your bot token in Worker secrets, NEVER in GitHub Pages or client JS.
const te = new TextEncoder();
const ROUND_MS = 20000, MAX_SCORE = 125;
const json = (v,status=200,origin='') => new Response(JSON.stringify(v), {
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}
});
const hex = bytes => [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sign(key,text) {
  const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',imported,te.encode(text)));
}
function equal(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function verifyTelegram(raw, env) {
  if(typeof raw!=='string'||!raw||raw.length>10000)throw new Error('TELEGRAM_REQUIRED');
  const data=new URLSearchParams(raw), hash=data.get('hash');
  if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new Error('INVALID_SIGNATURE');
  const date=Number(data.get('auth_date')), now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(date)||date<now-86400||date>now+60)throw new Error('EXPIRED_LOGIN');
  const check=[...data.entries()].filter(([key])=>key!=='hash').map(([k,v])=>k+'='+v).sort().join('\n');
  const secret=await sign(te.encode('WebAppData'),env.TELEGRAM_BOT_TOKEN);
  if(!equal(hex(await sign(secret,check)),hash.toLowerCase()))throw new Error('INVALID_SIGNATURE');
  let user;try{user=JSON.parse(data.get('user')||'null')}catch{}
  if(!user||!Number.isSafeInteger(user.id)||user.id<=0)throw new Error('INVALID_USER');
  return {user,startParam:data.get('start_param')||''};
}
async function groupSignature(id,env) {
  return hex(await sign(te.encode(env.GROUP_LINK_SECRET),String(id))).slice(0,20);
}
async function groupContext(startParam,env) {
  if(!startParam||startParam==='global')return '';
  const m=/^g_(-?[0-9]{1,20})_([a-f0-9]{20})$/.exec(startParam);
  if(!m||!equal(await groupSignature(m[1],env),m[2]))throw new Error('INVALID_GROUP_LINK');
  return m[1];
}
async function tg(env,method,body) {
  const r=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const data=await r.json();if(!r.ok||!data.ok)throw new Error('TELEGRAM_API_ERROR');return data.result;
}
async function checkMembership(userId,group,env) {
  if(!group)return;
  const m=await tg(env,'getChatMember',{chat_id:group,user_id:Number(userId)});
  if(!['creator','administrator','member'].includes(m.status)&&!(m.status==='restricted'&&m.is_member))throw new Error('GROUP_MEMBERS_ONLY');
}
function displayName(u) {
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ').trim().slice(0,64);
  return name||'Player';
}
async function auth(body,env) {
  const ctx=await verifyTelegram(body.initData,env);
  const group=await groupContext(ctx.startParam,env);
  await checkMembership(ctx.user.id,group,env);
  return {...ctx,scope:group||'global'};
}
async function ranks(db,scope,userId) {
  const list=await db.prepare('SELECT user_id, display_name, username, best_score FROM scores WHERE scope=? ORDER BY best_score DESC, achieved_at ASC, user_id ASC LIMIT 10').bind(scope).all();
  const mine=userId?await db.prepare('SELECT best_score,achieved_at FROM scores WHERE scope=? AND user_id=?').bind(scope,String(userId)).first():null;
  const rank=mine?await db.prepare('SELECT count(*) as above FROM scores WHERE scope=? AND (best_score>? OR (best_score=? AND achieved_at<?))').bind(scope,mine.best_score,mine.best_score,mine.achieved_at).first():null;
  return {ok:true,scope:scope==='global'?'global':'group',top:(list.results||[]).map((v,i)=>({rank:i+1,name:v.display_name,username:v.username,score:v.best_score})),yourBest:mine?.best_score??null,yourRank:rank?rank.above+1:null};
}
async function api(req,env,pathname,origin) {
  if(pathname==='/api/health'&&req.method==='GET')return json({ok:true,service:'Bells Village Rush'},200,origin);
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('INVALID_JSON');
  const ctx=await auth(body,env), user=String(ctx.user.id), scope=ctx.scope;
  if(pathname==='/api/leaderboard')return json(await ranks(env.DB,scope,user),200,origin);
  if(pathname==='/api/round/start') {
    const id=crypto.randomUUID(), now=Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE rounds SET status='abandoned' WHERE user_id=? AND status='active'").bind(user),
      env.DB.prepare('INSERT INTO rounds (id,user_id,scope,started_at,status) VALUES (?,?,?,?,?)').bind(id,user,scope,now,'active')
    ]);
    return json({ok:true,roundId:id,durationMs:ROUND_MS},200,origin);
  }
  if(pathname==='/api/round/lose') {
    if(typeof body.roundId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.roundId))throw new Error('INVALID_ROUND');
    await env.DB.prepare("UPDATE rounds SET status='lost' WHERE id=? AND user_id=? AND scope=? AND status='active'").bind(body.roundId,user,scope).run();
    return json({ok:true,ranked:false},200,origin);
  }
  if(pathname==='/api/round/finish') {
    if(typeof body.roundId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.roundId))throw new Error('INVALID_ROUND');
    if(!Number.isInteger(body.score)||body.score<0||body.score>MAX_SCORE)throw new Error('INVALID_SCORE');
    const round=await env.DB.prepare('SELECT * FROM rounds WHERE id=? AND user_id=? AND scope=?').bind(body.roundId,user,scope).first();
    if(!round||round.status!=='active')throw new Error('INVALID_ROUND_STATE');
    const elapsed=Date.now()-round.started_at;
    if(elapsed<ROUND_MS-700||elapsed>ROUND_MS+10000)throw new Error('INVALID_ROUND_TIME');
    const n=await env.DB.prepare("UPDATE rounds SET status='finished',score=? WHERE id=? AND status='active'").bind(body.score,body.roundId).run();
    if(!n.meta.changes)throw new Error('ROUND_ALREADY_USED');
    const now=Date.now();
    await env.DB.prepare("INSERT INTO scores (scope,user_id,display_name,username,best_score,achieved_at) VALUES (?,?,?,?,?,?) ON CONFLICT(scope,user_id) DO UPDATE SET display_name=excluded.display_name,username=excluded.username,best_score=excluded.best_score,achieved_at=excluded.achieved_at WHERE excluded.best_score>scores.best_score")
      .bind(scope,user,displayName(ctx.user),String(ctx.user.username||'').slice(0,32),body.score,now).run();
    return json(await ranks(env.DB,scope,user),200,origin);
  }
  return json({ok:false,error:'NOT_FOUND'},404,origin);
}
function escapeHTML(t) {return String(t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function send(env,chatId,text,buttons=[]) {
  return tg(env,'sendMessage',{chat_id:chatId,text,parse_mode:'HTML',...(buttons.length?{reply_markup:{inline_keyboard:buttons}}:{})});
}
async function handleTelegram(update,env) {
  const msg=update.message;if(!msg||!msg.text||!msg.chat)return;
  const cmd=msg.text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
  if(!['/play','/start','/top','/leaderboard','/help'].includes(cmd))return;
  const id=String(msg.chat.id), isGroup=['group','supergroup'].includes(msg.chat.type);
  const scope=isGroup?id:'global';
  const param=isGroup?'g_'+id+'_'+await groupSignature(id,env):'global';
  const bot=env.BOT_USERNAME||'BellsCoinGameBot';
  const link='https://t.me/'+bot+'?startapp='+encodeURIComponent(param);
  const buttons=[[{text:'🎮 PLAY NOW · 20 SECONDS',url:link}]];
  if(cmd==='/top'||cmd==='/leaderboard'){
    const board=await ranks(env.DB,scope,'');
    const lines=board.top.length?board.top.map(v=>v.rank+'. '+escapeHTML(v.name)+' — <b>'+v.score+' 🔔</b>').join('\n'):'No scores yet — be the first!';
    return send(env,id,'🏆 <b>BELLS VILLAGE RUSH · TOP 10</b>\n'+(isGroup?'This group':'Global')+'\n\n'+lines,buttons);
  }
  if(cmd==='/help')return send(env,id,'🔔 <b>Bells Village Rush</b>\n/play — Challenge the group\n/top — Top 10 players\n\n⏱ 20 seconds, catch BELLS bags, avoid Redd.',buttons);
  return send(env,id,'🔔 <b>THE BELLS CHALLENGE IS ON!</b>\n⏱ 20 seconds · ⚡ Turbo finale · 💰 Fast bags · 🦊 Avoid Redd!\nPlay to get your name on the '+(isGroup?'group':'global')+' leaderboard.',buttons);
}
export default {
  async fetch(req,env,ctx) {
    const u=new URL(req.url),origin=req.headers.get('Origin')||'';
    if(u.pathname==='/telegram/webhook'){
      if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});
      if(!env.TELEGRAM_WEBHOOK_SECRET||!equal(req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'',env.TELEGRAM_WEBHOOK_SECRET))return new Response('Forbidden',{status:403});
      try {const update=await req.json();ctx.waitUntil(handleTelegram(update,env).catch(e=>console.error('bot',e)));return new Response('ok');}
      catch(_){return new Response('Bad request',{status:400})}
    }
    if(req.method==='OPTIONS'){
      if(origin!==env.APP_ORIGIN)return new Response('Forbidden',{status:403});
      return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'3600','Vary':'Origin'}});
    }
    if(!u.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
    if(origin && origin!==env.APP_ORIGIN)return json({ok:false,error:'ORIGIN_DENIED'},403);
    if(!env.DB||!env.TELEGRAM_BOT_TOKEN||!env.GROUP_LINK_SECRET)return json({ok:false,error:'SERVER_NOT_CONFIGURED'},503,origin);
    try{return await api(req,env,u.pathname,origin);}
    catch(e){const code=e?.message||'SERVER_ERROR';const known=/^(INVALID_[A-Z_]+|EXPIRED_LOGIN|TELEGRAM_REQUIRED|GROUP_MEMBERS_ONLY|ROUND_ALREADY_USED)$/.test(code);if(!known)console.error('API:',code);return json({ok:false,error:known?code:'SERVER_ERROR'},known?400:500,origin)}
  }
};