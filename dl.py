import json,requests,os
A=json.load(open('../nba-albuns.json'))
m={x['id_album']:x['url_capa'] for x in A}
ids=['253376467','219635529','253376441','219635726','248774587','218049067','248774222','218049048','221705624','218048095','209084728','209084694','253375421','252960101','250040803','250040259','250037084','248771469','248771422','151101027']
os.makedirs('audit_imgs',exist_ok=True)
s=requests.Session();s.headers.update({'User-Agent':'Mozilla/5.0','Referer':'https://xingkong-sports.x.yupoo.com/'})
for i in ids:
 r=s.get(m[i],timeout=30);open('audit_imgs/'+i+'.jpg','wb').write(r.content);print(i,r.status_code,len(r.content))
