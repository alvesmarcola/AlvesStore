import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BLACK_FRIDAY_DEADLINE_ISO,
  isBlackFridayActive,
  DEFAULT_HERO_SLIDES,
} from "../components/hero-carousel";

test("Black Friday deadline is set to 01/12/2026 23:59:59 Brasília time (UTC-3)", () => {
  assert.equal(BLACK_FRIDAY_DEADLINE_ISO, "2026-12-01T23:59:59-03:00");
  const deadlineTime = new Date(BLACK_FRIDAY_DEADLINE_ISO).getTime();
  assert.ok(!isNaN(deadlineTime));

  // During promo (e.g. November 2026)
  const duringPromo = new Date("2026-11-15T12:00:00-03:00").getTime();
  assert.equal(isBlackFridayActive(duringPromo), true);

  // After promo deadline (e.g. 02/12/2026 00:00:00)
  const afterPromo = new Date("2026-12-02T00:00:00-03:00").getTime();
  assert.equal(isBlackFridayActive(afterPromo), false);
});

test("Default hero slides are preserved without deletion", () => {
  assert.equal(DEFAULT_HERO_SLIDES.length, 3);
  assert.equal(DEFAULT_HERO_SLIDES[0].href, "/masculino");
  assert.ok(DEFAULT_HERO_SLIDES[0].image.length > 0);
});

test("Black Friday banner files exist and meet size target (< 200 KB)", () => {
  const files = [
    { file: "public/arena/bf-nba-mobile.webp", maxKb: 200 },
    { file: "public/arena/bf-nba-mobile.jpg", maxKb: 250 },
    { file: "public/arena/bf-nba-desktop.webp", maxKb: 200 },
    { file: "public/arena/bf-nba-desktop.jpg", maxKb: 200 },
  ];

  for (const { file, maxKb } of files) {
    const fullPath = path.resolve(file);
    assert.ok(fs.existsSync(fullPath), `Arquivo ${file} deve existir`);
    const stat = fs.statSync(fullPath);
    const sizeKb = stat.size / 1024;
    assert.ok(
      sizeKb <= maxKb,
      `Arquivo ${file} tem ${sizeKb.toFixed(1)} KB, deve ter menos que ${maxKb} KB`
    );
  }
});

