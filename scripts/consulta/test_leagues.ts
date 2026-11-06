import { deriveCatalogLeagues } from '../../lib/catalog-taxonomy';
import fs from 'fs';
import path from 'path';

const prods = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));
const f1Prods = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/f1-products.json'), 'utf8'));
const leagues = deriveCatalogLeagues([...prods, ...f1Prods]);

console.log('Total leagues:', leagues.length);
leagues.forEach(l => {
  console.log(l.slug.padEnd(20), '|', l.nome.padEnd(25), '|', l.coverImage);
});

