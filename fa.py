import requests
from bs4 import BeautifulSoup
url='https://xingkong-sports.x.yupoo.com/albums/253376467'
s=requests.Session()
s.headers.update({'User-Agent':'Mozilla/5.0','Referer':'https://xingkong-sports.x.yupoo.com/'})
r=s.get(url,timeout=30)
print('status',r.status_code)
sp=BeautifulSoup(r.text,'html.parser')
imgs=[]
for img in sp.find_all('img'):
    for attr in ('data-origin-src','data-src','src','data-original'):
        v=img.get(attr)
        if v:
            imgs.append(v); break
print('count',len(imgs))
for u in imgs[:8]: print(u)
