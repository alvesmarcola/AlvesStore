import sys
sys.path.insert(0,'yupooBot')
import yupoo_to_supabase as y
s=y.build_session()
albs=y.discover_albums(s,'https://xingkong-sports.x.yupoo.com/collections/4929343',0.5,20)
print('FOUND',len(albs))
print('SAMPLE',albs[0])
