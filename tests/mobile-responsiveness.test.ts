import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Auditoria e Garantia de Responsividade Mobile", async (t) => {
  await t.test("1. app/layout.tsx exporta viewport correto para dispositivos móveis", () => {
    const layoutContent = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf-8");
    assert.match(layoutContent, /export const viewport:\s*Viewport/, "Deve exportar viewport explicitamente");
    assert.match(layoutContent, /width:\s*"device-width"/, "Deve definir width device-width");
    assert.match(layoutContent, /initialScale:\s*1/, "Deve definir initialScale 1");
    assert.match(layoutContent, /maximumScale:\s*5/, "Deve manter zoom manual acessível até 5");
  });

  await t.test("2. app/globals.css previne overflow horizontal e auto-zoom do iOS Safari", () => {
    const cssContent = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf-8");
    assert.match(cssContent, /overflow-x:\s*clip;/, "Deve ter overflow-x clip no html e body");
    assert.match(cssContent, /\.form-input\s*\{[^}]*font-size:\s*16px;/, "form-input deve ter 16px por padrão (mobile)");
    assert.match(cssContent, /\.form-input\s*\{[^}]*min-height:\s*44px;/, "form-input deve ter 44px min-height por padrão (mobile)");
    assert.match(cssContent, /@media\s*\(max-width:\s*767px\)[\s\S]*?input:not\(\[type="checkbox"\]\)[\s\S]*?font-size:\s*16px\s*!important;/, "Deve forçar font-size 16px em inputs em telas <= 767px para evitar auto-zoom do iOS");
  });

  await t.test("3. app/produto/[slug]/product-details.tsx personalização responsiva e área de toque", () => {
    const pdContent = fs.readFileSync(path.join(process.cwd(), "app/produto/[slug]/product-details.tsx"), "utf-8");
    assert.match(pdContent, /grid grid-cols-1 sm:grid-cols-2 gap-3/, "Campos de personalização devem empilhar em mobile (grid-cols-1 sm:grid-cols-2)");
    assert.match(pdContent, /min-h-\[44px\][^"]*text-base sm:text-sm uppercase/, "Input de nome deve ter min-h-[44px] e text-base sm:text-sm");
    assert.match(pdContent, /min-h-\[44px\][^"]*text-base sm:text-sm shadow-sm/, "Input de número deve ter min-h-[44px] e text-base sm:text-sm");
    assert.match(pdContent, /flex min-h-\[44px\] cursor-pointer items-center gap-2\.5/, "Checkbox de personalização deve ter min-h-[44px] para toque fácil");
    assert.match(pdContent, /pb-\[calc\(env\(safe-area-inset-bottom,0px\)\+0\.75rem\)\]/, "Barra fixa mobile deve respeitar safe-area-inset-bottom do iPhone");
  });

  await t.test("4. components/site-header.tsx busca mobile com altura e tipografia adequadas", () => {
    const headerContent = fs.readFileSync(path.join(process.cwd(), "components/site-header.tsx"), "utf-8");
    assert.match(headerContent, /min-h-\[44px\][^"]*text-base md:text-sm text-white outline-none/, "Busca mobile deve ter 16px no mobile e min-h-[44px]");
    assert.match(headerContent, /min-h-\[44px\] items-center justify-center px-2\.5/, "Botão de busca mobile deve ter área de toque min-h-[44px]");
  });

  await t.test("5. components/cart-drawer.tsx e app/carrinho/page.tsx controles de quantidade ergonômicos", () => {
    const drawerContent = fs.readFileSync(path.join(process.cwd(), "components/cart-drawer.tsx"), "utf-8");
    const cartPageContent = fs.readFileSync(path.join(process.cwd(), "app/carrinho/page.tsx"), "utf-8");
    assert.match(drawerContent, /h-8 w-8 place-items-center/, "Botões de quantidade na gaveta devem ter tamanho confortável (h-8 w-8)");
    assert.match(cartPageContent, /h-8 w-8 place-items-center/, "Botões de quantidade na página do carrinho devem ter tamanho confortável (h-8 w-8)");
  });

  await t.test("6. app/page.tsx banner NBA responsivo para telas estreitas (320px)", () => {
    const homeContent = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf-8");
    assert.match(homeContent, /grid-cols-1 sm:grid-cols-\[minmax\(0,1\.05fr\)_minmax\(0,0\.95fr\)\]/, "Banner NBA deve empilhar em telas estreitas para não espremer textos/botões");
  });
});
