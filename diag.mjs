import fs from "node:fs";
const v="temperature_2m,precipitation,precipitation_probability,weather_code,cape,lifted_index,convective_inhibition,freezing_level_height,wind_speed_500hPa,temperature_500hPa,temperature_700hPa,showers";
const out={};
for(const [n,la,lo] of [["cba",-31.42,-64.19],["aut",-31.645,-64.40]]){
  const j=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=${v}&past_hours=2&forecast_hours=12&timezone=America%2FArgentina%2FCordoba`)).json();
  const H=j.hourly;out[n]=H.time.map((t,i)=>[t.slice(11),...v.split(",").map(k=>H[k][i])].join(" "));
}
out.cols="hora "+v;
fs.writeFileSync("diag.json",JSON.stringify(out,null,1));
