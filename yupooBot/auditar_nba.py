import json
from pathlib import Path

base = Path('.')
albuns = json.loads((base/'nba-albuns.json').read_text(encoding='utf-8'))
nomes = json.loads((base/'nba-nomes.json').read_text(encoding='utf-8'))
valid = json.loads((base/'nba-validacao.json').read_text(encoding='utf-8'))

by_album = {a['id_album']: a for a in albuns}
by_nome = {n['id_album']: n for n in nomes}

# Grupos de possiveis duplicados (time+edicao+numero)
dup_groups = valid['possiveis_duplicados']
dup_ids = set()
for g in dup_groups:
    for i in g['ids']:
        dup_ids.add(i)

incons_ids = [x['id_album'] for x in valid['inconsistencias']]
incons_map = {x['id_album']: x['motivo'] for x in valid['inconsistencias']}

entries = []
for n in nomes:
    aid = n['id_album']
    a = by_album.get(aid, {})
    merged_name = n.get('nome')
    confirmar = bool(n.get('confirmar'))
    motivo = n.get('motivo')

    if not confirmar:
        resultado = 'Aprovado sem ressalvas'
        pode = True
        sugestao = None
        just = 'Sem sinais de duplicidade ou inconsistencia; confirmar=false.'
    else:
        pode = False
        if aid in dup_ids:
            resultado = 'Possivel duplicado (mesmo time/edicao/numero)'
            sugestao = None
            just = motivo or 'Possivel duplicado detectado na validacao.'
        elif aid in incons_map:
            resultado = 'Inconsistencia de time/jogador/numero/edicao'
            m = (motivo or '').lower()
            if 'incomum' in m:
                # sugestao segura: remover jogador nao confirmado
                sugestao = 'Regata NBA {} {} #{}'.format(n.get('time'), n.get('edicao'), n.get('numero'))
                just = motivo + ' Sugestao: remover jogador nao confirmado ate conferencia visual.'
            elif 'mais de um brown' in m:
                sugestao = 'Regata NBA 76ers Retro Preta #7'
                just = motivo + ' Sugestao: remover sobrenome ambiguo ate conferencia visual.'
            elif 'williams' in m:
                sugestao = None
                just = motivo + ' Possivel Zion Williamson #1, mas nao confirmado visualmente.'
            elif 'incerto' in m or 'keita' in m:
                sugestao = None
                just = motivo
            elif 'album com so' in m or 'conferir foto' in m:
                sugestao = None
                just = motivo
            else:
                sugestao = None
                just = motivo or 'Pendente de conferencia manual.'
        else:
            resultado = 'Pendente de conferencia manual'
            sugestao = None
            just = motivo or 'Pendente de conferencia manual.'

    entries.append({
        'id_album': aid,
        'nome_atual': merged_name,
        'time': n.get('time'),
        'edicao': n.get('edicao'),
        'numero': n.get('numero'),
        'jogador': n.get('jogador'),
        'slug': n.get('slug'),
        'qtd_fotos': a.get('qtd_fotos'),
        'url_capa': a.get('url_capa'),
        'confirmar': confirmar,
        'resultado_conferencia': resultado,
        'possivel_nome_corrigido': sugestao,
        'pode_ser_importado': pode,
        'justificativa': just,
    })

aprovados = [e['id_album'] for e in entries if e['pode_ser_importado']]
pendentes = [e['id_album'] for e in entries if not e['pode_ser_importado']]

audit = {
    'resumo': {
        'total_produtos': len(entries),
        'total_aprovados_importacao': len(aprovados),
        'total_pendentes_conferencia_manual': len(pendentes),
        'total_possiveis_duplicados': len(dup_groups),
        'total_inconsistencias': len(incons_ids),
        'observacao': 'Auditoria visual automatizada limitada: o modelo atual nao processa imagens. '
                     'Os 20 itens pendentes exigem conferencia visual manual das fotos (frente/costas) '
                     'antes da importacao. Nenhum produto foi cadastrado.',
    },
    'grupos_possiveis_duplicados': dup_groups,
    'produtos_aprovados_importacao': aprovados,
    'produtos_pendentes_conferencia_manual': pendentes,
    'auditoria': entries,
}

(base/'nba-auditoria-visual.json').write_text(
    json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)

# Relatorio legivel
lines = []
lines.append('AUDITORIA VISUAL NBA (Yupoo)')
lines.append('=' * 60)
lines.append('Total de produtos: {}'.format(len(entries)))
lines.append('Aprovados para importacao: {}'.format(len(aprovados)))
lines.append('Pendentes de conferencia manual: {}'.format(len(pendentes)))
lines.append('Possiveis duplicados (grupos): {}'.format(len(dup_groups)))
lines.append('Inconsistencias: {}'.format(len(incons_ids)))
lines.append('')
lines.append('OBSERVACAO')
lines.append('-' * 60)
lines.append('Auditoria visual automatizada limitada: o modelo atual nao processa imagens.')
lines.append('Os 20 itens pendentes exigem conferencia visual manual (frente/costas).')
lines.append('Nenhum produto foi cadastrado, alterado ou excluido.')
lines.append('')
lines.append('PRODUTOS APROVADOS PARA IMPORTACAO (IDs)')
lines.append('-' * 60)
lines.append(', '.join(aprovados))
lines.append('')
lines.append('PRODUTOS PENDENTES DE CONFERENCIA MANUAL')
lines.append('-' * 60)
for e in entries:
    if not e['pode_ser_importado']:
        lines.append('{} | {} | {} | sugestao: {} | {}'.format(
            e['id_album'], e['nome_atual'], e['resultado_conferencia'],
            e['possivel_nome_corrigido'], e['justificativa']))
lines.append('')
lines.append('GRUPOS DE POSSIVEIS DUPLICADOS')
lines.append('-' * 60)
for g in dup_groups:
    c = g['chave']
    lines.append('{} (time={}, edicao={}, numero={})'.format(
        g['ids'], c['time'], c['edicao'], c['numero']))
(base/'nba-auditoria-visual.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('Aprovados:', len(aprovados))
print('Pendentes:', len(pendentes))
print('Gerado: nba-auditoria-visual.json e nba-auditoria-visual.txt')
