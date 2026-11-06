const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
  };

  const res = await safeFetch(`${config.url}/rest/v1/?apikey=${config.serviceKey}`, { headers });
  const spec = await res.json();
  const rpc = spec.paths['/rpc/apply_store_payment'];
  const schemaRef = rpc?.post?.responses?.['200']?.schema;
  console.log('Schema ref:', schemaRef);
  if (schemaRef?.items?.$ref) {
    const defName = schemaRef.items.$ref.replace('#/definitions/', '');
    console.log('Definition name:', defName);
    console.log('Fields:', Object.keys(spec.definitions[defName]?.properties || {}));
  }
}

main().catch(console.error);

