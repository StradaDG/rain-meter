# Rain Meter · rayos observados por satélite (GOES-19 GLM, NOAA, datos abiertos).
# Cuenta los rayos cerca de cada lugar en los últimos 10 min y en los 10 min anteriores.
import urllib.request, re, io, json, time, datetime as dt
import h5py, numpy as np

PLACES = {"cba": (-31.420, -64.189), "aut": (-31.645, -64.400)}
B = "https://noaa-goes19.s3.amazonaws.com/"

def keys_for(t):
    doy = t.timetuple().tm_yday
    u = f"{B}?list-type=2&prefix=GLM-L2-LCFA/{t.year}/{doy:03d}/{t.hour:02d}/"
    return re.findall(r"<Key>(.*?)</Key>", urllib.request.urlopen(u, timeout=30).read().decode())

def start_of(k):  # ..._s20263260700000_...  -> epoch
    s = re.search(r"_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})", k).groups()
    d = dt.datetime(int(s[0]), 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(days=int(s[1]) - 1, hours=int(s[2]), minutes=int(s[3]), seconds=int(s[4]))
    return d.timestamp()

def var(f, name):
    d = f[name]; a = d[()].astype(float)
    sf = d.attrs.get("scale_factor"); ao = d.attrs.get("add_offset")
    if sf is not None: a = a * sf[0] + (ao[0] if ao is not None else 0)
    return a

now = dt.datetime.now(dt.timezone.utc)
keys = []
for h in (now - dt.timedelta(hours=1), now):
    try: keys += keys_for(h)
    except Exception as e: print("list err", e)
keys = sorted(set(keys), key=start_of)
if not keys: raise SystemExit("sin archivos GLM")
last = start_of(keys[-1]) + 20
keys = [k for k in keys if start_of(k) >= last - 1200]  # últimos 20 min

win = {p: {"now": [], "prev": []} for p in PLACES}
for k in keys:
    try:
        f = h5py.File(io.BytesIO(urllib.request.urlopen(B + k, timeout=30).read()), "r")
        la = var(f, "flash_lat"); lo = var(f, "flash_lon")
    except Exception as e:
        print("err", k, e); continue
    w = "now" if start_of(k) >= last - 600 else "prev"
    for p, (plat, plon) in PLACES.items():
        dist = np.hypot((la - plat) * 111.0, (lo - plon) * 111.0 * np.cos(np.radians(plat)))
        win[p][w] += [d for d in dist.tolist() if d < 150]

out = {"updated": int(time.time() * 1000), "data_until": int(last * 1000), "places": {}}
for p, w in win.items():
    def stats(ds):
        a = np.array(ds)
        return {"r10": int((a < 10).sum()), "r20": int((a < 20).sum()), "r50": int((a < 50).sum()),
                "r100": int((a < 100).sum()), "near": round(float(a.min()), 1) if len(a) else None}
    out["places"][p] = {"now": stats(w["now"]), "prev": stats(w["prev"])}
json.dump(out, open("glm.json", "w"))
print(json.dumps(out))
