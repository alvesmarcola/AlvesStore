export function flyThumbnailToCart(source: HTMLImageElement | null) {
  if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cart = document.querySelector<HTMLElement>('button[aria-label^="Carrinho com"]');
  if (!cart) return;

  const from = source.getBoundingClientRect();
  const to = cart.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return;

  const thumbnail = document.createElement("img");
  thumbnail.src = source.currentSrc || source.src;
  thumbnail.alt = "";
  thumbnail.setAttribute("aria-hidden", "true");
  Object.assign(thumbnail.style, {
    position: "fixed",
    zIndex: "100",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    objectFit: "cover",
    borderRadius: "8px",
    pointerEvents: "none",
  });
  document.body.appendChild(thumbnail);
  const deltaX = to.left + to.width / 2 - (from.left + from.width / 2);
  const deltaY = to.top + to.height / 2 - (from.top + from.height / 2);
  const animation = thumbnail.animate(
    [
      { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      { transform: `translate3d(${deltaX * 0.75}px, ${deltaY * 0.75}px, 0) scale(.18)`, opacity: 0.2 },
    ],
    { duration: 560, easing: "cubic-bezier(.2,.7,.25,1)" },
  );
  animation.onfinish = () => thumbnail.remove();
  animation.oncancel = () => thumbnail.remove();
}
