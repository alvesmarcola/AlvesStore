import requests
for u in [
 'https://xingkong-sports.x.yupoo.com/albums/253376467',
 'https://xingkong-sports.x.yupoo.com/albums/253376467?uid=1',
 'https://xingkong-sports.x.yupoo.com/albums/253376467?uid=0',
]:
 s=requests.Session()
 s.headers.update({'User-Agent':'Mozilla/5.0','Referer':'https://xingkong-sports.x.yupoo.com/'})
 r=s.get(u,timeout=30)
 print(u, r.status_code, len(r.text))
