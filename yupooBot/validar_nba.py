"""CLI para validar nba-albuns.json + nba-nomes.json (sem acessar banco/rede)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nba_validation import validate, write_outputs


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Valida os arquivos NBA e gera nba-validacao.json + relatório"
    )
    parser.add_argument("--albuns", default="nba-albuns.json", help="Arquivo de álbuns originais")
    parser.add_argument("--nomes", default="nba-nomes.json", help="Arquivo de traduções")
    parser.add_argument("--output", default="nba-validacao.json", help="JSON de validação")
    parser.add_argument("--report", default="nba-validacao-relatorio.txt", help="Relatório legível")
    args = parser.parse_args()

    result = validate(args.albuns, args.nomes)
    write_outputs(result, args.output, args.report)

    resumo = result["resumo"]
    print(f"Álbuns: {resumo['total_albuns_encontrados']}")
    print(f"Traduções correspondentes: {resumo['total_traducoes_correspondentes']}")
    print(f"Aprovados: {resumo['total_registros_aprovados']}")
    print(f"Pendentes: {resumo['total_pendentes_conferencia']}")
    print(f"Possíveis duplicados (grupos): {resumo['total_possiveis_duplicados']}")
    print(f"Inconsistências: {resumo['total_inconsistencias']}")
    print(f"Prontos para importação: {resumo['total_prontos_importacao']}")
    print(f"Gerado: {args.output} e {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
