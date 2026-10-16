const express=require('express'),http=require('http'),crypto=require('crypto');
const {Server}=require('socket.io');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.json());app.use(express.static('public'));
const SECRET=process.env.SECRET||'dev-secret';
const sb=process.env.SUPABASE_URL&&process.env.SUPABASE_KEY?require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY):null;
const mem={};
const db={
  async get(u){if(!sb)return mem[u]||null;const{data}=await sb.from('users').select('*').eq('username',u).maybeSingle();return data},
  async create(u,h){const r={username:u,pass_hash:h,coins:1000};if(!sb){mem[u]=r;return r}const{data}=await sb.from('users').insert(r).select().single();return data},
  async setCoins(u,c){if(!sb){if(mem[u])mem[u].coins=c;return}await sb.from('users').update({coins:c}).eq('username',u)}
};
const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex');
const sign=u=>u+'.'+crypto.createHmac('sha256',SECRET).update(u).digest('hex');
const verify=t=>{try{const u=t.slice(0,t.lastIndexOf('.'));return t===sign(u)?u:null}catch{return null}};
const bal=new Map();
const add=(u,n)=>{const v=(bal.get(u)||0)+Math.floor(n);bal.set(u,v);db.setCoins(u,v).catch(()=>{});io.to('u:'+u).emit('bal',v);return v};

app.post('/api/auth',async(req,res)=>{
  const{username:u,password:p,reg}=req.body||{};
  if(!/^\w{3,16}$/.test(u||'')||!p||p.length<4)return res.json({err:'Tên 3-16 ký tự chữ/số, mật khẩu ≥4'});
  let r=await db.get(u);
  if(reg){if(r)return res.json({err:'Tên đã tồn tại'});r=await db.create(u,hash(p))}
  else{if(!r)return res.json({err:'Sai tài khoản/mật khẩu'});const[s]=r.pass_hash.split(':');if(hash(p,s)!==r.pass_hash)return res.json({err:'Sai tài khoản/mật khẩu'})}
  bal.set(u,Number(r.coins));res.json({token:sign(u),username:u,coins:Number(r.coins)});
});

// ===== Kiếm xu: Toán 10-12 (CT 2018) & Tiếng Anh =====
const BANK={
 math:[["Tập nghiệm của bất phương trình x²−5x+6<0",["(2;3)","(−∞;2)∪(3;+∞)","[2;3]","(−3;−2)"],0],
  ["Đạo hàm của y=sin2x",["cos2x","2cos2x","−2cos2x","−cos2x"],1],
  ["∫2x dx =",["x²+C","2x²+C","x+C","2+C"],0],
  ["log₂8 =",["2","3","4","8"],1],
  ["CSC có u₁=2, d=3. Tìm u₁₀",["29","32","27","30"],0],
  ["Số tổ hợp chập 2 của 5 phần tử",["20","10","5","25"],1],
  ["lim (2n+1)/(n+3) khi n→+∞",["1","3","2","0"],2],
  ["Tiệm cận ngang của y=(2x+1)/(x−1)",["y=1","y=2","x=1","x=2"],1],
  ["Phương trình 2ˣ=16 có nghiệm",["3","4","8","2"],1],
  ["Cấp số nhân u₁=3, q=2. Tổng 4 số hạng đầu",["45","24","48","21"],0]],
 en:[["She ___ to school every day.",["go","goes","going","gone"],1],
  ["If I ___ rich, I would travel the world.",["am","was","were","be"],2],
  ["The book ___ by millions of people.",["has read","has been read","have read","reads"],1],
  ["Choose the synonym of 'enormous'",["tiny","huge","quiet","weak"],1],
  ["He asked me where I ___.",["live","lived","am living","lives"],1],
  ["She is good ___ playing the piano.",["in","on","at","for"],2],
  ["Choose the antonym of 'ancient'",["old","modern","historic","classic"],1],
  ["I look forward to ___ you.",["see","seeing","saw","seen"],1]]
};
const pend=new Map();
const auth=req=>verify((req.headers.authorization||'').replace('Bearer ',''));
app.get('/api/quiz',(req,res)=>{
  const u=auth(req);if(!u)return res.status(401).end();
  const b=BANK[req.query.type]||BANK.math;const[q,o,a]=b[Math.floor(Math.random()*b.length)];
  pend.set(u,{ans:o[a],reward:req.query.type==='en'?40:60});
  res.json({q,opts:[...o].sort(()=>Math.random()-.5)});
});
app.post('/api/quiz/answer',(req,res)=>{
  const u=auth(req),p=pend.get(u);if(!u||!p)return res.json({ok:false});
  pend.delete(u);const ok=req.body.a===p.ans;
  if(ok)add(u,p.reward);res.json({ok,ans:p.ans,reward:ok?p.reward:0,coins:bal.get(u)});
});

// ===== Đào vàng (chống gian lận: server kiểm tra thời gian tối thiểu) =====
const GT=[{t:'g',r:14,v:30,n:5},{t:'G',r:26,v:90,n:2},{t:'s',r:20,v:5,n:3},{t:'d',r:8,v:150,n:1}],golds=new Map();
app.post('/api/gold/start',(req,res)=>{
  const u=auth(req);if(!u)return res.status(401).end();
  if((bal.get(u)||0)<100)return res.json({err:'Cần 100 xu để chơi'});
  add(u,-100);const items=[];let id=0;
  for(const k of GT)for(let i=0;i<k.n;i++)for(let a=0;a<50;a++){
    const x=40+Math.random()*520,y=130+Math.random()*240;
    if(items.every(o=>Math.hypot(o.x-x,o.y-y)>o.r+k.r+10)){items.push({id:id++,x:Math.round(x),y:Math.round(y),r:k.r,v:k.v,t:k.t});break}}
  golds.set(u,{items,t:Date.now()});res.json({items});
});
app.post('/api/gold/end',(req,res)=>{
  const u=auth(req),g=golds.get(u);if(!u||!g)return res.json({gain:0});golds.delete(u);
  const el=(Date.now()-g.t)/1000,ids=[...new Set(req.body.ids||[])],its=ids.map(i=>g.items[i]).filter(Boolean);
  const need=its.reduce((a,o)=>a+2*Math.max(0,Math.hypot(o.x-300,o.y-40)-o.r-40)/260,0);
  if(el>75||need>el+1)return res.json({gain:0,err:'Kết quả không hợp lệ'});
  const gain=its.reduce((a,o)=>a+o.v,0);add(u,gain);res.json({gain,coins:bal.get(u)});
});

// ===== Bàn chung: Tài xỉu & Long hổ =====
const R={};
function round(key,sides,play){
  const s=R[key]={left:20,bets:Object.fromEntries(sides.map(x=>[x,{}])),hist:[],last:null,sides};
  s.pub=()=>({game:key,s:{left:s.left,last:s.last,hist:s.hist.slice(-15),tot:Object.fromEntries(sides.map(x=>[x,Object.values(s.bets[x]).reduce((a,b)=>a+b,0)]))}});
  setInterval(()=>{
    if(--s.left<=0){
      const r=play();r.id=(s.n=(s.n||0)+1);s.last=r;s.hist.push(r.label);
      for(const x of sides)for(const[u,a]of Object.entries(s.bets[x])){const m=r.pay[x]||0;if(m)add(u,a*m);
        io.to('u:'+u).emit('toast',m>=1?`${key}: thắng +${Math.floor(a*(m-1))}`:`${key}: thua −${a}`)}
      sides.forEach(x=>s.bets[x]={});s.left=20;
    }
    io.emit('round',s.pub());
  },1000);
}
round('tx',['tai','xiu'],()=>{
  const d=[0,0,0].map(()=>1+Math.floor(Math.random()*6)),t=d[0]+d[1]+d[2],tri=d[0]==d[1]&&d[1]==d[2];
  const w=tri?null:t>=11?'tai':'xiu';
  return{label:`${d.join('-')}=${t} ${tri?'BÃO':w==='tai'?'TÀI':'XỈU'}`,dice:d,pay:w?{[w]:2}:{}};
});
round('lh',['long','ho','hoa'],()=>{
  const a=1+Math.floor(Math.random()*13),b=1+Math.floor(Math.random()*13);
  const w=a>b?'long':a<b?'ho':'hoa';
  return{label:`${a} vs ${b} ${w==='long'?'RỒNG':w==='ho'?'HỔ':'HÒA'}`,cards:[{r:a,s:Math.floor(Math.random()*4)},{r:b,s:Math.floor(Math.random()*4)}],pay:w==='hoa'?{hoa:9,long:.5,ho:.5}:{[w]:2}};
});

// ===== Blackjack =====
const deck=()=>{const d=[];for(let r=1;r<=13;r++)for(let s=0;s<4;s++)d.push({r,s});return d.sort(()=>Math.random()-.5)};
const cv=h=>{let t=0,a=0;for(const c of h){if(c.r==1){t+=11;a++}else t+=Math.min(c.r,10)}while(t>21&&a>0){t-=10;a--}return t};
const games=new Map();
function bjState(g,done,msg){return{p:g.p,d:done?g.d:[g.d[0]],pv:cv(g.p),dv:done?cv(g.d):null,done,msg}}
function bjEnd(u,g,sock){
  const pv=cv(g.p);if(pv<=21)while(cv(g.d)<17)g.d.push(g.k.pop());
  const dv=cv(g.d);let m=0,msg='';
  if(pv>21)msg='Quắc! Thua';
  else if(pv==21&&g.p.length==2&&!(dv==21&&g.d.length==2)){m=2.5;msg='Blackjack! x1.5'}
  else if(dv>21||pv>dv){m=2;msg='Thắng!'}
  else if(pv==dv){m=1;msg='Hòa'}else msg='Thua';
  if(m)add(u,g.bet*m);games.delete(sock.id);sock.emit('bj',bjState(g,true,msg));
}

// ===== Bầu cua (bàn chung) =====
const BC=['bau','cua','tom','ca','ga','nai'],BCN=['Bầu','Cua','Tôm','Cá','Gà','Nai'];
round('bc',BC,()=>{const d=[0,0,0].map(()=>Math.floor(Math.random()*6)),pay={};
  d.forEach(i=>pay[BC[i]]=(pay[BC[i]]||1)+1);return{label:d.map(i=>BCN[i]).join('-'),pay}});

// ===== Co-op 2D: dính dây vượt chướng ngại (server mô phỏng 30Hz) =====
const LEVELS=[
 {name:'Đồng bằng',gy:300,cp:[{x:1240,y:300},{x:2400,y:300}],goal:3150,par:60,lim:150,g:[[0,500],[580,1000],[1100,1300],[1400,2000],[2100,2500],[2600,3250]],sp:[300,780,1150,1600,1750,2250,2800],pl:[[1450,1520,250],[2300,2380,240]]},
 {name:'Rừng gai',gy:300,cp:[{x:1040,y:300},{x:2200,y:300}],goal:2700,par:55,lim:150,g:[[0,400],[470,800],[880,1100],[1180,1500],[1580,1900],[1980,2300],[2380,2800]],sp:[250,600,950,1250,1650,1700,2050,2500,2600],pl:[[1700,1790,240],[2050,2140,240]]},
 {name:'Cầu treo vực thẳm',gy:300,cp:[{x:1225,y:230},{x:2550,y:300}],goal:2950,par:75,lim:180,g:[[0,320],[2460,3050]],sp:[2600],pl:[[380,470,270],[540,630,230],[700,790,270],[860,950,230],[1020,1110,190],[1180,1270,230],[1340,1430,270],[1500,1590,230],[1660,1750,190],[1820,1910,230],[1980,2070,270],[2140,2230,230],[2300,2390,270]]}
];
function coStart(r){
  const L=LEVELS[r.lvl||0];r.players.forEach(p=>add(p.u,-r.bet));
  r.sim={t0:Date.now(),L,cp:-1,surf:L.g.map(([a,b])=>[a,b,L.gy]).concat(L.pl),ps:r.players.map((p,i)=>({u:p.u,x:40+i*30,y:L.gy,vx:0,vy:0,on:true,d:0,in:{}}))};
  r.msg=`Màn: ${L.name}. ← → di chuyển, Space/↑ nhảy. Dây chỉ dài 150px! Chết sẽ hồi sinh ở cờ checkpoint 🚩`;
  io.to('r:'+r.code).emit('co:lv',L);r.timer=setInterval(()=>coTick(r),33)}
function coTick(r){
  const dt=1/30,S=r.sim,L=S.L,ps=S.ps,t=(Date.now()-S.t0)/1000;
  for(const p of ps){
    p.vx=((p.in.r?1:0)-(p.in.l?1:0))*180;
    if(p.in.j&&p.on){p.vy=-520}
    p.vy+=1400*dt;const py=p.y;p.x=Math.max(10,p.x+p.vx*dt);p.y+=p.vy*dt;p.on=false;
    if(p.vy>=0)for(const[a,b,y]of S.surf)if(p.x+9>a&&p.x-9<b&&py<=y+1&&p.y>=y){p.y=y;p.vy=0;p.on=true;break}
    if(p.on)L.cp.forEach((c,k)=>{if(k>S.cp&&p.x>=c.x)S.cp=k});
    if(p.y>460||L.sp.some(s=>p.x+9>s&&p.x-9<s+30&&p.y>=280&&p.y<=308)){
      const c=S.cp>=0?L.cp[S.cp]:null,k=ps.indexOf(p);
      p.free=true;p.d++;p.x=c?c.x-30+k*20:40+k*30;p.y=c?c.y:L.gy;p.vx=p.vy=0}}
  for(let i=0;i<ps.length-1;i++){const a=ps[i],b=ps[i+1],dx=b.x-a.x;
    if(a.free||b.free){if(Math.abs(dx)<=150)a.free=b.free=false;continue}
    if(Math.abs(dx)>150){const e=(Math.abs(dx)-150)/2*Math.sign(dx);a.x+=e;b.x-=e}}
  const win=ps.every(p=>p.x>=L.goal);
  if(win||t>L.lim){
    clearInterval(r.timer);r.timer=null;r.phase='end';
    const m=t<=L.par?3:t<=L.par*1.5?2.5:t<=L.par*2?2:1.5;
    if(win){ps.forEach(p=>add(p.u,r.bet*m));r.msg=`Về đích sau ${Math.round(t)}s! Thưởng x${m} • ${ps.reduce((a,p)=>a+p.d,0)} lần ngã`}
    else r.msg='Hết giờ! Cả đội mất cược';
    push(r)}
  io.to('r:'+r.code).emit('co',{t,cp:S.cp,ps:ps.map(p=>[p.u,p.x,p.y,p.d])})}

// ===== Poker (Texas Hold'em) =====
const HN=['Bài cao','Một đôi','Hai đôi','Sám cô','Sảnh','Thùng','Cù lũ','Tứ quý','Thùng phá sảnh'];
const cmp=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d}return 0};
function score5(c){
  const v=c.map(x=>x.r==1?14:x.r).sort((a,b)=>b-a),fl=c.every(x=>x.s==c[0].s),cnt={};
  v.forEach(x=>cnt[x]=(cnt[x]||0)+1);
  const g=Object.entries(cnt).map(([k,n])=>[n,+k]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]),k=g.map(x=>x[1]);
  let st=0;if(g.length==5){if(v[0]-v[4]==4)st=v[0];else if(v[0]==14&&v[1]==5)st=5}
  const cat=fl&&st?8:g[0][0]==4?7:g[0][0]==3&&g[1][0]==2?6:fl?5:st?4:g[0][0]==3?3:g[0][0]==2&&g[1]&&g[1][0]==2?2:g[0][0]==2?1:0;
  return[cat,...(st?[st]:k)]}
function best7(c){let b=null;for(let i=0;i<c.length;i++)for(let j=i+1;j<c.length;j++){const s=score5(c.filter((_,k)=>k!==i&&k!==j));if(!b||cmp(s,b)>0)b=s}return b}
const pAct=p=>!p.fold&&!p.allin;
function pPost(p,a){a=Math.max(0,Math.min(a,p.stack));p.stack-=a;p.bet+=a;p.tot+=a;if(!p.stack)p.allin=true}
function pNext(r){
  const ps=r.players,n=ps.length;
  if(ps.filter(p=>!p.fold).length==1)return pShow(r);
  const act=ps.filter(pAct),need=act.filter(p=>p.bet<r.cur||(act.length>1&&!p.acted));
  if(need.length){let i=r.turnIdx;for(let k=0;k<n;k++){i=(i+1)%n;if(need.includes(ps[i])){r.turnIdx=i;r.turn=ps[i].u;return}}}
  ps.forEach(p=>{p.bet=0;p.acted=false});r.cur=0;r.minRaise=r.bet;
  if(r.stage==3)return pShow(r);
  r.stage++;for(let i=0;i<(r.stage==1?3:1);i++)r.board.push(r.k.pop());
  r.turnIdx=r.dealer;r.turn=null;pNext(r)}
function pAction(r,k,to){
  const p=r.players[r.turnIdx];
  if(k==='fold'){p.fold=true;p.acted=true}
  else if(k==='call'){pPost(p,r.cur-p.bet);p.acted=true}
  else{to=Math.min(Math.floor(to)||0,p.bet+p.stack);
    if(to>r.cur&&to-r.cur<r.minRaise&&to<p.bet+p.stack)return 'Tố tối thiểu tới '+(r.cur+r.minRaise);
    if(to<=r.cur)pPost(p,r.cur-p.bet);
    else{if(to-r.cur>=r.minRaise)r.minRaise=to-r.cur;r.cur=to;r.players.forEach(q=>{if(q!==p)q.acted=false});pPost(p,to-p.bet)}
    p.acted=true}
  pNext(r);return null}
function pShow(r){
  r.turn=null;r.phase='end';const live=r.players.filter(p=>!p.fold);r.reveal=live.length>1;
  const sc=new Map();if(r.reveal)live.forEach(p=>sc.set(p,best7(p.h.concat(r.board))));
  const lv=[...new Set(r.players.map(p=>p.tot).filter(x=>x>0))].sort((a,b)=>a-b),pots=[];let prev=0;
  for(const L of lv){const part=r.players.filter(p=>p.tot>=L),amt=(L-prev)*part.length,el=part.filter(p=>!p.fold);prev=L;
    if(el.length)pots.push({amt,el});else if(pots.length)pots[pots.length-1].amt+=amt}
  const out=[];
  for(const po of pots){let w=po.el;
    if(r.reveal){const b=po.el.reduce((a,p)=>cmp(sc.get(p),sc.get(a))>0?p:a);w=po.el.filter(p=>cmp(sc.get(p),sc.get(b))==0)}
    const sh=Math.floor(po.amt/w.length);w.forEach((p,i)=>{p.stack+=sh+(i==0?po.amt-sh*w.length:0)});
    out.push(`${w.map(p=>p.u).join(', ')} +${po.amt}${r.reveal?' ('+HN[sc.get(w[0])[0]]+')':''}`)}
  r.players.forEach(p=>p.tot=0);r.msg='Kết thúc: '+out.join(' | ')}
function pStart(r,sock){
  const B=20*r.bet;
  if(r.players.some(p=>(p.stack||0)<r.bet&&(bal.get(p.u)||0)<B))return sock.emit('toast','Có người không đủ xu mua chip ('+B+')');
  r.players.forEach(p=>{p.stack=p.stack||0;if(p.stack<r.bet){add(p.u,-B);p.stack+=B}});
  const n=r.players.length,k=deck();r.k=k;r.board=[];r.stage=0;r.minRaise=r.bet;r.phase='play';r.reveal=false;
  r.dealer=((r.dealer==null?-1:r.dealer)+1)%n;
  r.players.forEach(p=>{p.h=[k.pop(),k.pop()];p.fold=false;p.allin=false;p.bet=0;p.tot=0;p.acted=false});
  const sb=n==2?r.dealer:(r.dealer+1)%n,bb=(sb+1)%n;
  pPost(r.players[sb],r.bet>>1);pPost(r.players[bb],r.bet);r.cur=r.bet;r.turnIdx=bb;r.msg='Ván mới';
  pNext(r);push(r)}
// ===== end poker =====

// ===== Phòng chơi nhiều người (nhập mã) =====
const rooms=new Map(),userRoom=new Map();
const code=()=>Math.random().toString(36).slice(2,6).toUpperCase();
const F13=[3,4,5,6,7,8,9,10,11,12,13,1,2],tc=id=>({id,r:F13[id>>2],s:[0,2,3,1][id%4]});
const push=r=>r.players.forEach(p=>io.to('u:'+p.u).emit('room',view(r,p.u)));
function view(r,u){
  const end=r.phase==='end';
  return{code:r.code,game:r.game,host:r.host,bet:r.bet,phase:r.phase,turn:r.turn,msg:r.msg,board:r.board,cur:r.cur,mr:r.minRaise,pot:r.players.reduce((a,p)=>a+(p.tot||0),0),dealer:r.players[r.dealer]&&r.players[r.dealer].u,
    table:r.table&&{u:r.table.u,cards:r.table.cards.map(tc)},
    players:r.players.map(p=>{const show=p.u===u||(end&&(r.game==='xd'||(r.game==='pk'&&r.reveal&&!p.fold)));
      return{u:p.u,n:p.h?p.h.length:0,st:p.st,stack:p.stack,bet:p.bet,fold:p.fold,allin:p.allin,h:show&&p.h?(r.game==='tl'?p.h.map(tc):p.h):undefined}})};
}
// Xì dách miền Tây: host làm cái
const xv=h=>{let t=0,a=0;for(const c of h){if(c.r==1){t++;a++}else t+=Math.min(c.r,10)}while(a>0&&t+10<=21){t+=10;a--}return t};
const lv=h=>{const v=xv(h);
  if(h.length==2&&h[0].r==1&&h[1].r==1)return{k:4,m:3,v};if(h.length==2&&v==21)return{k:3,m:2,v};
  if(h.length==5&&v<=21)return{k:2,m:2,v};return{k:v>21?0:1,m:1,v}};
function xNext(r){
  const p=r.order.find(p=>!p.st);if(!p)return xEnd(r);r.turn=p.u;r.msg='Lượt '+p.u;
  const l=lv(p.h);if(l.k>=3||l.v>21||p.h.length>=5){p.st=true;xNext(r)}}
function xEnd(r){
  r.phase='end';r.turn=null;const d=lv(r.players[0].h),out=[];
  for(const p of r.players.slice(1)){const a=lv(p.h);let x;
    if(a.k>d.k)x=a.k>=2?a.m:1;else if(a.k<d.k)x=-(d.k>=2?d.m:1);
    else if(a.k==1)x=a.v>d.v?1:a.v<d.v?-1:0;else x=a.k==0?-1:0;
    if(x){add(p.u,x*r.bet);add(r.host,-x*r.bet)}out.push(`${p.u}: ${x>0?'+':''}${x*r.bet}`)}
  r.msg='Kết thúc — '+out.join(' | ')}
// Tiến lên (đơn, đôi, sám, tứ quý, sảnh; chưa có chặt heo)
function tlType(ids){const s=[...ids].sort((a,b)=>a-b),rk=s.map(i=>i>>2),n=s.length;
  if(n<1||n>13)return null;
  if(n<=4&&rk.every(x=>x==rk[0]))return{t:'s',n,top:s[n-1]};
  if(n>=3&&!rk.includes(12)&&new Set(rk).size==n&&rk[n-1]-rk[0]==n-1)return{t:'run',n,top:s[n-1]};return null}
function tlNext(r){
  const ps=r.players;let i=ps.findIndex(p=>p.u===r.turn);
  for(let k=0;k<ps.length;k++){i=(i+1)%ps.length;if(!r.passed.has(ps[i].u)){r.turn=ps[i].u;break}}
  if(r.turn===r.last){r.table=null;r.passed.clear()}}
function leave(u){
  const c=userRoom.get(u),r=rooms.get(c);if(!r)return;
  userRoom.delete(u);io.to('u:'+u).emit('room',null);
  if(r.timer){clearInterval(r.timer);r.timer=null;r.players.forEach(p=>add(p.u,r.bet))}
  if(u===r.host||r.phase==='play'){
    if(r.game==='pk')r.players.forEach(q=>add(q.u,(q.stack||0)+(q.tot||0)));
    r.players.forEach(p=>{userRoom.delete(p.u);io.to('u:'+p.u).emit('room',null);io.to('u:'+p.u).emit('toast','Phòng đã đóng')});rooms.delete(c)}
  else{const lp=r.players.find(p=>p.u===u);if(r.game==='pk'&&lp)add(u,lp.stack||0);r.players=r.players.filter(p=>p.u!==u);push(r)}}

io.use((s,n)=>{const u=verify(s.handshake.auth.token||'');if(!u||!bal.has(u))return n(new Error('auth'));s.u=u;n()});
io.on('connection',sock=>{
  const u=sock.u;sock.join('u:'+u);sock.emit('bal',bal.get(u));
  sock.on('chat',({room,msg})=>{if(typeof msg!=='string'||!msg.trim())return;room=String(room).slice(0,8);const m={room,u,msg:msg.slice(0,200)};if(rooms.has(room)){if(userRoom.get(u)===room)io.to('r:'+room).emit('chat',m)}else io.emit('chat',m)});
  sock.on('bet',({game,side,amt})=>{
    const r=R[game];amt=Math.floor(amt);
    if(!r||!r.sides.includes(side)||!(amt>=10&&amt<=1e6)||r.left<=3||(bal.get(u)||0)<amt)return sock.emit('toast','Không thể cược');
    add(u,-amt);r.bets[side][u]=(r.bets[side][u]||0)+amt;sock.emit('toast',`Đã cược ${amt}`);
  });
  sock.on('bj:deal',amt=>{
    amt=Math.floor(amt);if(games.has(sock.id)||!(amt>=10)||(bal.get(u)||0)<amt)return;
    add(u,-amt);const k=deck(),g={k,bet:amt,p:[k.pop(),k.pop()],d:[k.pop(),k.pop()]};games.set(sock.id,g);
    if(cv(g.p)==21||cv(g.d)==21)bjEnd(u,g,sock);else sock.emit('bj',bjState(g,false,''));
  });
  sock.on('bj:hit',()=>{const g=games.get(sock.id);if(!g)return;g.p.push(g.k.pop());cv(g.p)>=21?bjEnd(u,g,sock):sock.emit('bj',bjState(g,false,''))});
  sock.on('bj:stand',()=>{const g=games.get(sock.id);if(g)bjEnd(u,g,sock)});
  sock.on('disconnect',()=>games.delete(sock.id));
  const my=g=>{const r=rooms.get(userRoom.get(u));return r&&r.game===g&&r.phase==='play'&&r.turn===u?r:null};
  sock.on('room:create',({game,bet,lvl})=>{
    bet=Math.floor(bet);if(userRoom.has(u)||!['xd','tl','co','pk'].includes(game)||!(bet>=10))return;
    let c;do c=code();while(rooms.has(c));
    const r={code:c,game,host:u,bet,lvl:Math.max(0,Math.min(2,lvl|0)),phase:'lobby',players:[{u}],table:null,passed:new Set(),msg:'Chờ người chơi vào bằng mã '+c};
    rooms.set(c,r);userRoom.set(u,c);sock.join('r:'+c);push(r)});
  sock.on('room:join',c=>{
    const r=rooms.get(String(c).toUpperCase());
    if(!r||userRoom.has(u)||r.phase==='play'||r.players.length>=(['xd','pk'].includes(r.game)?6:4))return sock.emit('toast','Không vào được phòng');
    r.players.push({u});userRoom.set(u,r.code);sock.join('r:'+r.code);push(r)});
  sock.on('room:leave',()=>{sock.leave('r:'+userRoom.get(u));leave(u)});
  sock.on('room:start',()=>{
    const r=rooms.get(userRoom.get(u));if(!r||r.host!==u||r.phase==='play')return;
    const n=r.players.length,xd=r.game==='xd';if(n<2)return sock.emit('toast','Cần ít nhất 2 người');
    if(r.game==='pk')return pStart(r,sock);
    const per=xd?3*r.bet:r.bet;
    if((bal.get(u)||0)<per*(xd?n-1:1)||r.players.some(p=>(bal.get(p.u)||0)<per))return sock.emit('toast','Có người không đủ xu');
    r.phase='play';r.table=null;r.passed=new Set();
    if(xd){const k=deck();r.k=k;r.players.forEach(p=>{p.h=[k.pop(),k.pop()];p.st=false});
      if(lv(r.players[0].h).k>=3)r.players.forEach(p=>p.st=true);
      r.order=r.players.slice(1).concat(r.players[0]);xNext(r)}
    else if(r.game==='co')coStart(r);
    else{const ids=[...Array(52).keys()].sort(()=>Math.random()-.5);
      r.players.forEach((p,i)=>p.h=ids.slice(i*13,i*13+13).sort((a,b)=>a-b));
      r.turn=r.players.reduce((a,p)=>p.h[0]<a.h[0]?p:a).u;r.last=null;r.msg='Ai giữ bài nhỏ nhất đánh trước'}
    push(r)});
  sock.on('x:hit',()=>{const r=my('xd');if(!r)return;const p=r.players.find(p=>p.u===u);p.h.push(r.k.pop());
    if(lv(p.h).v>21||p.h.length>=5){p.st=true;xNext(r)}push(r)});
  sock.on('x:stand',()=>{const r=my('xd');if(!r)return;const p=r.players.find(p=>p.u===u);
    if(lv(p.h).v<(u===r.host?15:16))return sock.emit('toast','Chưa đủ tuổi (người chơi ≥16, cái ≥15)');
    p.st=true;xNext(r);push(r)});
  sock.on('t:play',ids=>{
    const r=my('tl');if(!r||!Array.isArray(ids))return;const p=r.players.find(p=>p.u===u);
    ids=[...new Set(ids.map(Number))];const t=tlType(ids);
    if(!t||!ids.every(i=>p.h.includes(i)))return sock.emit('toast','Bài không hợp lệ');
    if(r.table&&!(t.t===r.table.t&&t.n===r.table.n&&t.top>r.table.top))return sock.emit('toast','Không chặt được');
    p.h=p.h.filter(i=>!ids.includes(i));r.table={u,t:t.t,n:t.n,top:t.top,cards:ids.sort((a,b)=>a-b)};r.last=u;
    if(!p.h.length){r.phase='end';r.turn=null;r.msg=u+' thắng!';
      r.players.forEach(o=>{if(o.u!==u){add(o.u,-r.bet);add(u,r.bet)}})}
    else tlNext(r);push(r)});
  sock.on('t:pass',()=>{const r=my('tl');if(!r||!r.table||r.table.u===u)return;r.passed.add(u);tlNext(r);push(r)});
  const myp=()=>{const r=rooms.get(userRoom.get(u));return r&&r.game==='pk'&&r.phase==='play'&&r.turn===u?r:null};
  sock.on('p:fold',()=>{const r=myp();if(r){pAction(r,'fold');push(r)}});
  sock.on('p:call',()=>{const r=myp();if(r){pAction(r,'call');push(r)}});
  sock.on('p:raise',to=>{const r=myp();if(!r)return;const e=pAction(r,'raise',to);e?sock.emit('toast',e):push(r)});
  sock.on('co:in',i=>{const r=rooms.get(userRoom.get(u));if(!r||!r.sim||r.game!=='co'||r.phase!=='play')return;
    const p=r.sim.ps.find(p=>p.u===u);if(p)p.in={l:!!i.l,r:!!i.r,j:!!i.j}});
  sock.on('disconnect',()=>leave(u));
});
srv.listen(process.env.PORT||3000,()=>console.log('Casino chạy trên cổng',process.env.PORT||3000));
