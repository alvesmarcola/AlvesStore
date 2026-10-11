import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, rename, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { storeConfig } from "../config";
import type { Audience, Product, ProductImage, ProductType, Uniform } from "../lib/types";

type LeagueData = {
  slug: string;
  nome: string;
  imagemCapa: string;
  clubes: { slug: string; nome: string }[];
};
type ClubRef = { slug: string; nome: string; league: LeagueData };
type ReviewField = "clube" | "liga" | "publico" | "tipo" | "temporada" | "uniforme";
type ReviewRow = Record<ReviewField | "slug" | "arquivos" | "campos_revisar", string>;
type ProductGroup = {
  key: string;
  files: ValidImage[];
  rootCategory: string;
  directory: string;
  club?: ClubRef;
  league?: LeagueData;
  audience: Audience;
  type: ProductType;
  season: string;
  uniform: Uniform;
};
type ValidImage = {
  absolutePath: string;
  relativePath: string;
  relativePublicPath: string;
  name: string;
  directory: string;
  rootCategory: string;
  size: number;
  mtimeMs: number;
  width: number;
  height: number;
  hash: string;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "public", "catalogo");
const optimizedRoot = path.join(projectRoot, "public", "otimizadas");
const productsPath = path.join(projectRoot, "data", "products.json");
const leaguesPath = path.join(projectRoot, "data", "leagues.json");
const reviewPath = path.join(projectRoot, "data", "catalogo-revisao.csv");
const correctionsPath = path.join(projectRoot, "data", "catalogo-correcoes.json");
const themePath = path.join(projectRoot, "data", "catalogo-imagens.json");
const originsPath = path.join(projectRoot, "data", "catalogo-origem.json");
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const minFileBytes = 12_000;
const minWidth = 200;
const minHeight = 250;
const sizes = [400, 800, 1600] as const;
const reviewFields: ReviewField[] = ["clube", "liga", "publico", "tipo", "temporada", "uniforme"];
const audiences = new Set<Audience>(["masculino", "feminino", "unissex", "revisar"]);
const productTypes = new Set<ProductType>(["torcedor", "jogador", "retro", "treino", "cropped", "regata", "inverno", "vestido", "revisar"]);
const uniforms = new Set<Uniform>(["titular", "reserva", "terceiro", "revisar"]);

const leagueAliases: Record<string, string[]> = {
  "brasileirao-serie-a": ["brasileirao", "campeonato brasileiro", "serie a brasil", "serie a brasileira"],
  "premier-league": ["premier league", "campeonato ingles", "liga inglesa"],
  "la-liga": ["la liga", "campeonato espanhol", "liga espanhola"],
  "serie-a": ["campeonato italiano", "serie a italiana", "liga italiana"],
  bundesliga: ["bundesliga", "campeonato alemao", "liga alema"],
  "ligue-1": ["ligue 1", "campeonato frances", "liga francesa"],
  "liga-portugal": ["liga portugal", "campeonato portugues", "liga portuguesa"],
  eredivisie: ["eredivisie", "campeonato holandes", "liga holandesa", "liga neerlandesa"],
  "scottish-premiership": ["scottish premiership", "campeonato escoces", "liga escocesa"],
  mls: ["major league soccer", "mls"],
  "saudi-pro-league": ["saudi pro league", "campeonato da arabia", "liga saudita"],
  "copa-libertadores": ["copa libertadores", "libertadores"],
  "uefa-champions-league": ["uefa champions league", "champions league", "liga dos campeoes"],
  selecoes: ["selecoes", "selections", "national teams"],
};

const explicitQualifiers = [
  "goleiro", "goleira", "keeper", "treino", "training", "pre jogo", "pre match",
  "retro", "titular", "reserva", "terceiro", "third", "home", "away",
  "cropped", "regata", "manga longa", "comemorativa", "100 anos", "patch campeao",
];
const unmodeledCompetitionAliases = [
  "campeonato argentino", "liga argentina", "campeonato colombiano", "campeonato da colombia",
  "liga mexicana", "campeonato mexicano", "campeonato turco", "liga turca",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "produto";
}

function cleanCopiedName(value: string) {
  return value
    .replace(/^#\s*\d+\s*/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[_\s-]+$/, "")
    .trim();
}

function includesWords(haystack: string, needle: string) {
  return ` ${haystack} `.includes(` ${needle} `);
}

function seasonFrom(value: string) {
  const season = value.match(/(?:^|\D)(20\d{2}|\d{2})[_/-](20\d{2}|\d{2})(?!\d)/);
  if (season) {
    const start = Number(season[1].slice(-2));
    const end = Number(season[2].slice(-2));
    if (end !== (start + 1) % 100) return "revisar";
    return `${String(start).padStart(2, "0")}/${String(end).padStart(2, "0")}`;
  }
  const year = value.match(/(?:^|\D)(19\d{2}|20\d{2})(?!\d)/);
  return year?.[1] ?? "revisar";
}

function clubCandidates(clubs: ClubRef[], value: string) {
  const text = normalize(value);
  return clubs.filter((club) => {
    const clubName = normalize(club.nome).replace(/\b(fc|cf|sc|afc|ac)\b/g, "").replace(/\s+/g, " ").trim();
    return clubName.length > 2 && includesWords(text, clubName);
  });
}

function findLeague(leagues: LeagueData[], directory: string, filename: string) {
  const text = normalize(`${directory} ${filename}`);
  for (const league of leagues) {
    const aliases = [league.nome, league.slug.replaceAll("-", " "), ...(leagueAliases[league.slug] ?? [])];
    if (aliases.some((alias) => includesWords(text, normalize(alias)))) return league;
  }
  return undefined;
}

function audienceFrom(category: string): Audience {
  const folder = normalize(category);
  if (folder.includes("feminina")) return "feminino";
  if (folder.includes("camisa jogador") || folder.includes("manga longa torcedor")) return "masculino";
  return "revisar";
}

function typeFrom(category: string, filename: string): ProductType {
  const text = normalize(`${category} ${filename}`);
  if (text.includes("goleiro") || text.includes("goleira")) return "revisar";
  if (text.includes("treino") || text.includes("training") || text.includes("pre jogo") || text.includes("pre match")) return "treino";
  if (text.includes("retro")) return "retro";
  if (text.includes("cropped")) return "cropped";
  if (text.includes("regata")) return "regata";
  if (text.includes("vestido")) return "vestido";
  if (text.includes("manga longa")) return "inverno";
  if (normalize(category).includes("camisa jogador")) return "jogador";
  if (normalize(category).includes("torcedor")) return "torcedor";
  return "revisar";
}

function uniformFrom(value: string): Uniform {
  const text = normalize(value);
  if (/\b(titular|home|1st)\b/.test(text)) return "titular";
  if (/\b(reserva|away|2nd)\b/.test(text)) return "reserva";
  if (/\b(terceiro|terceira|third|3rd)\b/.test(text)) return "terceiro";
  return "revisar";
}

function qualifiersFrom(value: string) {
  const text = normalize(value);
  return explicitQualifiers.filter((qualifier) => includesWords(text, normalize(qualifier))).sort();
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() ? [fullPath] : [];
  }));
  return paths.flat().sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    if (row.some((item) => item !== "")) rows.push(row);
  }
  const [header = [], ...data] = rows;
  return data.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function makeCsv(rows: ReviewRow[]) {
  const header = ["slug", "arquivos", "clube", "liga", "publico", "tipo", "temporada", "uniforme", "campos_revisar"];
  return [header.join(","), ...rows.map((row) => header.map((field) => csvCell(row[field as keyof ReviewRow] ?? "")).join(","))].join("\r\n") + "\r\n";
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicWrite(filePath: string, content: string) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
}

function bestName(group: ProductGroup) {
  return cleanCopiedName(path.parse(group.files[0].name).name);
}

function fallbackProductName(group: ProductGroup) {
  return bestName(group)
    .replace(/(?:^|\s)(?:(?:19|20)\d{2}|\d{2}[_/-]\d{2})(?=\s|$)/g, " ")
    .replace(/\b(goleiro|goleira|keeper|treino|training|pre jogo|pre match|retro|cropped|regata|manga longa|titular|reserva|terceiro|third|home|away)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFor(group: ProductGroup) {
  const club = group.club?.nome ?? (fallbackProductName(group) || "Produto a identificar");
  const uniform = group.uniform === "revisar" ? "" : ` | ${group.uniform[0].toUpperCase()}${group.uniform.slice(1)}`;
  const season = group.season === "revisar" ? "" : ` ${group.season}`;
  const type = group.type === "revisar" ? "" : ` ${group.type}`;
  const audience = group.audience === "revisar" ? "" : ` ${group.audience}`;
  return `Camisa ${club}${uniform}${season}${type}${audience}`.replace(/\s+/g, " ").trim();
}

function priceFor(slug: string) {
  const prices = storeConfig.mockProductPrices;
  const digest = createHash("sha256").update(slug).digest();
  return prices[digest.readUInt32BE(0) % prices.length];
}

function makeProductSlug(group: ProductGroup, used: Set<string>) {
  const relativeDirectory = group.directory.slice(path.join(sourceRoot, group.rootCategory).length);
  const subject = group.club?.slug ?? slugify(bestName(group));
  const season = group.season === "revisar" ? "" : group.season.replace("/", "-");
  const qualifiers = qualifiersFrom(bestName(group)).join("-");
  const base = slugify([slugify(group.rootCategory), slugify(relativeDirectory), subject, season, qualifiers].filter(Boolean).join("-"));
  let slug = base;
  let index = 2;
  while (used.has(slug)) slug = `${base}-${index++}`;
  used.add(slug);
  return slug;
}

function findCorrectedLeague(leagues: LeagueData[], value: string) {
  const normalized = normalize(value);
  return leagues.find((league) => league.slug === value || normalize(league.slug) === normalized || normalize(league.nome) === normalized);
}

function findCorrectedClub(clubs: ClubRef[], value: string, leagueSlug?: string) {
  const normalized = normalize(value);
  const matches = clubs.filter((club) => club.slug === value || normalize(club.slug) === normalized || normalize(club.nome) === normalized);
  const sameLeague = matches.filter((club) => club.league.slug === leagueSlug);
  const options = sameLeague.length ? sameLeague : matches;
  if (options.length > 1) throw new Error(`Clube "${value}" aparece em mais de uma liga; preencha a coluna liga para desambiguar.`);
  return options[0];
}

function applyCorrection(
  product: Product,
  field: ReviewField,
  value: string,
  leagues: LeagueData[],
  clubs: ClubRef[],
) {
  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.toLowerCase() === "revisar") return;
  if (field === "clube") {
    const club = findCorrectedClub(clubs, normalizedValue, product.liga === "revisar" ? undefined : product.liga);
    if (!club) throw new Error(`Clube "${normalizedValue}" não existe em data/leagues.json (produto ${product.slug}).`);
    product.clube = club.nome;
    product.clubeSlug = club.slug;
    if (product.liga === "revisar") product.liga = club.league.slug;
    return;
  }
  if (field === "liga") {
    const league = findCorrectedLeague(leagues, normalizedValue);
    if (!league) throw new Error(`Liga "${normalizedValue}" não existe em data/leagues.json (produto ${product.slug}).`);
    product.liga = league.slug;
    return;
  }
  if (field === "publico") {
    if (!audiences.has(normalizedValue as Audience) || normalizedValue === "revisar") throw new Error(`Público inválido "${normalizedValue}" no produto ${product.slug}.`);
    product.publico = normalizedValue as Audience;
    return;
  }
  if (field === "tipo") {
    if (!productTypes.has(normalizedValue as ProductType) || normalizedValue === "revisar") throw new Error(`Tipo inválido "${normalizedValue}" no produto ${product.slug}.`);
    product.tipo = normalizedValue as ProductType;
    return;
  }
  if (field === "uniforme") {
    if (!uniforms.has(normalizedValue as Uniform) || normalizedValue === "revisar") throw new Error(`Uniforme inválido "${normalizedValue}" no produto ${product.slug}.`);
    product.uniforme = normalizedValue as Uniform;
    return;
  }
  product.temporada = normalizedValue;
}

function fieldValue(product: Product, field: ReviewField) {
  if (field === "clube") return product.clube;
  if (field === "liga") return product.liga;
  if (field === "publico") return product.publico;
  if (field === "tipo") return product.tipo;
  if (field === "temporada") return product.temporada;
  return product.uniforme;
}

function correctedValue(field: ReviewField, value: unknown) {
  return typeof value === "string" ? value : "";
}

async function optimizeImage(image: ValidImage, productSlug: string, position: number, dryRun: boolean) {
  const imageDirectory = path.join(optimizedRoot, productSlug);
  const imageBase = `${String(position + 1).padStart(2, "0")}`;
  const src = `/otimizadas/${productSlug}/${imageBase}-800.webp`;
  let writes = 0;
  if (!dryRun) {
    await mkdir(imageDirectory, { recursive: true });
    for (const width of sizes) {
      const outputPath = path.join(imageDirectory, `${imageBase}-${width}.webp`);
      let current = false;
      try {
        const outputStat = await stat(outputPath);
        current = outputStat.mtimeMs >= image.mtimeMs;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!current) {
        await sharp(image.absolutePath)
          .rotate()
          .resize({ width, withoutEnlargement: true, fit: "inside" })
          .webp({ quality: 82, effort: 5 })
          .toFile(outputPath);
        writes++;
      }
    }
  }
  const blur = dryRun
    ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMxNzE3MTciLz48L3N2Zz4="
    : `data:image/webp;base64,${(await sharp(image.absolutePath).rotate().resize(16, 20, { fit: "cover" }).webp({ quality: 30, effort: 3 }).toBuffer()).toString("base64")}`;
  const productImage: ProductImage = {
    src,
    source: image.relativePublicPath,
    alt: "",
    credit: "Arquivo local fornecido no projeto; confirmar autorização de uso com o fornecedor.",
    focalPoint: { x: 50, y: 50 },
    blurDataURL: blur,
  };
  return { productImage, writes };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1];
  const limit = limitArgument ? Number(limitArgument) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(limit) && limit !== Number.POSITIVE_INFINITY || limit <= 0) {
    throw new Error("--limit deve ser um inteiro maior que zero.");
  }
  const leagues = await readJson<LeagueData[]>(leaguesPath, []);
  const clubs: ClubRef[] = leagues.flatMap((league) => league.clubes.map((club) => ({ ...club, league })));
  const oldProducts = await readJson<Product[]>(productsPath, []);
  const oldBySlug = new Map(oldProducts.map((product) => [product.slug, product]));
  const correctionLedger = await readJson<Record<string, Partial<Record<ReviewField, string>>>>(correctionsPath, {});
  const origins = await readJson<Record<string, { fornecedor?: string; origem?: string; autorizacao?: string; dataRegistro?: string }>>(originsPath, {});
  const oldCsv = await readFile(reviewPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const reviewBySlug = new Map(parseCsv(oldCsv).map((row) => [row.slug, row]));
  const allFiles = await walk(sourceRoot);
  const ignored = { format: 0, small: 0, corrupt: 0 };
  const validImages: ValidImage[] = [];
  const pairCandidates: string[] = [];
  const exactHashes = new Map<string, string>();
  let examined = 0;

  for (const absolutePath of allFiles) {
    const extension = path.extname(absolutePath).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      ignored.format++;
      continue;
    }
    const fileStat = await stat(absolutePath);
    if (fileStat.size < minFileBytes) {
      ignored.small++;
      continue;
    }
    try {
      const metadata = await sharp(absolutePath, { failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height || metadata.width < minWidth || metadata.height < minHeight) {
        ignored.small++;
        continue;
      }
      const relativePath = path.relative(sourceRoot, absolutePath);
      const rootCategory = relativePath.split(path.sep)[0];
      const hash = await new Promise<string>((resolve, reject) => {
        const hasher = createHash("sha256");
        const stream = createReadStream(absolutePath);
        stream.on("data", (chunk) => hasher.update(chunk));
        stream.on("end", () => resolve(hasher.digest("hex")));
        stream.on("error", reject);
      });
      validImages.push({
        absolutePath,
        relativePath,
        relativePublicPath: path.posix.join("catalogo", ...relativePath.split(path.sep)),
        name: path.basename(absolutePath),
        directory: path.dirname(absolutePath),
        rootCategory,
        size: fileStat.size,
        mtimeMs: fileStat.mtimeMs,
        width: metadata.width,
        height: metadata.height,
        hash,
      });
      const exactDuplicate = exactHashes.get(hash);
      if (exactDuplicate) pairCandidates.push(`${exactDuplicate} <> ${relativePath} (bytes idênticos)`);
      else exactHashes.set(hash, relativePath);
    } catch (error) {
      ignored.corrupt++;
      console.error(`Imagem ignorada por erro de leitura: ${relativePathFor(absolutePath)} (${String(error)})`);
    }
    examined++;
    if (examined % 100 === 0) console.log(`Inspecionados: ${examined}/${allFiles.length} arquivos...`);
    if (validImages.length >= limit) break;
  }

  const groups = new Map<string, ProductGroup>();
  const clubsSorted = [...clubs].sort((a, b) => normalize(b.nome).length - normalize(a.nome).length);
  for (const image of validImages) {
    const relativeDirectory = path.relative(sourceRoot, image.directory);
    const cleanName = cleanCopiedName(path.parse(image.name).name);
    const clubOptions = clubCandidates(clubsSorted, cleanName);
    const leagueHint = findLeague(leagues, relativeDirectory, cleanName);
    const club = clubOptions.find((candidate) => candidate.league.slug === leagueHint?.slug) ?? (clubOptions.length === 1 ? clubOptions[0] : undefined);
    const directoryText = normalize(relativeDirectory);
    const hasUnmodeledCompetition = unmodeledCompetitionAliases.some((alias) => includesWords(directoryText, normalize(alias)));
    const league = leagueHint ?? (hasUnmodeledCompetition ? undefined : club?.league);
    const season = seasonFrom(cleanName);
    const qualifiers = qualifiersFrom(cleanName);
    const groupKey = club && season !== "revisar"
      ? `${relativeDirectory}|${club.slug}|${season}|${qualifiers.join("-")}`
      : `${relativeDirectory}|${normalize(cleanName)}`;
    const rootCategory = image.rootCategory;
    const group = groups.get(groupKey) ?? {
      key: groupKey,
      files: [],
      rootCategory,
      directory: image.directory,
      club,
      league,
      audience: audienceFrom(rootCategory),
      type: typeFrom(rootCategory, cleanName),
      season,
      uniform: uniformFrom(cleanName),
    };
    group.files.push(image);
    groups.set(groupKey, group);
  }

  const usedSlugs = new Set<string>();
  const products: Product[] = [];
  const sourceBySlug = new Map<string, ProductGroup>();
  let optimizedCount = 0;
  for (const group of [...groups.values()].sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }))) {
    group.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en", { numeric: true }));
    const slug = makeProductSlug(group, usedSlugs);
    const price = priceFor(slug);
    const sizesForAudience = group.audience === "feminino" ? ["PP", "P", "M", "G", "GG", "2GG"] : ["P", "M", "G", "GG", "2GG", "3GG"];
    const product: Product = {
      id: `catalog-${slug}`,
      slug,
      clube: group.club?.nome ?? "revisar",
      clubeSlug: group.club?.slug ?? "revisar",
      liga: group.league?.slug ?? "revisar",
      publico: group.audience,
      tipo: group.type,
      temporada: group.season,
      uniforme: group.uniform,
      nome: titleFor(group),
      preco: price,
      precoAnterior: Math.round(price * 1.35 * 10) / 10,
      estoque: 5 + Number.parseInt(createHash("sha1").update(slug).digest("hex").slice(0, 2), 16) % 16,
      tamanhos: sizesForAudience,
      esgotados: [],
      cor: "revisar",
      tag: ["Oferta", "Mais vendido", "Lançamento"][Number.parseInt(createHash("sha1").update(`${slug}-tag`).digest("hex").slice(0, 2), 16) % 3],
      imageSeed: slug,
      images: [],
    };

    const previousProduct = oldBySlug.get(slug);
    const previousFocalPoints = new Map((previousProduct?.images ?? []).map((image) => [image.source, image.focalPoint]));
    const outputImages: ProductImage[] = [];
    for (const [index, sourceImage] of group.files.entries()) {
      const { productImage, writes } = await optimizeImage(sourceImage, slug, index, dryRun);
      const origin = origins[group.rootCategory];
      productImage.credit = origin?.fornecedor && origin.origem && origin.autorizacao
        ? `Fornecedor: ${origin.fornecedor}; origem: ${origin.origem}; autorização: ${origin.autorizacao}${origin.dataRegistro ? `; registrada em ${origin.dataRegistro}` : ""}.`
        : `Origem/autorização do lote ainda não registrada; arquivo local: public/${sourceImage.relativePublicPath}.`;
      const focalPoint = previousFocalPoints.get(productImage.source);
      if (focalPoint && Number.isFinite(focalPoint.x) && Number.isFinite(focalPoint.y)) {
        productImage.focalPoint = { x: Math.max(0, Math.min(100, focalPoint.x)), y: Math.max(0, Math.min(100, focalPoint.y)) };
      }
      productImage.alt = `${product.nome} — foto ${index + 1}`;
      outputImages.push(productImage);
      optimizedCount += writes;
    }
    product.images = outputImages;

    const savedCorrections = correctionLedger[slug] ?? {};
    for (const field of ["liga", "clube", "publico", "tipo", "temporada", "uniforme"] as ReviewField[]) {
      const savedValue = correctedValue(field, savedCorrections[field]);
      if (savedValue && savedValue !== "revisar") applyCorrection(product, field, savedValue, leagues, clubsSorted);
    }
    const csvRow = reviewBySlug.get(slug);
    if (csvRow) {
      for (const field of ["liga", "clube", "publico", "tipo", "temporada", "uniforme"] as ReviewField[]) {
        const value = correctedValue(field, csvRow[field]);
        if (!value) continue;
        const oldValue = oldBySlug.get(slug) ? fieldValue(oldBySlug.get(slug)!, field) : undefined;
        const changedByUser = oldValue === undefined
          ? value !== "revisar"
          : normalize(String(oldValue)) !== normalize(value);
        if (value === "revisar") {
          if (changedByUser && correctionLedger[slug]) {
            delete correctionLedger[slug][field];
            if (Object.keys(correctionLedger[slug]).length === 0) delete correctionLedger[slug];
          }
          continue;
        }
        if (changedByUser) {
          const probe: Product = { ...product, images: product.images };
          applyCorrection(probe, field, value, leagues, clubsSorted);
          const normalizedCorrection = fieldValue(probe, field);
          correctionLedger[slug] = { ...correctionLedger[slug], [field]: normalizedCorrection };
        }
        const savedValue = correctionLedger[slug]?.[field];
        if (savedValue) applyCorrection(product, field, savedValue, leagues, clubsSorted);
      }
    }
    product.nome = titleFor({
      ...group,
      club: clubsSorted.find((item) => item.slug === product.clubeSlug && item.league.slug === product.liga) ?? group.club,
      league: leagues.find((item) => item.slug === product.liga) ?? group.league,
      audience: product.publico,
      type: product.tipo,
      season: product.temporada,
      uniform: product.uniforme,
    });
    for (const [index, image] of product.images.entries()) image.alt = `${product.nome} — foto ${index + 1}`;
    products.push(product);
    sourceBySlug.set(slug, group);
  }

  const reviewRows: ReviewRow[] = [];
  for (const product of products) {
    const pending = reviewFields.filter((field) => fieldValue(product, field) === "revisar");
    if (pending.length === 0) continue;
    const group = sourceBySlug.get(product.slug)!;
    const row = {
      slug: product.slug,
      arquivos: group.files.map((file) => file.relativePublicPath).join(" | "),
      clube: product.clube,
      liga: product.liga,
      publico: product.publico,
      tipo: product.tipo,
      temporada: product.temporada,
      uniforme: product.uniforme,
      campos_revisar: pending.join("|"),
    };
    reviewRows.push(row);
  }

  const chooseImage = (predicate: (product: Product, group: ProductGroup) => boolean) => {
    const entry = products.find((product) => {
      const group = sourceBySlug.get(product.slug);
      return !!group && product.images?.length && predicate(product, group);
    });
    return entry?.images?.[0];
  };
  const themeImages: Record<string, Omit<ImageAssetLike, "source">> = {};
  const registerTheme = (slot: string, image: ProductImage | undefined) => {
    if (!image) return;
    themeImages[slot] = {
      src: image.src,
      alt: image.alt,
      credit: image.credit,
      focalPoint: image.focalPoint,
      blurDataURL: image.blurDataURL,
    };
  };
  registerTheme("home.hero", chooseImage((_product, group) => normalize(group.rootCategory).includes("camisa jogador")));
  registerTheme("categories.male", chooseImage((_product, group) => normalize(group.rootCategory).includes("camisa jogador")));
  registerTheme("categories.female", chooseImage((_product, group) => normalize(group.rootCategory).includes("femininas")));
  registerTheme("categories.leagues", chooseImage((product) => product.liga === "brasileirao-serie-a"));
  registerTheme("retro.cover", chooseImage((_product, group) => normalize(group.rootCategory).includes("retro")));
  registerTheme("product.primary", chooseImage(() => true));
  const alternateProduct = products.find((product) => sourceBySlug.get(product.slug)?.files.length && (product.images?.length ?? 0) > 1);
  registerTheme("product.alternate", alternateProduct?.images?.[1]);
  const themedLeagueSlots = new Set<string>();
  for (const league of leagues) {
    if (themedLeagueSlots.has(league.imagemCapa)) continue;
    const slot = `league.${league.imagemCapa}`;
    if (themeImages[slot]) continue;
    const leagueClubs = new Set(league.clubes.map((club) => club.slug));
    const directImage = chooseImage((product) => product.liga === league.slug);
    const clubImage = directImage ?? chooseImage((product) =>
      product.clubeSlug !== "revisar" && leagueClubs.has(product.clubeSlug),
    );
    registerTheme(slot, clubImage);
    if (themeImages[slot]) themedLeagueSlots.add(league.imagemCapa);
  }

  if (!dryRun) {
    await atomicWrite(productsPath, `${JSON.stringify(products, null, 2)}\n`);
    await atomicWrite(reviewPath, makeCsv(reviewRows));
    await atomicWrite(correctionsPath, `${JSON.stringify(correctionLedger, null, 2)}\n`);
    await atomicWrite(themePath, `${JSON.stringify(themeImages, null, 2)}\n`);
  }

  const noLeague = products.filter((product) => product.liga === "revisar").length;
  const noClub = products.filter((product) => product.clubeSlug === "revisar").length;
  const missingThemes = [
    "home.hero", "categories.male", "categories.female", "categories.leagues", "retro.cover",
    ...leagues.map((league) => `league.${league.imagemCapa}`),
  ].filter((slot, index, values) => !themeImages[slot] && values.indexOf(slot) === index);

  console.log("\nRelatório de catalogação");
  console.log(`Produtos agrupados: ${products.length}`);
  console.log(`Imagens válidas/processadas: ${validImages.length} (${dryRun ? "prévia; otimizações não gravadas" : `${optimizedCount} variantes criadas ou atualizadas; 3 tamanhos por imagem`})`);
  console.log(`Produtos sem liga identificada: ${noLeague}`);
  console.log(`Produtos sem clube identificado: ${noClub}`);
  console.log(`Produtos com dados para revisar: ${reviewRows.length}`);
  console.log(`Ignorados — formato inválido: ${ignored.format}; pequenos (<${minWidth}×${minHeight}px ou <${minFileBytes} bytes): ${ignored.small}; corrompidos: ${ignored.corrupt}`);
  console.log(`Pares de duplicatas prováveis (SHA-256 idêntico): ${pairCandidates.length}`);
  for (const pair of pairCandidates.slice(0, 10)) console.log(`  possível duplicata: ${pair}`);
  console.log(`Slots temáticos preenchidos: ${Object.keys(themeImages).join(", ") || "nenhum"}`);
  console.log(`Slots com placeholder: ${missingThemes.join(", ") || "nenhum"}`);
  console.log("Fotos de ação/estádio não aparecem nos grupos do catálogo; os banners usam as melhores fotos locais de camisas disponíveis.");
  if (dryRun) console.log("Prévia concluída; nenhum arquivo foi escrito. Use npm run catalogar para gerar o catálogo e as versões WebP.");
  else console.log(`Gravados: ${path.relative(projectRoot, productsPath)}, ${path.relative(projectRoot, reviewPath)}, ${path.relative(projectRoot, themePath)} e ${path.relative(projectRoot, optimizedRoot)}.`);
}

type ImageAssetLike = {
  src: string;
  alt: string;
  credit: string;
  focalPoint: { x: number; y: number };
  blurDataURL: string;
};

function relativePathFor(absolutePath: string) {
  return path.relative(projectRoot, absolutePath);
}

main().catch((error: unknown) => {
  console.error("Falha na catalogação:", error);
  process.exitCode = 1;
});
