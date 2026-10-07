// Rain Meter · avisos push al celular (ntfy) 2 h y 1 h antes del riesgo.
// Corre en GitHub Actions cada 15 min. Usa el mismo análisis que la página.
import fs from "node:fs";
const TOPIC=process.env.NTFY_TOPIC||"rainmeter-8a86f00963";
const PLACES=[
  {id:"cba",name:"Córdoba Capital",sub:"Casa",lat:-31.420,lon:-64.189},
  {id:"aut",name:"Autódromo Cabalén",sub:"Alta Gracia",lat:-31.645,lon:-64.400}
];
const VARS="temperature_2m,is_day,precipitation,precipitation_probability,weather_code,cape,lifted_index,convective_inhibition,freezing_level_height,wind_speed_10m,wind_direction_10m,wind_speed_500hPa,wind_direction_500hPa,temperature_500hPa,wind_gusts_10m";
const LVL=["Bajo","Atención","Alto"];
/* --- Análisis propio: índice de granizo (ingredientes de convección severa) --- */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(x,x0,x1,y0,y1)=>y0+(y1-y0)*clamp((x-x0)/(x1-x0),0,1);
function shear(s1,d1,s2,d2){const r=Math.PI/180;
  const u=s2*Math.sin(d2*r)-s1*Math.sin(d1*r), v=s2*Math.cos(d2*r)-s1*Math.cos(d1*r);return Math.hypot(u,v)}
function hailScore(h){
  const cape=h.cape??0, li=h.lifted_index??0, fz=h.freezing_level_height??4500, cin=h.convective_inhibition??0;
  const sh=shear(h.wind_speed_10m??0,h.wind_direction_10m??0,h.wind_speed_500hPa??0,h.wind_direction_500hPa??0);
  let s = cape<300?0 : cape<1000?lerp(cape,300,1000,0,30) : cape<2500?lerp(cape,1000,2500,30,55) : lerp(cape,2500,4000,55,65);
  if(cape>=300){
    s+=lerp(sh,35,75,0,20);
    s+= fz<3500?10 : fz<4200?5 : fz>4600?-10:0;
    s+= li<-7?15 : li<-4?10 : li<-2?4:0;
    s+= (h.temperature_500hPa??0)<-12?5:0;
    if(cin<-150) s*=0.6;
  }
  const wc=h.weather_code;
  if(wc===95) s+=10;
  const pp=(h.precipitation_probability??0)/100;
  s*= (0.35+0.65*pp);
  if(wc===96||wc===99) s=Math.max(s,75);
  return {s:Math.round(clamp(s,0,100)),sh:Math.round(sh)};
}
function rainLevel(hs,i){
  const p=hs[i].precipitation??0, acc3=(hs[i].precipitation??0)+(hs[i+1]?.precipitation??0)+(hs[i+2]?.precipitation??0);
  const pp=hs[i].precipitation_probability??0;
  if((p>=15||acc3>=30)&&pp>=40) return 2;
  if((p>=6||acc3>=15)&&pp>=30) return 1;
  return 0;
}
const hailLevel=s=>s>=55?2:s>=30?1:0;

function analyze(raw){
  const off=raw.utc_offset_seconds*1000, H=raw.hourly, n=H.time.length, now=Date.now();
  const hs=[...Array(n)].map((_,i)=>{const o={t:Date.parse(H.time[i]+":00Z")-off};for(const k in H)if(k!=="time")o[k]=H[k][i];return o});
  const start=hs.findIndex(h=>h.t+3600e3>now);
  const out=[];
  for(let i=start;i<n&&out.length<24;i++){
    const {s,sh}=hailScore(hs[i]);
    out.push({t:hs[i].t,hs:s,hl:hailLevel(s),rl:rainLevel(hs,i),sh,h:hs[i]});
  }
  return out;
}
function episodes(hours){
  const ev=[];let prev=false;
  for(const h of hours){const risk=h.hl>0||h.rl>0;
    if(risk&&!prev) ev.push(h);
    if(risk&&prev){const e=ev[ev.length-1];e.peakH=Math.max(e.peakH??e.hl,h.hl);e.peakR=Math.max(e.peakR??e.rl,h.rl)}
    prev=risk}
  ev.forEach(e=>{e.peakH??=e.hl;e.peakR??=e.rl});
  return ev;
}
const hhmm=t=>new Date(t).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"America/Argentina/Cordoba"});
function describe(e){
  const p=[];if(e.peakH) p.push("granizo "+LVL[e.peakH].toLowerCase());if(e.peakR) p.push("lluvia intensa "+(e.peakR===2?"alta":"posible"));
  return p.join(" + ");
}

const url=`https://api.open-meteo.com/v1/forecast?latitude=${PLACES.map(p=>p.lat)}&longitude=${PLACES.map(p=>p.lon)}&hourly=${VARS}&forecast_hours=36&timezone=America%2FArgentina%2FCordoba`;
const STATE="state.json";
const sent=fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE,"utf8")):{};
const now=Date.now();
let j=await (await fetch(url)).json(); if(!Array.isArray(j)) j=[j];
const WIN=[["2h",90,135,"En 2 horas"],["1h",30,75,"En 1 hora"]];
for(const [i,p] of PLACES.entries()){
  const hours=analyze(j[i]);
  for(const e of episodes(hours)){
    const m=(e.t-now)/60000;
    for(const [tag,lo,hi,txt] of WIN){
      const key=p.id+e.t+tag;
      if(m>=lo&&m<=hi&&!sent[key]){
        const red=e.peakH===2||e.peakR===2;
        const pk=Math.max(...hours.filter(h=>h.t>=e.t&&h.t<e.t+6*36e5).map(h=>h.hs));
        const rr=Math.max(...hours.filter(h=>h.t>=e.t&&h.t<e.t+6*36e5).map(h=>h.h.precipitation??0));
        const body=`${describe(e)} desde las ${hhmm(e.t)} · Granizo ${pk}% · Lluvia ${rr.toFixed(0)} mm/h`;
        await fetch(`https://ntfy.sh/${TOPIC}`,{method:"POST",body,headers:{
          Title:`${txt}: ${p.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g,""),
          Priority:red?"urgent":"high",Tags:red?"rotating_light,cloud_with_lightning":"warning,cloud_with_rain"}});
        sent[key]=now; console.log("Aviso",key,body);
      }
    }
  }
}
// Avisos de ALERTA ROJA: cuando el riesgo sube a rojo (aunque ya hubiera riesgo menor antes)
for(const [i,p] of PLACES.entries()){
  const hours=analyze(j[i]);
  const red=h=>Math.max(h.hl,h.rl)===2;
  for(let k=0;k<hours.length;k++){
    const h=hours[k];if(!red(h)||(k>0&&red(hours[k-1])))continue;
    const m=(h.t-now)/60000;
    const pk=Math.max(...hours.slice(k,k+6).map(x=>x.hs));
    const what=[h.hl===2?"granizo":"",h.rl===2?"lluvia muy fuerte":""].filter(Boolean).join(" y ");
    const slots=k===0?[["now",-60,30,"ALERTA ROJA ahora"]]:[["r2h",90,135,"ALERTA ROJA en 2 horas"],["r1h",30,75,"ALERTA ROJA en 1 hora"]];
    for(const [tag,lo,hi,txt] of slots){
      const key=p.id+(tag==="now"?Math.floor(now/(6*36e5)):h.t)+tag;
      if(m>=lo&&m<=hi&&!sent[key]){
        await fetch(`https://ntfy.sh/${TOPIC}`,{method:"POST",body:`${what} desde las ${hhmm(h.t)} · Granizo ${pk}% · Lluvia ${Math.max(...hours.slice(k,k+6).map(x=>x.h.precipitation??0)).toFixed(0)} mm/h`,headers:{
          Title:`${txt}: ${p.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g,""),Priority:"urgent",Tags:"rotating_light,cloud_with_lightning"}});
        sent[key]=now;console.log("Aviso rojo",key);
      }
    }
  }
}
// Mientras está en ROJO: avisar cada vez que el granizo sube 10 puntos o la lluvia sube 10 mm/h
const track=sent.track||{};
for(const [i,p] of PLACES.entries()){
  const hours=analyze(j[i]).slice(0,3);           // ahora y próximas 2 h
  const isRed=hours.slice(0,2).some(h=>Math.max(h.hl,h.rl)===2);
  if(!isRed){delete track[p.id];continue}
  const hp=Math.max(...hours.map(h=>h.hs));
  const rp=Math.max(...hours.map(h=>h.h.precipitation??0));
  const prev=track[p.id];
  if(!prev){track[p.id]={h:hp,r:rp};continue}      // el primer aviso rojo ya salió arriba
  const upH=hp>=prev.h+10, upR=rp>=prev.r+10;
  if(upH||upR){
    const title=`Sube el riesgo: ${p.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const body=`Granizo ${hp}%${upH?` (antes ${prev.h}%)`:""} · Lluvia ${rp.toFixed(0)} mm/h${upR?` (antes ${prev.r.toFixed(0)})`:""}`;
    await fetch(`https://ntfy.sh/${TOPIC}`,{method:"POST",body,headers:{Title:title,Priority:"urgent",Tags:"rotating_light,cloud_with_lightning"}});
    console.log("Aviso sube",p.id,body);
    track[p.id]={h:upH?hp:prev.h,r:upR?rp:prev.r};
  }
}
sent.track=track;
for(const k in sent) if(k!=="track"&&now-sent[k]>2*864e5) delete sent[k];
fs.writeFileSync(STATE,JSON.stringify(sent));
console.log("OK",new Date().toISOString());
