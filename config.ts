import { SITE_NAME } from "@/lib/site";

export const storeConfig = {
  name: SITE_NAME,
  fanCommonPrice: 170,
  nbaTankTopPrice: 230,
  kidsPrice: 180,
  fanFullPatchPrice: 180,
  retroShortSleevePrice: 185,
  retroLongSleevePrice: 220,
  playerShortSleevePrice: 190,
  playerLongSleevePrice: 220,
  twoShirtPrice: 300,
  threeShirtPrice: 450,
  freeShippingQuantity: 3,
  shippingPrice: 20,
  customizationPrice: 39.9,
  patchPrice: 10,
  size2GGPrice: 10,
  email: "atendimento@importsalves.com.br",
} as const;
