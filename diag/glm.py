import urllib.request,re,datetime as dt,io,h5py,numpy as np
n=dt.datetime.utcnow();doy=n.timetuple().tm_yday
u=f"https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=GLM-L2-LCFA/{n.year}/{doy:03d}/{n.hour:02d}/"
keys=re.findall(r"<Key>(.*?)</Key>",urllib.request.urlopen(u).read().decode())[-30:]
tot=0;near=0
for k in keys:
  b=urllib.request.urlopen("https://noaa-goes19.s3.amazonaws.com/"+k).read()
  f=h5py.File(io.BytesIO(b),"r")
  def v(name):
    d=f[name];a=d[()].astype(float);sf=d.attrs.get("scale_factor");ao=d.attrs.get("add_offset")
    if sf is not None:a=a*sf[0]+ao[0]
    return a
  la=v("flash_lat");lo=v("flash_lon");tot+=len(la)
  dist=np.hypot((la+31.42)*111,(lo+64.19)*95);near+=int((dist<100).sum())
print("files",len(keys),"flashes",tot,"within100km",near, list(f.keys())[:40])
