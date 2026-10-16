"""Importa os álbuns de uma categoria Yupoo para public.products no Supabase.

Uso (PowerShell):
  $env:SUPABASE_URL = "https://<projeto>.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
  python yupoo_to_supabase.py "https://minkang.x.yupoo.com/categories/680738"

Os atributos comerciais que não podem ser deduzidos com segurança das páginas
Yupoo ficam marcados como "revisar" (e preço 0). Ajuste-os no catálogo depois.
"""

from __future__ import annotations

import argparse
import os
import random
import re
import socket
import sys
import time
import unicodedata
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
ALBUM_PATH = re.compile(r"/albums/([^/?#]+)", re.IGNORECASE)
IMAGE_HOSTS = ("photo.yupoo.com", "images.yupoo.com")
MAX_PAGES_DEFAULT = 100
NETWORK_BACKOFF_BASE_SECONDS = 5.0
NETWORK_BACKOFF_MAX_SECONDS = 90.0


def build_session() -> requests.Session:
    """Sessão com cabeçalhos de navegador e retries para falhas transitórias."""
    session = requests.Session()
    retry = Retry(
        total=4,
        connect=4,
        read=3,
        status=3,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(("GET",)),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.7,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    return session


def canonical_album_url(href: str, category_url: str) -> str | None:
    """Resolve o href original sem reescrever caminho ou query do Yupoo.

    O parâmetro `uid` faz parte do link de muitos álbuns. Removê-lo pode levar
    a uma rota que responde 404 mesmo quando o link da grelha é válido.
    """
    raw_href = href.strip()
    if not raw_href:
        return None
    absolute = urljoin(category_url, raw_href)
    parsed = urlsplit(absolute)
    # Validamos a rota para não recolher links genéricos da categoria, mas
    # mantemos path, query e subdomínio exatamente como vieram no href.
    if not ALBUM_PATH.search(parsed.path) or not parsed.hostname:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    # Fragmentos não são enviados ao servidor; os parâmetros de query são.
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ""))


def category_page_url(category_url: str, page: int) -> str:
    """Define o parâmetro de página preservando os demais parâmetros da URL."""
    parsed = urlsplit(category_url)
    query = [(key, value) for key, value in parse_qsl(parsed.query) if key.lower() != "page"]
    if page > 1:
        query.append(("page", str(page)))
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), ""))


def extract_album_links(soup: BeautifulSoup, category_url: str) -> list[str]:
    links: dict[str, None] = {}
    for anchor in soup.find_all("a", href=True):
        album_url = canonical_album_url(str(anchor["href"]), category_url)
        if album_url:
            links.setdefault(album_url, None)
    return list(links)


def discover_albums(
    session: requests.Session, category_url: str, delay: float, max_pages: int
) -> list[str]:
    """Varre páginas em sequência até não haver novos álbuns ou atingir o limite."""
    albums: dict[str, None] = {}
    for page in range(1, max_pages + 1):
        page_url = category_page_url(category_url, page)
        print(f"[categoria {page}] {page_url}")
        try:
            response = session.get(page_url, headers={"Referer": category_url}, timeout=(10, 30))
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"  Falha ao buscar página {page}: {exc}", file=sys.stderr)
            # Uma página intermediária pode falhar transitoriamente: não encerra
            # a varredura; a sessão já aplicou retries e avançamos à próxima.
            if page == 1:
                continue
            time.sleep(delay)
            continue

        found = extract_album_links(BeautifulSoup(response.text, "html.parser"), category_url)
        new_links = [url for url in found if url not in albums]
        for url in new_links:
            albums[url] = None
        print(f"  {len(new_links)} novos álbuns (acumulado: {len(albums)})")
        if not new_links:
            break
        if delay:
            time.sleep(delay)
    else:
        print(f"Aviso: limite de {max_pages} páginas alcançado.", file=sys.stderr)
    return list(albums)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def is_network_error(exc: Exception) -> bool:
    """Reconhece falhas de conexão/DNS e timeout, inclusive wrappers do requests."""
    if isinstance(exc, (requests.ConnectionError, requests.Timeout)):
        return True
    message = str(exc).lower()
    return any(token in message for token in (
        "getaddrinfo failed",
        "name resolution",
        "temporary failure in name resolution",
        "nodename nor servname",
        "timed out",
        "timeout",
    ))


def retry_delay(exc: Exception, attempt: int, fallback_delay: float) -> float:
    """Backoff exponencial (com jitter) nas falhas de rede; linear nas restantes."""
    if not is_network_error(exc):
        return max(fallback_delay, 1.0) * attempt
    backoff = min(NETWORK_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)), NETWORK_BACKOFF_MAX_SECONDS)
    return backoff + random.uniform(0.0, min(2.0, backoff * 0.2))


def album_title(soup: BeautifulSoup, fallback: str) -> str:
    title_node = (
        soup.select_one(".showalbumheader__gallerytitle")
        or soup.select_one(".showalbumheader__gallerytitle span")
        or soup.find("h1")
        or soup.find("h2")
        or soup.find("title")
    )
    title = clean_text(title_node.get_text(" ", strip=True)) if title_node else ""
    title = re.sub(r"\s*[|｜]\s*Yupoo\s*$", "", title, flags=re.IGNORECASE).strip()
    return title or fallback


def high_resolution_image(src: str) -> str | None:
    src = src.strip()
    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        return None
    parsed = urlsplit(src)
    if parsed.scheme not in ("http", "https") or not any(host in (parsed.hostname or "") for host in IMAGE_HOSTS):
        return None
    # Yupoo usa marcadores de tamanho no nome do host/caminho (small., thumb.,
    # medium.); "big" é o original de alta resolução usado pelo próprio site.
    host = re.sub(r"^(small|thumb|medium)\.", "big.", parsed.netloc, flags=re.IGNORECASE)
    path = re.sub(r"/(small|thumb|medium)\.", "/big.", parsed.path, flags=re.IGNORECASE)
    path = re.sub(r"\.(small|thumb|medium)(?=\.)", ".big", path, flags=re.IGNORECASE)
    return urlunsplit((parsed.scheme, host, path, parsed.query, ""))


def extract_images(soup: BeautifulSoup) -> list[str]:
    images: dict[str, None] = {}
    for image in soup.find_all("img"):
        for attr in ("data-origin-src", "data-src", "src", "data-original"):
            value = image.get(attr)
            if not value:
                continue
            url = high_resolution_image(str(value))
            if url:
                images.setdefault(url, None)
                break
    return list(images)


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return slug[:70].rstrip("-")


def product_payload(album_url: str, title: str, images: list[str]) -> dict[str, Any]:
    match = ALBUM_PATH.search(urlsplit(album_url).path)
    if not match:
        raise ValueError(f"URL sem identificador de álbum: {album_url}")
    yupoo_id = match.group(1)
    slug = f"{slugify(title) or 'produto'}-{slugify(yupoo_id)}"
    image_records = [
        {
            "src": image,
            "source": album_url,
            "alt": title,
            "credit": "Yupoo",
            "focalPoint": {"x": 50, "y": 50},
            "blurDataURL": "",
        }
        for image in images
    ]
    # Campos correspondem a db/yupoo_products.sql e lib/types.ts. Como o Yupoo
    # não confirma atributos de venda, valores desconhecidos ficam em revisão.
    return {
        "id": yupoo_id,
        "yupoo_id": yupoo_id,
        "slug": slug,
        "clube": "Revisar",
        "clubeSlug": "revisar",
        "liga": "revisar",
        "publico": "revisar",
        "tipo": "revisar",
        "temporada": "revisar",
        "uniforme": "revisar",
        "nome": title,
        "preco": 0,
        "tamanhos": [],
        "cor": "revisar",
        "imageSeed": title,
        "images": image_records,
    }


def import_album(
    session: requests.Session,
    supabase: Any,
    album_url: str,
    category_url: str,
    attempts: int,
    delay: float,
) -> bool:
    """Processa e grava um álbum; falhas são isoladas neste item."""
    album_id_match = ALBUM_PATH.search(urlsplit(album_url).path)
    fallback = f"Produto {album_id_match.group(1) if album_id_match else 'Yupoo'}"
    for attempt in range(1, attempts + 1):
        try:
            response = session.get(album_url, headers={"Referer": category_url}, timeout=(10, 35))
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            title = album_title(soup, fallback)
            images = extract_images(soup)
            if not images:
                raise ValueError("nenhuma imagem Yupoo reconhecida na página")
            payload = product_payload(album_url, title, images)
            supabase.table("products").upsert(payload, on_conflict="yupoo_id").execute()
            print(f"  OK: {title} ({len(images)} imagens)")
            return True
        except Exception as exc:  # API Supabase e scraping podem falhar por item.
            status = getattr(getattr(exc, "response", None), "status_code", None)
            detail = f"HTTP {status}" if status else str(exc)
            print(f"  Tentativa {attempt}/{attempts} falhou para {album_url}: {detail}", file=sys.stderr)
            if attempt < attempts:
                wait_seconds = retry_delay(exc, attempt, delay)
                print(f"  Nova tentativa em {wait_seconds:.1f}s.", file=sys.stderr)
                time.sleep(wait_seconds)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa produtos do Yupoo para Supabase")
    parser.add_argument("url", help="URL de categoria Yupoo, /categories/... ou /collections/...")
    parser.add_argument(
        "--category",
        default="Geral",
        help="Rótulo legado aceito por compatibilidade; public.products não tem coluna category",
    )
    parser.add_argument(
        "--project-root",
        default=".",
        help="Opção legada aceita por compatibilidade; este importador grava direto no Supabase",
    )
    parser.add_argument("--delay", type=float, default=1.0, help="Pausa entre páginas e álbuns (segundos)")
    parser.add_argument("--album-delay-min", type=float, default=2.5, help="Espera mínima entre álbuns (s)")
    parser.add_argument("--album-delay-max", type=float, default=5.0, help="Espera máxima entre álbuns (s)")
    parser.add_argument("--retries", type=int, default=4, help="Tentativas por álbum")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES_DEFAULT, help="Limite de páginas da categoria")
    args = parser.parse_args()

    parsed = urlsplit(args.url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or not parsed.path:
        parser.error("informe uma URL absoluta válida de categoria Yupoo")
    if not any(segment in parsed.path for segment in ("/categories/", "/collections/")):
        parser.error("a URL precisa conter /categories/ ou /collections/")
    if args.retries < 1 or args.max_pages < 1 or args.delay < 0:
        parser.error("retries/max-pages devem ser positivos e delay não pode ser negativo")

    if args.album_delay_min < 0 or args.album_delay_max < args.album_delay_min:
        parser.error("album-delay-min/max inválidos")
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not supabase_key:
        print("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.", file=sys.stderr)
        return 2
    supabase_host = urlsplit(supabase_url).hostname
    if not supabase_host:
        print("SUPABASE_URL inválida: não foi possível identificar o host.", file=sys.stderr)
        return 2
    try:
        socket.getaddrinfo(supabase_host, 443)
    except socket.gaierror as exc:
        print(f"DNS não resolve o host do Supabase ({supabase_host}): {exc}", file=sys.stderr)
        return 2
    try:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
    except Exception as exc:
        print(f"Não foi possível inicializar o cliente Supabase: {exc}", file=sys.stderr)
        return 2

    session = build_session()
    print(f"Categoria: {args.url}")
    albums = discover_albums(session, args.url, args.delay, args.max_pages)
    print(f"Álbuns únicos encontrados: {len(albums)}")
    if not albums:
        print("Nenhum álbum encontrado; confira se a categoria está acessível.", file=sys.stderr)
        return 1

    succeeded = 0
    failed = 0
    for index, album_url in enumerate(albums, start=1):
        print(f"[{index}/{len(albums)}] {album_url}")
        if import_album(session, supabase, album_url, args.url, args.retries, args.delay):
            succeeded += 1
        else:
            failed += 1
        if index < len(albums):
            album_wait = random.uniform(args.album_delay_min, args.album_delay_max)
            print(f"  Pausa antes do próximo álbum: {album_wait:.1f}s")
            time.sleep(album_wait)

    print(f"Concluído: {succeeded} importados, {failed} com falha.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

