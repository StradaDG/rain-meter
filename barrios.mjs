// Busca en noticias de hoy los barrios de Córdoba donde se reportó granizo y lo guarda en granizo.json
import fs from "node:fs";
const BARRIOS=["Alta Córdoba","Alberdi","Alto Alberdi","Alto Verde","Altos de Villa Cabrera","Argüello","Ampliación Las Palmas","Bajo Palermo","Barrio Jardín","Jardín Espinosa","Bella Vista","Cerro de las Rosas","Cerro Chico","Cofico","Colinas de Vélez Sarsfield","Barrio Comercial","Ducasse","Empalme","General Bustos","General Paz","Güemes","Ituzaingó","José Ignacio Díaz","Juniors","Los Boulevares","Los Naranjos","Los Paraísos","Las Palmas","Liceo","Marqués de Sobremonte","Matienzo","Nueva Córdoba","Observatorio","Barrio Palermo","Alto Palermo","Parque Capital","Parque Chacabuco","Parque Corema","Parque Liceo","Parque Vélez Sarsfield","Parque Atlántica","Patricios","Poeta Lugones","Pueyrredón","Quebrada de las Rosas","Residencial América","Residencial San Carlos","Rosedal","San Fernando","Barrio San Martín","Altos de San Martín","San Vicente","Santa Isabel","Talleres","Urca","Villa Belgrano","Villa Cabrera","Villa El Libertador","Villa Rivera Indarte","Villa Warcalde","Villa Páez","Villa Azalais","Villa Centenario","Villa Revol","Yofre","Cerveceros","Maipú","Los Plátanos","Granja de Funes","Valle Escondido","Manantiales","Ciudad Universitaria","Parque Horizonte","Mirizzi","Las Margaritas","Ameghino","Altamira","Müller","Villa Siburu","Villa Corina","Zumarán","Kennedy","Los Robles","Villa Unión","Lomas de San Martín","Las Rosas","Arguello","Microcentro","centro de la ciudad","Barrio Parque","Ampliación Pueyrredón","Barrio Inglés","Guiñazú","Villa Esquiú","Villa Retiro","Remedios de Escalada","Villa Adela","Los Granados","Parque Futura",
 "Villa Allende","Mendiolaza","Unquillo","Río Ceballos","Saldán","La Calera","Malagueño","Alta Gracia","Carlos Paz","Malvinas Argentinas","Juárez Celman","Colonia Tirolesa","Toledo","Despeñaderos","Río Segundo","Jesús María","Cosquín","Villa Parque Santa Ana","Bouwer"];
const norm=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const FEEDS=[
 ["Google Noticias","https://news.google.com/rss/search?q=granizo+c%C3%B3rdoba+when:1d&hl=es-419&gl=AR&ceid=AR:es-419"],
 ["Google Noticias","https://news.google.com/rss/search?q=%22cay%C3%B3+granizo%22+c%C3%B3rdoba+when:1d&hl=es-419&gl=AR&ceid=AR:es-419"],
 ["Bing","https://www.bing.com/news/search?q=granizo+c%C3%B3rdoba&format=rss&qft=interval%3d%227%22"],
 ["Bing","https://www.bing.com/news/search?q=cay%C3%B3+granizo+c%C3%B3rdoba+barrios&format=rss"],
];
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"};
const tag=(x,t)=>{const m=x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`,"i"));return m?m[1].replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim():""};
const today=new Date(Date.now()-3*36e5).toISOString().slice(0,10);
const isToday=d=>{const t=Date.parse(d);return !isNaN(t)&&new Date(t-3*36e5).toISOString().slice(0,10)===today};
const found={},debug=[];let nItems=0;
for(const [src,url] of FEEDS){
  try{const r=await fetch(url,{headers:UA});const x=await r.text();const items=x.split(/<item[\s>]/i).slice(1);debug.push(`${src} ${r.status} ${items.length}`);
    for(const it of items){
      const title=tag(it,"title"),desc=tag(it,"description")+" "+tag(it,"content:encoded"),link=tag(it,"link"),date=tag(it,"pubDate");
      const outlet=tag(it,"source")||src;
      if(!isToday(date))continue;
      const txt=norm(title+" "+desc);
      if(!/granizo|piedras|granizada/.test(txt))continue;
      if(!/cordoba|carlos paz|alta gracia|sierras chicas/.test(txt))continue;
      nItems++;debug.push(`* ${outlet}: ${title.slice(0,120)} | ${link.slice(0,90)}`);
      for(const b of BARRIOS){const re=new RegExp(`(^|[^a-z])${norm(b).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z]|$)`);
        if(re.test(txt)){const name=b==="Arguello"?"Argüello":b==="centro de la ciudad"||b==="Microcentro"?"Centro":b;
          (found[name]??=[]);if(!found[name].some(s=>s.link===link))found[name].push({src:outlet,time:new Date(Date.parse(date)).toISOString(),title:title.slice(0,140),link})}}
    }
  }catch(e){debug.push(`${src} ERROR ${e.message}`)}
}
const barrios=Object.entries(found).map(([name,s])=>({name,first:s.map(x=>x.time).sort()[0],sources:s.slice(0,3)})).sort((a,b)=>a.first.localeCompare(b.first));
fs.writeFileSync("granizo.json",JSON.stringify({updated:new Date().toISOString(),date:today,noticias:nItems,barrios,debug},null,1));
console.log(debug.join("\n"),"\nnoticias",nItems,"barrios",barrios.map(b=>b.name).join(", "));
