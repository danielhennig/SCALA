export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Hospital São José — UTI" → "hospital-sao-jose-uti"; "3º Batalhão" → "3o-batalhao" */
export function slugify(input: string): string {
  return (
    input
      // NFKD (not NFD) also turns ordinals like º/ª into o/a.
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/, "")
  );
}
