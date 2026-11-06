import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validarEAplicarDecisoes } from '../scripts/aplicar-decisoes-galerias';

describe('Validação do Script de Aplicação de Decisões de Galerias', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'decisoes-exemplo.json');
  const productsFilePath = path.join(__dirname, '..', 'data', 'products.json');

  it('1. Script em dry-run não altera arquivos em disco', () => {
    const mtimeAntes = fs.statSync(productsFilePath).mtimeMs;
    const contentAntes = fs.readFileSync(productsFilePath, 'utf8');

    const resultado = validarEAplicarDecisoes({
      decisoesPath: fixturePath,
      confirmar: false, // DRY-RUN
    });

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.modo, 'DRY-RUN');
    assert.equal(resultado.totalProcessados, 2);
    assert.equal(resultado.erros.length, 0);

    const mtimeDepois = fs.statSync(productsFilePath).mtimeMs;
    const contentDepois = fs.readFileSync(productsFilePath, 'utf8');

    assert.equal(mtimeDepois, mtimeAntes, 'O arquivo products.json não deve ter mtime alterado no dry-run');
    assert.equal(contentDepois, contentAntes, 'O conteúdo de products.json deve permanecer exatamente igual no dry-run');
  });

  it('2. Rejeita decisão que deixa produto sem imagem (images vazio)', () => {
    const tempDir = path.join(__dirname, 'temp-test-decisoes');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const decInvalidaPath = path.join(tempDir, 'decisao-sem-imagem.json');
    fs.writeFileSync(
      decInvalidaPath,
      JSON.stringify({
        'camisa-jogador-campeonato-da-arabia-al-hilal-25-26': {
          images: [],
          main: '',
        },
      }),
      'utf8'
    );

    const resultado = validarEAplicarDecisoes({
      decisoesPath: decInvalidaPath,
      confirmar: false,
    });

    assert.equal(resultado.sucesso, false);
    assert.ok(resultado.erros.length > 0);
    assert.ok(
      resultado.erros.some(e => e.includes('a lista de imagens não pode ser vazia')),
      'Deve conter mensagem clara rejeitando lista de imagens vazia'
    );

    // Limpeza
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('3. Rejeita arquivo de imagem inexistente no disco', () => {
    const tempDir = path.join(__dirname, 'temp-test-decisoes-2');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const decArquivoFantasmaPath = path.join(tempDir, 'decisao-arquivo-fantasma.json');
    fs.writeFileSync(
      decArquivoFantasmaPath,
      JSON.stringify({
        'camisa-jogador-campeonato-da-arabia-al-hilal-25-26': {
          images: ['arquivo-que-nao-existe-999.webp'],
          main: 'arquivo-que-nao-existe-999.webp',
        },
      }),
      'utf8'
    );

    const resultado = validarEAplicarDecisoes({
      decisoesPath: decArquivoFantasmaPath,
      confirmar: false,
    });

    assert.equal(resultado.sucesso, false);
    assert.ok(resultado.erros.length > 0);
    assert.ok(
      resultado.erros.some(e => e.includes('Arquivo de imagem não encontrado fisicamente')),
      'Deve conter erro informando que o arquivo não existe'
    );

    // Limpeza
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('4. Rejeita decisão onde main não está presente em images', () => {
    const tempDir = path.join(__dirname, 'temp-test-decisoes-3');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const decMainInvalidaPath = path.join(tempDir, 'decisao-main-invalida.json');
    fs.writeFileSync(
      decMainInvalidaPath,
      JSON.stringify({
        'camisa-jogador-campeonato-da-arabia-al-hilal-25-26': {
          images: ['01-800.webp'],
          main: '02-800.webp', // 02 não está em images!
        },
      }),
      'utf8'
    );

    const resultado = validarEAplicarDecisoes({
      decisoesPath: decMainInvalidaPath,
      confirmar: false,
    });

    assert.equal(resultado.sucesso, false);
    assert.ok(resultado.erros.length > 0);
    assert.ok(
      resultado.erros.some(e => e.includes('deve constar na lista de imagens permitidas')),
      'Deve validar que main precisa constar em images'
    );

    // Limpeza
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('5. Altera estritamente o campo images, preservando todos os demais atributos intactos', () => {
    const tempDir = path.join(__dirname, 'temp-test-decisoes-4');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const fakeProductsPath = path.join(tempDir, 'products-copy.json');
    const fakeDesvPath = path.join(tempDir, 'desv-copy.json');
    fs.copyFileSync(productsFilePath, fakeProductsPath);
    fs.writeFileSync(fakeDesvPath, JSON.stringify({ imagensDesvinculadas: [] }), 'utf8');

    const pAntes = JSON.parse(fs.readFileSync(fakeProductsPath, 'utf8')).find(
      (p: any) => p.slug === 'camisa-jogador-campeonato-da-arabia-al-hilal-25-26'
    );

    // Executa em ambiente isolado de teste com confirmar: true
    const resultado = validarEAplicarDecisoes({
      decisoesPath: fixturePath,
      produtosPath: fakeProductsPath,
      desvinculadasPath: fakeDesvPath,
      confirmar: true,
    });

    assert.equal(resultado.sucesso, true);

    const pDepois = JSON.parse(fs.readFileSync(fakeProductsPath, 'utf8')).find(
      (p: any) => p.slug === 'camisa-jogador-campeonato-da-arabia-al-hilal-25-26'
    );

    // Campos imutáveis
    assert.equal(pDepois.id, pAntes.id);
    assert.equal(pDepois.slug, pAntes.slug);
    assert.equal(pDepois.nome, pAntes.nome);
    assert.equal(pDepois.preco, pAntes.preco);
    assert.equal(pDepois.clube, pAntes.clube);
    assert.equal(pDepois.liga, pAntes.liga);
    assert.equal(pDepois.publico, pAntes.publico);
    assert.equal(pDepois.tipo, pAntes.tipo);
    assert.deepEqual(pDepois.tamanhos, pAntes.tamanhos);

    // Somente images alterado/validado
    assert.ok(pDepois.images.length >= 1);
    assert.equal(path.basename(pDepois.images[0].src), '01-800.webp');

    // Limpeza
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

