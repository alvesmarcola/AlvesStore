import fs from "node:fs";
import path from "node:path";

export interface RemovePhotoTarget {
  slug: string;
  removeIndices?: number[]; // 1-based (ex: [2] para a 2ª foto)
  removeUrls?: string[];
  reason?: string;
}

export interface RemovePhotosOptions {
  targets?: RemovePhotoTarget[];
  confirm?: boolean;
  f1JsonPath?: string;
  blacklistPath?: string;
}

export interface RemovalResult {
  slug: string;
  nome: string;
  fotosAntes: number;
  fotosDepois: number;
  removidas: string[];
  oculto: boolean;
}

export const KNOWN_WATERMARKED_F1_POLOS: RemovePhotoTarget[] = [
  {
    slug: "camisa-polo-mclaren-f1-team-laranja-preta",
    removeUrls: ["https://photo.yupoo.com/minkang/d42fb87d6f/aecba1ac.jpg"],
    removeIndices: [2],
    reason: "Marca d'água do fornecedor (minkang.x.yupoo.com) na manga",
  },
  {
    slug: "camisa-polo-williams-racing-f1-preta-azul",
    removeUrls: ["https://photo.yupoo.com/minkang/e8d00f56cf/afef04e4.jpg"],
    removeIndices: [2],
    reason: "Marca d'água do fornecedor (minkang.x.yupoo.com) sobre o logo Coolera",
  },
];

export function removerFotosF1(options: RemovePhotosOptions = {}) {
  const rootDir = process.cwd();
  const f1Path = options.f1JsonPath || path.join(rootDir, "data", "f1-products.json");
  const blacklistPath = options.blacklistPath || path.join(rootDir, "data", "yupoo-image-blacklist.json");
  const targets = options.targets || KNOWN_WATERMARKED_F1_POLOS;
  const confirm = Boolean(options.confirm);

  if (!fs.existsSync(f1Path)) {
    throw new Error(`Arquivo não encontrado: ${f1Path}`);
  }

  const raw = fs.readFileSync(f1Path, "utf8");
  const products: any[] = JSON.parse(raw);

  const results: RemovalResult[] = [];
  const allRemovedUrls: { url: string; slug: string; reason: string }[] = [];

  for (const target of targets) {
    const product = products.find((p) => p.slug === target.slug || p.id === target.slug);
    if (!product) {
      console.warn(`[Aviso] Produto não encontrado no catálogo F1: ${target.slug}`);
      continue;
    }

    const initialImages = Array.isArray(product.images) ? [...product.images] : [];
    const removed: string[] = [];

    const remainingImages = initialImages.filter((img, idx) => {
      const index1Based = idx + 1;
      const matchIndex = target.removeIndices && target.removeIndices.includes(index1Based);
      const matchUrl = target.removeUrls && target.removeUrls.some((u) => img.src === u || img.src?.includes(u));

      if (matchIndex || matchUrl) {
        removed.push(img.src);
        allRemovedUrls.push({
          url: img.src,
          slug: product.slug,
          reason: target.reason || "Marca d'água do fornecedor (minkang.x.yupoo.com)",
        });
        return false;
      }
      return true;
    });

    if (removed.length > 0) {
      product.images = remainingImages;
      // Requisito 3: Se o produto ficar sem nenhuma foto limpa, oculte-o em vez de deixar o card vazio.
      if (remainingImages.length === 0) {
        product.oculto = true;
      }

      results.push({
        slug: product.slug,
        nome: product.nome,
        fotosAntes: initialImages.length,
        fotosDepois: remainingImages.length,
        removidas: removed,
        oculto: Boolean(product.oculto),
      });
    }
  }

  if (confirm && results.length > 0) {
    // 1. Backup do arquivo f1-products.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(rootDir, "data", `f1-products.backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, raw, "utf8");
    console.log(`[Backup] Criado backup com sucesso: ${backupPath}`);

    // 2. Gravação do arquivo f1-products.json atualizado
    fs.writeFileSync(f1Path, JSON.stringify(products, null, 2) + "\n", "utf8");
    console.log(`[Atualização] ${results.length} produto(s) atualizados em ${f1Path}`);

    // 3. Requisito 4: Adição na lista de exclusão do Yupoo bot
    let blacklistData = { updated_at: "", description: "", excluded_urls: [] as string[], exclusions: [] as any[] };
    if (fs.existsSync(blacklistPath)) {
      try {
        blacklistData = JSON.parse(fs.readFileSync(blacklistPath, "utf8"));
      } catch {
        // mantém padrão
      }
    }
    const currentExcludedSet = new Set(blacklistData.excluded_urls || []);
    for (const item of allRemovedUrls) {
      if (!currentExcludedSet.has(item.url)) {
        currentExcludedSet.add(item.url);
        blacklistData.exclusions.push({
          url: item.url,
          product_slug: item.slug,
          reason: item.reason,
          removed_at: new Date().toISOString(),
        });
      }
    }
    blacklistData.excluded_urls = Array.from(currentExcludedSet);
    blacklistData.updated_at = new Date().toISOString();
    fs.writeFileSync(blacklistPath, JSON.stringify(blacklistData, null, 2) + "\n", "utf8");
    console.log(`[Blacklist] ${allRemovedUrls.length} foto(s) registradas na lista de exclusão do Yupoo bot em ${blacklistPath}`);
  }

  return {
    confirmado: confirm,
    totalModificados: results.length,
    resultados: results,
  };
}

// Execução direta via CLI
if (require.main === module) {
  const isConfirm = process.argv.includes("--confirm");
  console.log(`\n=== REMOÇÃO DE FOTOS COM MARCA D'ÁGUA (POLOS F1) [${isConfirm ? "CONFIRMADO" : "DRY-RUN"}] ===\n`);
  const res = removerFotosF1({ confirm: isConfirm });
  console.log(`Total de produtos afetados: ${res.totalModificados}`);
  for (const r of res.resultados) {
    console.log(`\n• ${r.nome} (${r.slug}):`);
    console.log(`  Fotos: ${r.fotosAntes} -> ${r.fotosDepois}`);
    console.log(`  Removida(s): ${r.removidas.join(", ")}`);
    if (r.oculto) console.log(`  [AVISO] Produto ocultado por não possuir fotos restantes.`);
  }
  if (!isConfirm) {
    console.log(`\nℹ️ Modo DRY-RUN: nenhum arquivo foi alterado. Use --confirm para aplicar.\n`);
  }
}
