const fs = require('fs');
const path = require('path');
const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  console.log('=== CONSULTANDO STORE_ORDERS (SOMENTE LEITURA GET - SEM DADOS PESSOAIS) ===');
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
  };

  const fields = 'id,status,operational_status,total_cents,created_at,tracking_code,mercado_pago_status,mercado_pago_id';
  const res = await safeFetch(`${config.url}/rest/v1/store_orders?select=${fields}&order=created_at.desc`, { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao consultar store_orders: HTTP ${res.status} - ${errText}`);
  }
  const orders = await res.json();
  console.log(`Total de pedidos encontrados em store_orders: ${orders.length}`);

  // Contagem por status
  const porStatus = {};
  for (const o of orders) {
    const s = o.status || 'sem_status';
    porStatus[s] = (porStatus[s] || 0) + 1;
  }
  console.log('\nContagem por Status:', porStatus);

  // Contagem por operational_status
  const porStatusOperacional = {};
  for (const o of orders) {
    const os = o.operational_status || 'sem_status_operacional';
    porStatusOperacional[os] = (porStatusOperacional[os] || 0) + 1;
  }
  console.log('\nContagem por Status Operacional:', porStatusOperacional);

  // Contagem por mercado_pago_status
  const porMpStatus = {};
  for (const o of orders) {
    const mps = o.mercado_pago_status || 'sem_status_mp';
    porMpStatus[mps] = (porMpStatus[mps] || 0) + 1;
  }
  console.log('\nContagem por Status Mercado Pago:', porMpStatus);

  // Pedidos pagos
  const pagos = orders.filter(o => o.status === 'pago' || o.status === 'aprovado' || o.operational_status === 'pago' || o.mercado_pago_status === 'approved');
  console.log(`\nTotal de pedidos pagos / aprovados: ${pagos.length}`);

  // Quantos pagos sem código de rastreio
  const pagosSemRastreio = pagos.filter(o => !o.tracking_code || !String(o.tracking_code).trim());
  console.log(`Pedidos pagos SEM código de rastreio: ${pagosSemRastreio.length}`);

  // Pedidos mais antigos em "aguardando_pagamento"
  const aguardando = orders.filter(o => o.status === 'aguardando_pagamento' || o.status === 'pending');
  aguardando.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  console.log(`\nTotal de pedidos em aguardando_pagamento: ${aguardando.length}`);
  if (aguardando.length > 0) {
    console.log(`Mais antigo em aguardando_pagamento: criado em ${aguardando[0].created_at} (ID: ${aguardando[0].id}, Valor: R$ ${(aguardando[0].total_cents/100).toFixed(2)})`);
  }

  // Pedidos de teste (por id, valor e status - SEM dados pessoais)
  const pedidosTeste = orders.filter(o => o.total_cents <= 500);
  console.log(`\nPedidos de baixo valor / teste identificados (${pedidosTeste.length}):`);
  console.table(pedidosTeste.map(o => ({
    id: o.id,
    valor: `R$ ${(o.total_cents / 100).toFixed(2)}`,
    status: o.status,
    operational_status: o.operational_status,
    mp_status: o.mercado_pago_status,
    mp_id: o.mercado_pago_id,
    created_at: o.created_at,
  })));

  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'orders_summary.json'), JSON.stringify({
    total: orders.length,
    porStatus,
    porStatusOperacional,
    porMpStatus,
    pagosCount: pagos.length,
    pagosSemRastreioCount: pagosSemRastreio.length,
    aguardandoCount: aguardando.length,
    maisAntigoAguardando: aguardando[0] ? {
      id: aguardando[0].id,
      created_at: aguardando[0].created_at,
      valor: `R$ ${(aguardando[0].total_cents / 100).toFixed(2)}`,
    } : null,
    pedidosTeste: pedidosTeste.map(o => ({
      id: o.id,
      valor: `R$ ${(o.total_cents / 100).toFixed(2)}`,
      status: o.status,
      operational_status: o.operational_status,
      mp_status: o.mercado_pago_status,
      mp_id: o.mercado_pago_id,
      created_at: o.created_at,
    })),
  }, null, 2));
}

main().catch(console.error);
