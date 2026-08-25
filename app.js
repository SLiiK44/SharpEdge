const SUPABASE_URL='https://uxpxewgopbwjxcmdjscu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_a-a2DODMUv1bn2fVXc_sxg_KEpN2ItT';
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const STRIPE_PUBLISHABLE_KEY='pk_test_51U8Fk22YiIw3q1418sca0pI4NbkWFlLApT247pkuVHAWCwnAfkoiL52Cihlkz71qvFZYGlYhmEtnsW8d8uhX2WOd00vkgpJxPp';
const STRIPE_PRICE_ID='price_1U8Fw4F0N4LztQxo7Z8JZWY9';

let currentUser=null;
let authMode='signin';

const leagues={
  nfl:{title:'NFL Games',url:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'},
  nba:{title:'NBA Games',url:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'},
  mlb:{title:'MLB Games',url:'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'},
  nhl:{title:'NHL Games',url:'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'},
  ncaaf:{title:'NCAAF Games',url:'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'}
};
let current='nfl';
let board=[];
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const fmtTime=d=>new Intl.DateTimeFormat([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(d));
const saved=()=>JSON.parse(localStorage.getItem('sharpedge-saved')||'[]');
function saveState(v){localStorage.setItem('sharpedge-saved',JSON.stringify(v));updateSavedCount();renderSaved();}
function updateSavedCount(){ $('#savedCount').textContent=saved().length; $('#signalsTracked').textContent=saved().length; }
function pickFor(event,comp){
  const competitors=comp.competitors||[]; const home=competitors.find(x=>x.homeAway==='home')||competitors[0]; const away=competitors.find(x=>x.homeAway==='away')||competitors[1];
  const odds=(comp.odds&&comp.odds[0])||null; let confidence=58; let label='Lean: '+(home?.team?.shortDisplayName||'Home'); let reason='Model signal uses venue, market context when available, and a conservative home-field baseline.';
  if(odds?.details){label=odds.details; const spread=Math.abs(Number(odds.spread||0)); confidence=Math.min(82,60+Math.round(spread*2)); reason='Market line is available on the live feed. Confidence is a heuristic signal, not a probability guarantee.';}
  else if(event.status?.type?.state==='in'){
    const hs=Number(home?.score||0),as=Number(away?.score||0); const leader=hs>=as?home:away; const diff=Math.abs(hs-as); label='Live lean: '+(leader?.team?.shortDisplayName||'Leader'); confidence=Math.min(88,62+diff*2); reason='Live-game lean is based on the current score state and should be treated as highly time-sensitive.';
  }
  return {label,confidence,reason,home,away};
}
function normalized(data){return (data.events||[]).slice(0,12).map(event=>{const comp=event.competitions?.[0]||{}; const p=pickFor(event,comp); return {id:event.id,league:current,name:event.name,date:event.date,status:event.status?.type?.shortDetail||'',state:event.status?.type?.state||'',home:p.home,away:p.away,pick:p.label,confidence:p.confidence,reason:p.reason};});}
async function loadLeague(){
  $('#statusPill').textContent='Loading live feed'; $('#gamesGrid').innerHTML='<div class="empty">Loading games…</div>'; $('#leagueTitle').textContent=leagues[current].title;
  try{const r=await fetch(leagues[current].url); if(!r.ok) throw new Error('Feed unavailable'); const data=await r.json(); board=normalized(data); renderBoard(); $('#statusPill').textContent=board.length?`${board.length} games loaded`:'No games on board'; $('#lastUpdated').textContent='Updated '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
  catch(e){board=[]; $('#gamesGrid').innerHTML='<div class="empty">Live feed could not be reached. Tap refresh to try again.</div>'; $('#statusPill').textContent='Feed unavailable'; $('#topConfidence').textContent='—'; $('#topPickText').textContent='No live signal loaded.'; $('#avgConfidence').textContent='—';}
}
function renderBoard(){
  const grid=$('#gamesGrid'); grid.innerHTML=''; if(!board.length){grid.innerHTML='<div class="empty">No scheduled games found for this league right now.</div>'; $('#topConfidence').textContent='—'; $('#topPickText').textContent='No games are currently listed.'; $('#avgConfidence').textContent='—'; return;}
  const sv=saved();
  board.forEach(g=>{const node=$('#gameTemplate').content.cloneNode(true); const h=g.home?.team?.displayName||'Home'; const a=g.away?.team?.displayName||'Away'; node.querySelector('.game-time').textContent=g.state==='pre'?fmtTime(g.date):g.status; node.querySelector('.live-tag').textContent=g.state==='in'?'● LIVE':g.state==='post'?'FINAL':'UPCOMING'; node.querySelector('.matchup').textContent=`${a} @ ${h}`; const as=g.away?.score,hs=g.home?.score; node.querySelector('.score-row').textContent=(as!=null&&hs!=null)?`${a}: ${as}   •   ${h}: ${hs}`:'Live scoring will appear when available'; node.querySelector('.pick-text').textContent=g.pick; node.querySelector('.confidence').textContent=g.confidence+'%'; node.querySelector('.reason').textContent=g.reason; const b=node.querySelector('.save-btn'); const isSaved=sv.some(x=>x.id===g.id&&x.pick===g.pick); if(isSaved){b.textContent='Saved ✓';b.classList.add('saved')} b.onclick=()=>toggleSave(g,b); grid.appendChild(node);});
  const top=[...board].sort((a,b)=>b.confidence-a.confidence)[0]; $('#topConfidence').textContent=top.confidence+'%'; $('#topPickText').textContent=top.pick; $('#avgConfidence').textContent=Math.round(board.reduce((s,x)=>s+x.confidence,0)/board.length)+'%';
}
function toggleSave(g,b){let s=saved(); const idx=s.findIndex(x=>x.id===g.id&&x.pick===g.pick); if(idx>=0){s.splice(idx,1);b.textContent='Save pick';b.classList.remove('saved')}else{s.unshift({...g,savedAt:new Date().toISOString()});b.textContent='Saved ✓';b.classList.add('saved')}saveState(s)}
function renderSaved(){const wrap=$('#savedList'); const s=saved(); if(!s.length){wrap.innerHTML='<div class="empty">No picks saved yet. Open the Dashboard and tap “Save pick.”</div>';return} wrap.innerHTML=s.map((x,i)=>`<article class="saved-item"><div><strong>${x.pick} • ${x.confidence}%</strong><span>${x.name||x.league.toUpperCase()} • saved ${new Date(x.savedAt).toLocaleString()}</span></div><button data-remove="${i}">Remove</button></article>`).join(''); $$('[data-remove]').forEach(b=>b.onclick=()=>{const v=saved();v.splice(Number(b.dataset.remove),1);saveState(v)});}
$$('.league').forEach(b=>b.onclick=()=>{$$('.league').forEach(x=>x.classList.remove('active'));b.classList.add('active');current=b.dataset.league;loadLeague()});
$$('.nav-btn').forEach(b=>b.onclick=()=>{$$('.nav-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(v=>v.classList.remove('active-view'));$('#'+b.dataset.view+'View').classList.add('active-view');if(b.dataset.view==='saved')renderSaved();window.scrollTo({top:0,behavior:'smooth'})});
$('#refreshBtn').onclick=loadLeague;
$('#proButton').onclick=async()=>{
  const btn=$('#proButton');
  const old=btn.textContent;
  btn.disabled=true; btn.textContent='Opening checkout…';
  try{
    const r=await fetch('/api/create-checkout-session',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({priceId:STRIPE_PRICE_ID,email:currentUser?.email||null})
    });
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||'Checkout unavailable');
    window.location.href=data.url;
  }catch(e){
    alert(e.message+'\n\nStripe server setup is not finished yet. Add STRIPE_SECRET_KEY to your Vercel project environment.');
    btn.disabled=false; btn.textContent=old;
  }
};
updateSavedCount();renderSaved();loadLeague();


async function refreshAuthState(){
  if(!supabaseClient) return;
  const {data}=await supabaseClient.auth.getSession();
  currentUser=data.session?.user||null;
  $('#authButton').textContent=currentUser?'Account':'Sign in';
  if(currentUser) await syncSavedFromCloud();
}
async function syncSavedFromCloud(){
  if(!currentUser) return;
  const {data,error}=await supabaseClient.from('saved_picks').select('pick_data').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  if(error) return;
  const cloud=(data||[]).map(x=>x.pick_data).filter(Boolean);
  if(cloud.length){localStorage.setItem('sharpedge-saved',JSON.stringify(cloud));updateSavedCount();renderSaved();}
}
async function persistCloudSaved(){
  if(!currentUser) return;
  const rows=saved().map(x=>({user_id:currentUser.id,pick_key:`${x.id}:${x.pick}`,pick_data:x}));
  await supabaseClient.from('saved_picks').delete().eq('user_id',currentUser.id);
  if(rows.length) await supabaseClient.from('saved_picks').insert(rows);
}
const originalSaveState=saveState;
saveState=function(v){originalSaveState(v);persistCloudSaved().catch(()=>{});};

$('#authButton').onclick=async()=>{
  if(currentUser){
    const choice=confirm(`Signed in as ${currentUser.email}.\n\nPress OK to sign out.`);
    if(choice){await supabaseClient.auth.signOut();currentUser=null;$('#authButton').textContent='Sign in';}
    return;
  }
  $('#authDialog').showModal();
};
$('#authModeToggle').onclick=()=>{
  authMode=authMode==='signin'?'signup':'signin';
  const signup=authMode==='signup';
  $('#authTitle').textContent=signup?'Create account':'Sign in';
  $('#authSubmit').textContent=signup?'Create account':'Sign in';
  $('#authModeToggle').textContent=signup?'Already have an account? Sign in':'Need an account? Create one';
  $('#authMessage').textContent='';
};
$('#authForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
  $('#authSubmit').disabled=true; $('#authMessage').textContent='Working…';
  const result=authMode==='signup'
    ? await supabaseClient.auth.signUp({email,password})
    : await supabaseClient.auth.signInWithPassword({email,password});
  $('#authSubmit').disabled=false;
  if(result.error){$('#authMessage').textContent=result.error.message;return;}
  currentUser=result.data.user||result.data.session?.user||null;
  $('#authButton').textContent=currentUser?'Account':'Sign in';
  $('#authMessage').textContent=authMode==='signup'&&!result.data.session?'Check your email to confirm your account.':'Signed in successfully.';
  if(result.data.session){setTimeout(()=>$('#authDialog').close(),500);await syncSavedFromCloud();}
});
supabaseClient?.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;$('#authButton').textContent=currentUser?'Account':'Sign in';});
refreshAuthState();
