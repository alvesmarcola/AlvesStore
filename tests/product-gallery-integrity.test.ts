import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Auditoria e Integridade das Galerias de Produtos', () => {
  const productsFilePath = path.join(__dirname, '..', 'data', 'products.json');
  const products: any[] = JSON.parse(fs.readFileSync(productsFilePath, 'utf8'));
  const productsMap = new Map<string, any>(products.map((p: any) => [p.slug, p]));

  it('deve manter o catálogo com 720 produtos e sem produtos vazios', () => {
    assert.equal(products.length, 720);
    for (const p of products) {
      assert.ok(p.id);
      assert.ok(p.slug);
      assert.ok(p.nome);
      assert.ok(p.preco > 0);
      assert.ok(p.images);
      assert.ok(p.images.length >= 1);
      for (const img of p.images) {
        assert.ok(img.src);
        assert.ok(img.src.startsWith('/otimizadas/'));
      }
    }
  });

  it('deve garantir que a camisa do Al-Hilal 25/26 exibe somente fotos do uniforme anunciado (sem fotos do uniforme reserva branco misturadas)', () => {
    const hilal = productsMap.get('camisa-jogador-campeonato-da-arabia-al-hilal-25-26');
    assert.ok(hilal);
    assert.equal(hilal.images.length, 1);
    assert.ok(hilal.images[0].source.includes('Al Hillal 25_26.jpg'));
    // Garante que o arquivo (1).jpg (camisa branca) foi desvinculado da galeria
    const hasBranca = hilal.images.some((i: any) => i.source && i.source.includes('Al Hillal 25_26(1).jpg'));
    assert.equal(hasBranca, false);
  });

  it('deve garantir que a camisa do Ajax 26/27 exibe somente fotos do uniforme titular (sem camisa reserva celeste misturada)', () => {
    const ajax = productsMap.get('camisa-jogador-campeonato-holandes-ajax-26-27');
    assert.ok(ajax);
    assert.equal(ajax.images.length, 1);
    assert.ok(ajax.images[0].source.includes('Ajax 26_27.jpg'));
    // Garante que o arquivo (1).jpg (camisa azul celeste) foi desvinculado da galeria
    const hasCeleste = ajax.images.some((i: any) => i.source && i.source.includes('Ajax 26_27(1).jpg'));
    assert.equal(hasCeleste, false);
  });

  it('deve garantir que os kits infantis não possuem conjuntos titular e reserva misturados na mesma galeria', () => {
    const kits = products.filter((p: any) => p.slug.startsWith('kits-infantis-'));
    assert.equal(kits.length, 34);

    const kitsVerificados = [
      'kits-infantis-selecoes-asia-japao-26-27',
      'kits-infantis-selecoes-europa-alemanha-26-27',
      'kits-infantis-selecoes-europa-espanha-26-27',
      'kits-infantis-selecoes-europa-franca-26-27',
      'kits-infantis-selecoes-europa-italia-26-27',
      'kits-infantis-selecoes-europa-portugal-26-27',
    ];

    for (const slug of kitsVerificados) {
      const kit = productsMap.get(slug);
      assert.ok(kit);
      assert.equal(kit.images.length, 1);
      // Nenhuma foto secundária de outro modelo deve estar anexada
      assert.equal(kit.images.some((i: any) => i.source && i.source.includes('(1).jpg')), false);
      assert.equal(kit.images.some((i: any) => i.source && i.source.includes('(2).jpg')), false);
    }
  });

  it('deve preservar as galerias legítimas com múltiplas fotos da mesma peça (frente/costas/detalhes)', () => {
    const inter = productsMap.get('camisa-jogador-campeonato-italiano-inter-26-27');
    assert.ok(inter);
    assert.ok(inter.images.length >= 2);

    const corinthians = productsMap.get('camisa-jogador-brasileirao-corinthians-26-27');
    assert.ok(corinthians);
    assert.ok(corinthians.images.length >= 2);

    const barca = productsMap.get('camisa-jogador-la-liga-barcelona-26-27');
    assert.ok(barca);
    assert.equal(barca.images.length, 2);

    const psg = productsMap.get('camisa-jogador-campeonato-frances-paris-saint-germain-26-27');
    assert.ok(psg);
    assert.equal(psg.images.length, 2);
  });

  it('deve conter o relatório de imagens desvinculadas para futura revisão e criação de novos produtos', () => {
    const relatorioPath = path.join(__dirname, '..', 'relatorios', 'imagens_desvinculadas_para_revisao.json');
    assert.ok(fs.existsSync(relatorioPath));
    const relatorio = JSON.parse(fs.readFileSync(relatorioPath, 'utf8'));
    assert.equal(relatorio.totalImagensDesvinculadas, 155);
    assert.equal(relatorio.imagensDesvinculadas.length, 155);

    // Confirma presença da foto branca do Al-Hilal no relatório
    const hilalBranca = relatorio.imagensDesvinculadas.find((i: any) =>
      i.produtoSlug === 'camisa-jogador-campeonato-da-arabia-al-hilal-25-26'
    );
    assert.ok(hilalBranca);
    assert.ok(hilalBranca.source.includes('Al Hillal 25_26(1).jpg'));

    // Confirma presença da foto celeste do Ajax no relatório
    const ajaxCeleste = relatorio.imagensDesvinculadas.find((i: any) =>
      i.produtoSlug === 'camisa-jogador-campeonato-holandes-ajax-26-27'
    );
    assert.ok(ajaxCeleste);
    assert.ok(ajaxCeleste.source.includes('Ajax 26_27(1).jpg'));
  });
});
