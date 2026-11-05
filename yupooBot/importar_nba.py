import os, json, time, requests, io, sys, re
from pathlib import Path
from PIL import Image
from supabase import create_client

base = Path(__file__).resolve().parents[1]

# Load env from .env.local
env_path = base / '.env.local'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).resolve().parent))
import yupoo_to_supabase as y

albuns = json.loads((base / 'nba-albuns.json').read_text(encoding='utf-8'))
nomes = json.loads((base / 'nba-nomes.json').read_text(encoding='utf-8'))
valid = json.loads((base / 'nba-validacao.json').read_text(encoding='utf-8'))
by_album = {a['id_album']: a for a in albuns}
by_nome = {n['id_album']: n for n in nomes}

supabase_url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
supabase_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(supabase_url, supabase_key)

session = y.build_session()

# Discover album urls with fallback
print('Descobrindo URLs dos albuns no Yupoo...', flush=True)
try:
    album_urls = y.discover_albums(session, 'https://xingkong-sports.x.yupoo.com/collections/4929343', 0.2, 10)
except Exception as e:
    print(f'Aviso: falha na varredura automatica de colecoes ({e}), usando resolucao direta por ID.', flush=True)
    album_urls = []

url_by_id = {}
for u in album_urls:
    m = re.search(r'/albums/([^/?#]+)', u)
    if m:
        url_by_id[m.group(1)] = u
print(f'URLs mapeadas da colecao: {len(url_by_id)}', flush=True)

approved_ids = valid.get('registros_prontos_importacao', [])
pending_ids = valid.get('confirmar_true', [])
print(f'Total de aprovados para importar: {len(approved_ids)}', flush=True)
print(f'Total de pendentes preservados (fora da importacao): {len(pending_ids)}', flush=True)

MAX_IMAGES = 4
MAX_WIDTH = 1000
QUALITY = 82

def extract_images(album_url):
    r = session.get(album_url, headers={'Referer': 'https://xingkong-sports.x.yupoo.com/'}, timeout=(10, 35))
    r.raise_for_status()
    soup = __import__('bs4').BeautifulSoup(r.text, 'html.parser')
    imgs = y.extract_images(soup)
    return imgs[:MAX_IMAGES]

def slugify(text):
    return y.slugify(text)

report_path = base / 'nba-importacao-relatorio.json'

# Load existing report if available for resuming
imported = []
ignored = []
failed = []
total_images = 0
total_bytes = 0

if report_path.exists():
    try:
        prev = json.loads(report_path.read_text(encoding='utf-8'))
        imported = prev.get('importados', [])
        ignored = prev.get('ignorados', [])
        failed = prev.get('falhas', [])
        total_images = prev.get('total_imagens_armazenadas', 0)
        total_bytes = prev.get('peso_total_bytes', 0)
        print(f'Retomando relatorio existente: {len(imported)} importados, {len(ignored)} ignorados, {len(failed)} falhas.', flush=True)
    except Exception:
        pass

already_processed_ids = set([x['id'] for x in imported] + [x['id'] for x in ignored])

def save_report():
    rep = {
        'total_aprovados_identificados': len(approved_ids),
        'total_importado': len(imported),
        'total_ignorado_ja_existia': len(ignored),
        'total_falhas': len(failed),
        'total_pendentes_preservados': len(pending_ids),
        'total_imagens_armazenadas': total_images,
        'peso_total_bytes': total_bytes,
        'peso_total_mb': round(total_bytes / (1024 * 1024), 2),
        'tamanho_medio_bytes': int(total_bytes / total_images) if total_images else 0,
        'produtos_inativos': True,
        'importados': imported,
        'ignorados': ignored,
        'falhas': failed,
    }
    report_path.write_text(json.dumps(rep, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

for idx, aid in enumerate(approved_ids, start=1):
    n = by_nome.get(aid)
    a = by_album.get(aid, {})
    nome_prod = n.get('nome') if n else f'Album {aid}'

    if aid in already_processed_ids:
        continue

    print(f'[{idx}/{len(approved_ids)}] Processando {aid}: {nome_prod}...', flush=True)

    if not n:
        failed.append({'id': aid, 'reason': 'traducao ausente em nba-nomes.json'})
        save_report()
        continue

    # Check existence in Supabase
    try:
        res = supabase.table('products').select('id,yupoo_id').or_(f'id.eq.{aid},yupoo_id.eq.{aid}').execute()
        if res.data:
            ignored.append({'id': aid, 'nome': nome_prod, 'reason': 'ja existe no banco'})
            already_processed_ids.add(aid)
            save_report()
            print('  -> Ignorado: produto ja cadastrado.', flush=True)
            continue
    except Exception as e:
        failed.append({'id': aid, 'nome': nome_prod, 'reason': f'erro consulta banco: {e}'})
        save_report()
        continue

    # Album URL (with fallback)
    album_url = url_by_id.get(aid) or f'https://xingkong-sports.x.yupoo.com/albums/{aid}?uid=1&referrercate=4929343'

    # Extract image links
    try:
        image_urls = extract_images(album_url)
        if not image_urls:
            raise ValueError('album sem imagens no Yupoo')
    except Exception as e:
        failed.append({'id': aid, 'nome': nome_prod, 'reason': f'erro extracao imagens: {e}'})
        save_report()
        print(f'  -> Falha ao extrair imagens: {e}', flush=True)
        continue

    # Download, optimize to WebP, upload
    uploaded_urls = []
    album_bytes = 0
    upload_success = True

    for i, img_url in enumerate(image_urls):
        storage_path = f'nba/{aid}/{i}.webp'
        try:
            r = None
            for attempt in range(1, 4):
                try:
                    r = session.get(img_url, headers={'Referer': 'https://xingkong-sports.x.yupoo.com/'}, timeout=(10, 35))
                    r.raise_for_status()
                    break
                except Exception as exc:
                    if attempt < 3:
                        time.sleep(1.0 * attempt)
                    else:
                        raise exc

            img = Image.open(io.BytesIO(r.content))
            img = img.convert('RGB')
            if img.width > MAX_WIDTH:
                ratio = MAX_WIDTH / img.width
                img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format='WEBP', quality=QUALITY, method=6)
            buf.seek(0)
            data = buf.read()
            album_bytes += len(data)

            supabase.storage.from_('produtos').upload(
                storage_path,
                data,
                {'content-type': 'image/webp', 'cacheControl': '31536000', 'upsert': 'true'}
            )
            pub = supabase.storage.from_('produtos').get_public_url(storage_path)
            uploaded_urls.append(pub)
            time.sleep(0.05)
        except Exception as e:
            upload_success = False
            failed.append({'id': aid, 'nome': nome_prod, 'reason': f'erro download/upload imagem {i}: {e}'})
            print(f'  -> Erro na imagem {i}: {e}', flush=True)
            # Cleanup uploaded images on failure
            try:
                paths = [f'nba/{aid}/{k}.webp' for k in range(len(uploaded_urls))]
                if paths:
                    supabase.storage.from_('produtos').remove(paths)
            except Exception:
                pass
            break

    if not upload_success or not uploaded_urls:
        save_report()
        continue

    # Build payload
    team = n.get('time') or 'NBA'
    team_slug = slugify(team)
    payload = {
        'id': aid,
        'yupoo_id': aid,
        'slug': n.get('slug'),
        'clube': team,
        'clubeSlug': team_slug,
        'liga': 'nba',
        'publico': 'revisar',    # Mantém inativo / rascunho na vitrine pública
        'tipo': 'regata',         # Tipo regata NBA
        'temporada': '25/26',
        'uniforme': 'revisar',
        'nome': n.get('nome'),
        'preco': 230.00,          # R$ 230,00 tabela NBA
        'tamanhos': ['P', 'M', 'G', 'GG'],
        'cor': 'revisar',
        'imageSeed': n.get('slug'),
        'images': [
            {
                'src': u,
                'source': album_url,
                'alt': n.get('nome'),
                'credit': 'Yupoo',
                'focalPoint': {'x': 50, 'y': 50},
                'blurDataURL': ''
            }
            for u in uploaded_urls
        ],
        'description': '',
        'stock_by_size': {},
        'brand': '',              # Evita violacao da restricao NOT NULL
    }

    try:
        supabase.table('products').insert(payload).execute()
        imported.append({
            'id': aid,
            'nome': n.get('nome'),
            'time': team,
            'slug': n.get('slug'),
            'images': len(uploaded_urls),
            'bytes': album_bytes
        })
        total_images += len(uploaded_urls)
        total_bytes += album_bytes
        already_processed_ids.add(aid)
        failed = [f for f in failed if f.get('id') != aid]
        save_report()
        print(f'  -> Sucesso: {len(uploaded_urls)} imagens ({album_bytes // 1024} KB).', flush=True)
    except Exception as e:
        failed.append({'id': aid, 'nome': nome_prod, 'reason': f'erro insert no banco: {e}'})
        # Cleanup uploaded images on insert failure
        try:
            paths = [f'nba/{aid}/{k}.webp' for k in range(len(uploaded_urls))]
            if paths:
                supabase.storage.from_('produtos').remove(paths)
        except Exception:
            pass
        save_report()
        print(f'  -> Erro ao inserir produto: {e}', flush=True)
        continue

    time.sleep(0.2)

save_report()
print('\n========================================', flush=True)
print(f'CONCLUIDO:', flush=True)
print(f'Total importados: {len(imported)}', flush=True)
print(f'Total ignorados: {len(ignored)}', flush=True)
print(f'Total falhas: {len(failed)}', flush=True)
print(f'Total pendentes preservados: {len(pending_ids)}', flush=True)
print(f'Total imagens salvas: {total_images}', flush=True)
print(f'Peso total: {total_bytes} bytes ({round(total_bytes / (1024 * 1024), 2)} MB)', flush=True)
print('========================================', flush=True)
