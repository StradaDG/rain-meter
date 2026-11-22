const x=await (await fetch("https://ssl.smn.gob.ar/CAP/AR.php")).text();
const items=x.split("<item>").slice(1);console.log("ITEMS",items.length);
for(const it of items.slice(0,40)){const g=t=>(it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))||[])[1]?.trim();console.log("-",g("title"),"|",g("link"),"|",(g("description")||"").slice(0,160))}
const cba=items.find(i=>/C[oó]rdoba/i.test(i))||items[0];const link=(cba.match(/<link>(.*?)<\/link>/)||[])[1];
console.log("\nLINK",link);if(link){const c=await (await fetch(link)).text();console.log(c.slice(0,6000))}
