import Image from "next/image";
import { clsx } from "clsx";
import { editorialImage } from "@/lib/marketing/media";

type PhotoProps = {
  slug: string;
  alt: string;
  caption?: string;
  sizes: string;
  className?: string;
  frameClassName?: string;
  captionClassName?: string;
  priority?: boolean;
  tone?: "light" | "dark";
  creditLabel?: string;
};

export function Photo({
  slug,
  alt,
  caption,
  sizes,
  className,
  frameClassName,
  captionClassName,
  priority,
  tone = "light",
  creditLabel = "Photo",
}: PhotoProps) {
  const image = editorialImage(slug);
  return (
    <figure className={clsx("cx-figure", className)}>
      <div className={clsx("relative overflow-hidden bg-[var(--cx-mist)]", frameClassName)}>
        <Image
          src={image.file}
          alt={alt}
          width={image.width}
          height={image.height}
          sizes={sizes}
          priority={priority}
          data-reveal="image"
        />
      </div>
      <figcaption className={clsx("cx-caption mt-3", tone === "dark" && "!text-white/60", captionClassName)}>
        {caption ? `${caption} ` : null}
        {creditLabel}: {image.author},{" "}
        <a href={image.source} target="_blank" rel="noreferrer">
          {image.licence}
        </a>
        .
      </figcaption>
    </figure>
  );
}
