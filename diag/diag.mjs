const x=await (await fetch("https://ssl.smn.gob.ar/CAP/AR.php")).text();
const items=x.split("<item>").slice(1);
const ac=items.find(i=>/avisocortoplazo/.test(i));const l1=ac.match(/<link>(.*?)<\/link>/)[1];
const c=await (await fetch(l1)).text();console.log("ACP FULL\n",c.replace(/\t+/g," ").slice(0,5000));
let n=0;for(const it of items){const l=it.match(/<link>(.*?)<\/link>/)[1];if(/avisocortoplazo/.test(l))continue;
 const t=await (await fetch(l)).text();if(/C[OÓ]RDOBA|Córdoba|Cordoba/i.test(t)&&/Capital|Santa Mar[ií]a/i.test(t)){console.log("\nALERTA",l,"\n",t.replace(/\t+/g," ").slice(0,3500));if(++n>=1)break}}
console.log("checked done");
