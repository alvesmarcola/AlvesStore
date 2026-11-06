const fs = require('fs');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serv = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY presente?', Boolean(anon), anon ? `(comprimento: ${anon.length}, começa com: ${anon.slice(0, 5)}...)` : '');
console.log('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY presente?', Boolean(pub), pub ? `(comprimento: ${pub.length}, começa com: ${pub.slice(0, 5)}...)` : '');
console.log('SUPABASE_SERVICE_ROLE_KEY presente?', Boolean(serv), serv ? `(comprimento: ${serv.length}, começa com: ${serv.slice(0, 5)}...)` : '');

