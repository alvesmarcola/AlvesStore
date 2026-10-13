import { ImageResponse } from "next/og";

export const alt = "Alves Store — Vista a paixão. Jogue junto.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 88, color: "white", background: "linear-gradient(145deg, #121619 0%, #17334c 70%, #2563eb 100%)" }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#b7ed58", letterSpacing: 8 }}>ALVES STORE</div>
      <div style={{ marginTop: 32, fontSize: 76, fontWeight: 800 }}>Vista a paixão.</div>
      <div style={{ fontSize: 76, fontWeight: 800 }}>Jogue junto.</div>
      <div style={{ marginTop: 34, fontSize: 30, color: "#e5e7eb" }}>Camisas para vestir a sua torcida.</div>
    </div>, size,
  );
}
