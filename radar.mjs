// Busca la lista de imágenes del radar SMN Córdoba (RMA1) y la guarda en radar.json
import fs from "node:fs";
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36","Accept-Language":"es-AR,es;q=0.9"};
const html=await (await fetch("https://www.smn.gob.ar/radar",{headers:UA})).text();
const m=html.match(/setItem\(['"]token['"],\s*['"]([^'"]+)/);
if(!m){console.log("SIN TOKEN",html.length,html.slice(0,300));process.exit(1)}
const r=await fetch("https://ws1.smn.gob.ar/v1/images/radar/RMA1_240",{headers:{...UA,Authorization:"JWT "+m[1],Origin:"https://www.smn.gob.ar",Referer:"https://www.smn.gob.ar/"}});
const j=await r.json();
if(!j.list){console.log("SIN LISTA",r.status,JSON.stringify(j).slice(0,300));process.exit(1)}
fs.writeFileSync("radar.json",JSON.stringify({updated:new Date().toISOString(),base:"https://estaticos.smn.gob.ar/vmsr/radar/",list:j.list.slice().reverse()}));
console.log("OK",j.list.length,j.list[0]);
