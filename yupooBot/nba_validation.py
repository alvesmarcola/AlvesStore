"""Validação offline dos álbuns NBA (nba-albuns.json + nba-nomes.json).

Não acessa rede nem Supabase. Apenas lê, associa por id_album, valida e gera relatório.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from collections import Counter, defaultdict


REQUIRED_FIELDS = ["id_album", "nome", "time", "edicao", "numero", "slug"]
INCONSISTENCY_KEYWORDS = [
    "incomum", "incerto", "mais de um", "título diz", "titulo diz",
    "williams", "conferir foto", "álbum com só", "album com so", "nome ",
]


def load_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def merge_records(albuns: list[dict[str, Any]], nomes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_album = {a.get("id_album"): a for a in albuns}
    merged: list[dict[str, Any]] = []
    for n in nomes:
        a = by_album.get(n.get("id_album"), {}) or {}
        merged.append({
            "id_album": n.get("id_album"),
            "titulo_original": a.get("titulo_original"),
            "qtd_fotos": a.get("qtd_fotos"),
            "url_capa": a.get("url_capa"),
            "nome": n.get("nome"),
            "time": n.get("time"),
            "edicao": n.get("edicao"),
            "numero": n.get("numero"),
            "jogador": n.get("jogador"),
            "slug": n.get("slug"),
            "confirmar": bool(n.get("confirmar")),
            "motivo": n.get("motivo"),
        })
    return merged


def validate(
    albuns_path: str | Path,
    nomes_path: str | Path,
) -> dict[str, Any]:
    """Valida os dois arquivos e retorna um dicionário com o resultado."""
    albuns = load_json(albuns_path)
    nomes = load_json(nomes_path)

    ids_albuns = [a.get("id_album") for a in albuns]
    ids_nomes = [n.get("id_album") for n in nomes]

    dup_ids_albuns = [k for k, v in Counter(ids_albuns).items() if v > 1]
    dup_ids_nomes = [k for k, v in Counter(ids_nomes).items() if v > 1]
    set_albuns = set(ids_albuns)
    set_nomes = set(ids_nomes)
    missing_in_nomes = sorted(set_albuns - set_nomes)
    extra_in_nomes = sorted(set_nomes - set_albuns)

    empty_fields: list[dict[str, Any]] = []
    for n in nomes:
        for field in REQUIRED_FIELDS:
            value = n.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                empty_fields.append({
                    "id_album": n.get("id_album"),
                    "campo": field,
                    "valor": value,
                })

    slug_counts = Counter(n.get("slug") for n in nomes)
    repeated_slugs = [
        {
            "slug": slug,
            "ids": [n.get("id_album") for n in nomes if n.get("slug") == slug],
        }
        for slug, count in slug_counts.items()
        if count > 1
    ]

    merged = merge_records(albuns, nomes)

    # Possíveis duplicados: mesmo time + edição + número.
    groups: dict[tuple[Any, Any, Any], list[str]] = defaultdict(list)
    for rec in merged:
        groups[(rec.get("time"), rec.get("edicao"), rec.get("numero"))].append(
            rec.get("id_album")
        )
    possible_duplicates = [
        {
            "ids": ids,
            "chave": {"time": time, "edicao": edicao, "numero": numero},
        }
        for (time, edicao, numero), ids in groups.items()
        if len(ids) > 1
    ]

    # Inconsistências: registros pendentes com sinais no motivo.
    inconsistent: list[dict[str, Any]] = []
    for rec in merged:
        motivo = rec.get("motivo") or ""
        motivo_lower = motivo.lower()
        if rec.get("confirmar") and any(
            keyword in motivo_lower for keyword in INCONSISTENCY_KEYWORDS
        ):
            inconsistent.append({
                "id_album": rec.get("id_album"),
                "nome": rec.get("nome"),
                "motivo": motivo,
            })

    confirmar_true_ids = [rec.get("id_album") for rec in merged if rec.get("confirmar")]
    ready_ids = [rec.get("id_album") for rec in merged if not rec.get("confirmar")]

    result: dict[str, Any] = {
        "resumo": {
            "total_albuns_encontrados": len(albuns),
            "total_traducoes_correspondentes": len(
                [n for n in nomes if n.get("id_album") in set_albuns]
            ),
            "total_registros_aprovados": len(ready_ids),
            "total_pendentes_conferencia": len(confirmar_true_ids),
            "total_possiveis_duplicados": len(possible_duplicates),
            "total_inconsistencias": len(inconsistent),
            "total_prontos_importacao": len(ready_ids),
        },
        "validacoes": {
            "ids_ausentes_em_traducoes": missing_in_nomes,
            "ids_ausentes_em_albuns": extra_in_nomes,
            "ids_duplicados_em_albuns": dup_ids_albuns,
            "ids_duplicados_em_traducoes": dup_ids_nomes,
            "slugs_repetidos": repeated_slugs,
            "campos_obrigatorios_vazios": empty_fields,
        },
        "confirmar_true": confirmar_true_ids,
        "possiveis_duplicados": possible_duplicates,
        "inconsistencias": inconsistent,
        "registros_prontos_importacao": ready_ids,
        "registros": merged,
    }
    return result


def write_outputs(
    result: dict[str, Any],
    output_json: str | Path,
    output_report: str | Path,
) -> None:
    """Grava o JSON de validação e um relatório legível em texto."""
    Path(output_json).write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    lines: list[str] = []
    lines.append("RELATÓRIO DE VALIDAÇÃO NBA (Yupoo)")
    lines.append("=" * 60)
    resumo = result["resumo"]
    lines.append(f"Total de álbuns encontrados: {resumo['total_albuns_encontrados']}")
    lines.append(f"Total de traduções correspondentes: {resumo['total_traducoes_correspondentes']}")
    lines.append(f"Total de registros aprovados: {resumo['total_registros_aprovados']}")
    lines.append(f"Total de registros pendentes de conferência: {resumo['total_pendentes_conferencia']}")
    lines.append(f"Total de possíveis duplicados (grupos): {resumo['total_possiveis_duplicados']}")
    lines.append(f"Total de inconsistências: {resumo['total_inconsistencias']}")
    lines.append(f"Total de registros prontos para importação: {resumo['total_prontos_importacao']}")
    lines.append("")

    val = result["validacoes"]
    lines.append("VALIDAÇÕES")
    lines.append("-" * 60)
    lines.append(f"IDs ausentes em traduções: {val['ids_ausentes_em_traducoes'] or 'nenhum'}")
    lines.append(f"IDs ausentes em álbuns: {val['ids_ausentes_em_albuns'] or 'nenhum'}")
    lines.append(f"IDs duplicados em álbuns: {val['ids_duplicados_em_albuns'] or 'nenhum'}")
    lines.append(f"IDs duplicados em traduções: {val['ids_duplicados_em_traducoes'] or 'nenhum'}")
    lines.append(f"Slugs repetidos: {val['slugs_repetidos'] or 'nenhum'}")
    lines.append(f"Campos obrigatórios vazios: {val['campos_obrigatorios_vazios'] or 'nenhum'}")
    lines.append("")

    lines.append("POSSÍVEIS DUPLICADOS (IDs envolvidos)")
    lines.append("-" * 60)
    for group in result["possiveis_duplicados"]:
        chave = group["chave"]
        lines.append(
            f"- {group['ids']}  (time={chave['time']}, edicao={chave['edicao']}, "
            f"numero={chave['numero']})"
        )
    lines.append("")

    lines.append("PRODUTOS COM INCONSISTÊNCIAS")
    lines.append("-" * 60)
    for inc in result["inconsistencias"]:
        lines.append(f"- {inc['id_album']} | {inc['nome']} | {inc['motivo']}")
    lines.append("")

    lines.append("REGISTROS PRONTOS PARA IMPORTAÇÃO (IDs)")
    lines.append("-" * 60)
    lines.append(", ".join(result["registros_prontos_importacao"]))
    lines.append("")

    lines.append("REGISTROS PENDENTES DE CONFERÊNCIA (IDs)")
    lines.append("-" * 60)
    lines.append(", ".join(result["confirmar_true"]))
    lines.append("")

    Path(output_report).write_text("\n".join(lines), encoding="utf-8")
