async function testProd() {
  const url = 'https://www.importsalves.com.br/produto/kits-infantis-selecoes-asia-japao-26-27';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML length:', html.length);

  // Look for gallery images or next/image
  const imgTags = [...html.matchAll(/<img[^>]+>/gi)].map(m => m[0]);
  console.log('Total img tags:', imgTags.length);
  imgTags.forEach(tag => {
    if (tag.includes('/otimizadas/') || tag.includes('japao') || tag.includes('kits-infantis')) {
      console.log('Img tag:', tag);
    }
  });

  // Check if thumbnails/buttons exist
  const buttons = [...html.matchAll(/<button[^>]*aria-label[^>]*>/gi)].map(m => m[0]);
  console.log('Buttons:', buttons);
}

testProd().catch(console.error);

