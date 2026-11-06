async function checkHome() {
  const res = await fetch('https://www.importsalves.com.br');
  const html = await res.text();
  console.log('Homepage length:', html.length);

  // Find all links to /f1 or containing F1
  const aTags = [...html.matchAll(/<a[^>]+>([\s\S]*?)<\/a>/gi)];
  console.log('Total a tags:', aTags.length);
  for (const a of aTags) {
    const fullTag = a[0];
    if (fullTag.includes('/f1') || fullTag.toLowerCase().includes('f1') || fullTag.toLowerCase().includes('fórmula 1')) {
      console.log('\n--- Link F1 ---');
      console.log(fullTag.slice(0, 400));
    }
  }

  // Find all images on home
  const imgTags = [...html.matchAll(/<img[^>]+>/gi)].map(m => m[0]);
  console.log('\nTotal img tags:', imgTags.length);
  for (const img of imgTags) {
    if (img.includes('f1') || img.toLowerCase().includes('formula')) {
      console.log('F1 img tag:', img);
    }
  }
}

checkHome().catch(console.error);

