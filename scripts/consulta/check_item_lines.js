const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
  };

  const res = await safeFetch(`${config.url}/rest/v1/store_orders?select=id,item_lines`, { headers });
  const orders = await res.json();
  console.log(`Total de pedidos: ${orders.length}`);
  let validArrays = 0;
  let nonArrays = 0;
  for (const o of orders) {
    if (Array.isArray(o.item_lines)) {
      validArrays++;
    } else {
      nonArrays++;
      console.log(`Pedido ${o.id} possui item_lines inválido:`, typeof o.item_lines, o.item_lines);
    }
  }
  console.log(`item_lines é array válido: ${validArrays}/${orders.length}`);
}

main().catch(console.error);

