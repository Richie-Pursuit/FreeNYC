import Image from "next/image";
import BrandStarSymbol from "@/components/BrandStarSymbol";
import {
  getNavbarLogoColors,
  normalizeNavbarBrandSettings,
} from "@/lib/siteBrand";

export default function BrandLogoMark({
  settings = {},
  className = "h-9 w-10",
  decorative = true,
  title = "Brand logo",
}) {
  const normalized = normalizeNavbarBrandSettings(settings);
  const logoColors = getNavbarLogoColors(normalized.logoColor);
  const useCustomLogo =
    normalized.logoMode === "custom" && Boolean(normalized.customLogoDataUrl);

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {useCustomLogo ? (
        <Image
          src={normalized.customLogoDataUrl}
          alt={decorative ? "" : title}
          aria-hidden={decorative}
          fill
          unoptimized
          sizes="96px"
          className="object-contain"
          draggable={false}
        />
      ) : (
        <BrandStarSymbol
          className="max-h-full w-auto max-w-full"
          decorative={decorative}
          title={title}
          fill={logoColors.fill}
          split={logoColors.split}
          stroke={logoColors.stroke}
        />
      )}
    </span>
  );
}
