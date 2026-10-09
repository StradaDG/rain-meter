// Busca en noticias de hoy los barrios de Córdoba donde se reportó granizo y lo guarda en granizo.json
import fs from "node:fs";
const BARRIOS=["Alta Córdoba","Alberdi","Alto Alberdi","Alto Verde","Altos de Villa Cabrera","Argüello","Ampliación Las Palmas","Bajo Palermo","Barrio Jardín","Jardín Espinosa","Bella Vista","Cerro de las Rosas","Cerro Chico","Cofico","Colinas de Vélez Sarsfield","Barrio Comercial","Ducasse","Empalme","General Bustos","General Paz","Güemes","Ituzaingó","José Ignacio Díaz","Juniors","Los Boulevares","Los Naranjos","Los Paraísos","Las Palmas","Liceo","Marqués de Sobremonte","Matienzo","Nueva Córdoba","Observatorio","Barrio Palermo","Alto Palermo","Parque Capital","Parque Chacabuco","Parque Corema","Parque Liceo","Parque Vélez Sarsfield","Parque Atlántica","Patricios","Poeta Lugones","Pueyrredón","Quebrada de las Rosas","Residencial América","Residencial San Carlos","Rosedal","San Fernando","Barrio San Martín","Altos de San Martín","San Vicente","Santa Isabel","Talleres","Urca","Villa Belgrano","Villa Cabrera","Villa El Libertador","Villa Rivera Indarte","Villa Warcalde","Villa Páez","Villa Azalais","Villa Centenario","Villa Revol","Yofre","Cerveceros","Maipú","Los Plátanos","Granja de Funes","Valle Escondido","Manantiales","Ciudad Universitaria","Parque Horizonte","Mirizzi","Las Margaritas","Ameghino","Altamira","Müller","Villa Siburu","Villa Corina","Zumarán","Kennedy","Los Robles","Villa Unión","Lomas de San Martín","Las Rosas","Arguello","Microcentro","centro de la ciudad","Barrio Parque","Ampliación Pueyrredón","Barrio Inglés","Guiñazú","Villa Esquiú","Villa Retiro","Remedios de Escalada","Villa Adela","Los Granados","Parque Futura",
 "Villa Allende","Mendiolaza","Unquillo","Río Ceballos","Saldán","La Calera","Malagueño","Alta Gracia","Carlos Paz","Malvinas Argentinas","Juárez Celman","Colonia Tirolesa","Toledo","Despeñaderos","Río Segundo","Jesús María","Cosquín","Villa Parque Santa Ana","Bouwer"];
const norm=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const FEEDS=[
 ["Google Noticias","https://news.google.com/rss/search?q=granizo+c%C3%B3rdoba+when:1d&hl=es-419&gl=AR&ceid=AR:es-419"],
 ["Google Noticias","https://news.google.com/rss/search?q=%22cay%C3%B3+granizo%22+c%C3%B3rdoba+when:1d&hl=es-419&gl=AR&ceid=AR:es-419"],
 ["Google Noticias","https://news.google.com/rss/search?q=granizo%20%28site%3Alavoz.com.ar%20OR%20site%3Acadena3.com%20OR%20site%3Aeldoce.tv%20OR%20site%3Acba24n.com.ar%20OR%20site%3Aperfil.com%20OR%20site%3Almdiario.com.ar%20OR%20site%3Ahoydia.com.ar%29%20when%3A1d&hl=es-419&gl=AR&ceid=AR:es-419"],
 ["Google Noticias","https://news.google.com/rss/search?q=granizo%20%28site%3Alanuevamananacba.com%20OR%20site%3Aviapais.com.ar%20OR%20site%3Atelefenoticias.com.ar%20OR%20site%3Amitre810.com%29%20when%3A1d&hl=es-419&gl=AR&ceid=AR:es-419"],
];
// Solo medios de Córdoba Capital
const MEDIOS=["lavoz.com.ar", "cadena3.com", "eldoce.tv", "cba24n.com.ar", "perfil.com", "lmdiario.com.ar", "hoydia.com.ar", "lanuevamananacba.com", "viapais.com.ar", "telefenoticias.com.ar", "mitre810.com"];
const isCbaMedia=u=>{try{const h=new URL(u).hostname;return MEDIOS.some(d=>h===d||h.endsWith("."+d))}catch(e){return false}};
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"};
// Google Noticias usa links codificados: se decodifican para leer la nota original
async function gnewsURL(link){
  const id=link.split("/articles/")[1]?.split("?")[0];if(!id)return link;
  const h=await (await fetch(`https://news.google.com/articles/${id}`,{headers:UA})).text();
  const sg=h.match(/data-n-a-sg="([^"]+)"/)?.[1],ts=h.match(/data-n-a-ts="([^"]+)"/)?.[1];if(!sg||!ts)return null;
  const req=[[["Fbv4je",`["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`,null,"generic"]]];
  const r=await (await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute",{method:"POST",headers:{...UA,"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:"f.req="+encodeURIComponent(JSON.stringify(req))})).text();
  return r.match(/garturlres\\",\\"(https?:[^\\"]+)/)?.[1]||null;
}
async function articleParas(url){
  const h=await (await fetch(url,{headers:UA,redirect:"follow"})).text();
  return [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>m[1].replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&[a-z#0-9]+;/gi," ").replace(/\s+/g," ").trim()).filter(t=>t.length>30);
}
const tag=(x,t)=>{const m=x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`,"i"));return m?m[1].replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim():""};
const today=new Date(Date.now()-3*36e5).toISOString().slice(0,10);
const isToday=d=>{const t=Date.parse(d);return !isNaN(t)&&new Date(t-3*36e5).toISOString().slice(0,10)===today};
const found={},debug=[],reportes=[];let nItems=0;
for(const [src,url] of FEEDS){
  try{const r=await fetch(url,{headers:UA});const x=await r.text();const items=x.split(/<item[\s>]/i).slice(1);debug.push(`${src} ${r.status} ${items.length}`);
    for(const it of items){
      const title=tag(it,"title"),desc=tag(it,"description")+" "+tag(it,"content:encoded"),link=tag(it,"link"),date=tag(it,"pubDate");
      const outlet=tag(it,"source")||src;
      const srcUrl=(it.match(/<source[^>]*url="([^"]+)"/i)||[])[1]||"";
      if(!isCbaMedia(srcUrl))continue;
      if(!isToday(date))continue;
      const txt=norm(title+" "+desc);
      if(!/granizo|piedras|granizada/.test(txt))continue;
      if(!/cordoba|carlos paz|alta gracia|sierras chicas/.test(txt))continue;
      nItems++;
      // Solo notas de granizo que YA cayó (no pronósticos/alertas): se lee la nota y se buscan barrios en los párrafos que hablan del granizo
      const observed=/cayo|granizada|granizo|piedras|se registro|sorprendio/.test(norm(title))&&!/^alerta|anticipan|posible|pronostic/.test(norm(title));
      let body="";
      if(observed){try{const u=link.includes("news.google.com")?await gnewsURL(link):link;
        if(u&&/perfil\.com/.test(u)&&!/\/cordoba\//.test(u)){debug.push(`- Perfil fuera de la sección Córdoba, se ignora`);continue}
        if(u){const ps=await articleParas(u);if(!reportes.some(r=>r.link===u))reportes.push({src:outlet.replace(/ Argentina$/,""),time:new Date(Date.parse(date)).toISOString(),title:title.replace(/ - [^-]+$/,"").slice(0,140),link:u});body=ps.filter(p=>/granizo|piedra|granizada|caida|cayo/.test(norm(p))).join(" ");debug.push(`* ${outlet}: ${title.slice(0,90)} -> ${u} (${ps.length} párrafos)`)}
        else debug.push(`* ${outlet}: ${title.slice(0,90)} -> sin URL`)}catch(e){debug.push(`* ${outlet}: error nota ${e.message}`)}}
      else debug.push(`- ${outlet}: ${title.slice(0,90)} (pronóstico, se ignora)`);
      const txt2=norm(title+" "+(observed?desc+" "+body:""));
      for(const b of BARRIOS){const re=new RegExp(`(^|[^a-z])${norm(b).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z]|$)`);
        if(re.test(txt2)){const name=b==="Arguello"?"Argüello":b==="centro de la ciudad"||b==="Microcentro"?"Centro":b;
          (found[name]??=[]);if(!found[name].some(s=>s.link===link))found[name].push({src:outlet.replace(/ Argentina$/,""),time:new Date(Date.parse(date)).toISOString(),title:title.slice(0,140),link})}}
    }
  }catch(e){debug.push(`${src} ERROR ${e.message}`)}
}
const barrios=Object.entries(found).map(([name,s])=>({name,first:s.map(x=>x.time).sort()[0],sources:s.slice(0,3)})).sort((a,b)=>a.first.localeCompare(b.first));
fs.writeFileSync("granizo.json",JSON.stringify({updated:new Date().toISOString(),date:today,noticias:nItems,barrios,reportes,debug},null,1));
console.log(debug.join("\n"),"\nnoticias",nItems,"barrios",barrios.map(b=>b.name).join(", "));
