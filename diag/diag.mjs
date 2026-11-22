const t=async(n,u,o={})=>{try{const r=await fetch(u,{headers:{"User-Agent":"Mozilla/5.0 rain-meter"},...o});const x=await r.text();console.log("\n##",n,r.status,x.length,"\n",x.slice(0,900).replace(/\s+/g," "))}catch(e){console.log("\n##",n,"ERR",e.message)}};
const M="ecmwf_ifs025,gfs_seamless,icon_seamless,gem_seamless,ukmo_seamless,meteofrance_seamless,jma_seamless,cma_grapes_global,kma_seamless,ecmwf_aifs025_single,best_match";
for(const m of M.split(",")){
 try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-31.42&longitude=-64.189&hourly=precipitation,precipitation_probability,weather_code,cape,lifted_index,convective_inhibition,freezing_level_height,temperature_500hPa,temperature_700hPa,temperature_850hPa,wind_speed_500hPa,showers&forecast_hours=6&models=${m}`);const j=await r.json();
 const h=j.hourly||{};console.log("MODEL",m,r.status,j.reason||"",Object.keys(h).filter(k=>k!="time").map(k=>k+"="+JSON.stringify(h[k]?.slice(0,3))).join(" "))}catch(e){console.log("MODEL",m,"ERR",e.message)}}
await t("smn-cap","https://ssl.smn.gob.ar/CAP/AR.php");
await t("smn-alertas-web","https://www.smn.gob.ar/alertas");
await t("smn-ws1","https://ws1.smn.gob.ar/v1/warning/alert/area/1/0");
await t("smn-ws-noauth","https://ws1.smn.gob.ar/v1/forecast/location/4864");
await t("smn-dpd","https://ssl.smn.gob.ar/dpd/zipopendata.php?dato=alertas");
await t("smn-json","https://www.smn.gob.ar/sites/all/modules/smn/alertas/alertas.json");
const d=new Date(),doy=Math.floor((d-Date.UTC(d.getUTCFullYear(),0,0))/864e5),hh=String(d.getUTCHours()).padStart(2,"0");
await t("goes19-glm",`https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=GLM-L2-LCFA/${d.getUTCFullYear()}/${doy}/${hh}/`);
await t("meteored","https://www.meteored.com.ar/");
await t("windy-api","https://api.windy.com/");
