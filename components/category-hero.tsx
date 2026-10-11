import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ImageAsset } from "@/data/images";

export function CategoryHero({
  image,
  eyebrow,
  title,
  description,
  breadcrumbs,
  quickLinks = [],
}: {
  image: ImageAsset;
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbs: { name: string; href?: string }[];
  quickLinks?: { name: string; href: string }[];
}) {
  return (
    <section className="category-hero relative isolate min-h-[350px] overflow-hidden bg-ink text-white sm:min-h-[420px]">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={image.blurDataURL}
        className="category-hero-image -z-20 object-cover"
        style={{ objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%` }}
      />
      <div className="category-hero-overlay absolute inset-0 -z-10" />
      <div className="mx-auto flex min-h-[350px] max-w-7xl flex-col justify-end px-5 pb-12 pt-20 sm:min-h-[420px] sm:pb-14 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/70">
          <Link href="/" className="hover:text-white">Início</Link>
          {breadcrumbs.map((item) => (
            <span key={item.name} className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              {item.href ? <Link href={item.href} className="hover:text-white">{item.name}</Link> : <span aria-current="page">{item.name}</span>}
            </span>
          ))}
        </nav>
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-blue-200">{eyebrow}</p>
        <h1 className="mt-2 max-w-5xl text-5xl font-black uppercase leading-[.9] tracking-tight sm:text-7xl lg:text-8xl">{title}</h1>
        <div className="mt-4 flex max-w-3xl items-end justify-between gap-4">
          <p className="max-w-xl text-sm leading-6 text-white/75 sm:text-base">{description}</p>
          <span className="hidden shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white sm:inline-flex">Vista a arquibancada <ArrowRight size={15} className="text-action" /></span>
        </div>
        {quickLinks.length > 0 && <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Clubes em destaque">{quickLinks.map((club) => <Link key={club.href} href={club.href} className="shrink-0 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-[10px] font-bold text-white transition hover:border-action hover:bg-action">{club.name}</Link>)}</div>}
      </div>
    </section>
  );
}
