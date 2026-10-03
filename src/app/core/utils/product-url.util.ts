export function productSlug(productName: string): string {
  return productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function productPath(productName: string): string {
  const slug = productSlug(productName);
  return slug ? `/productos/${slug}` : '/buscar';
}
