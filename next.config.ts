import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: { remotePatterns: [
    { protocol: "https", hostname: "**.supabase.co" },
    { protocol: "https", hostname: "photo.yupoo.com", pathname: "/**" },
    { protocol: "https", hostname: "images.yupoo.com", pathname: "/**" },
    { protocol: "https", hostname: "**.yupoo.com" },
  ] },
  async redirects() {
    return [{ source: "/login", destination: "/", permanent: true }];
  },
  async headers() {
    const scriptSources = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: `default-src 'self'; script-src ${scriptSources} https://sdk.mercadopago.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.mercadopago.com https://api.resend.com https://viacep.com.br; frame-src https://www.mercadopago.com.br https://sandbox.mercadopago.com.br; form-action 'self' https://www.mercadopago.com.br https://sandbox.mercadopago.com.br; base-uri 'self'; object-src 'none'; frame-ancestors 'self'` },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ] }];
  },
};

export default nextConfig;
