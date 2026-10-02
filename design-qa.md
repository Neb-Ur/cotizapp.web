# Design QA — Home de búsqueda CotizApp

Source visual truth: `/Users/rabenavidess/.codex/generated_images/01a0fda8-75ce-7d71-970c-8351c7f766cc/exec-ed702a12-6c82-46bf-96f2-3831950abf53.png`

Implementation screenshot: `/tmp/cotizapp-final-yvNF4K/home-1440.png`

Combined comparison evidence: `/tmp/cotizapp-final-yvNF4K/comparison.png`

Viewport and normalization:

- Source: 1487 × 1058 px, normalized to 1440 × 1024 px for comparison.
- Implementation: 1440 × 1024 px, Chrome headless, CSS viewport 1440 × 1024, device scale factor 1.
- State: public home route `/`, desktop, catalog loaded, no menu or autocomplete overlay open.

## Full-view comparison evidence

The normalized side-by-side comparison confirms the same primary composition: compact white navigation, full-width photographic hero, left-aligned search narrative, six category shortcuts at the bottom of the hero, and a four-column product area immediately afterward. The implementation preserves CotizApp's real header, taxonomy, routes, catalog data, and existing design tokens.

The hero's height, fold position, search prominence, category density, product-section heading, and four-card rhythm now match the selected direction closely. Product subjects differ because the implementation deliberately renders the live catalog rather than mock products from the generated concept.

## Focused region comparison evidence

- Hero: checked headline wrapping, search-field width, photographic crop, dark text-safe area, category alignment, and hero-to-catalog transition.
- Product region: checked four equal columns, white product photography surfaces, brand/type hierarchy, orange from-price, seller count, and arrow affordance.
- Header: checked flat full-width surface, navigation spacing, authentication actions, and alignment with the 1320 px content grid.
- No additional focused crop was necessary because all critical details remain legible in the 1440 px full-view comparison.

## Findings

- P3 — Live catalog imagery and names do not reproduce the four mock products exactly. This is intentional: the home must represent current Firebase catalog data rather than static demo merchandise.
- P3 — The existing brand lockup includes the small “Cotizaciones de obra” descriptor, while the selected mock shows only the product name. Retaining the established brand component avoids creating a homepage-only logo variant.

## Required fidelity surfaces

- Fonts and typography: Space Grotesk/Manrope hierarchy is preserved; heading scale, optical weight, line height, and orange emphasis align with the reference. Body and UI labels remain readable at product sizes.
- Spacing and layout rhythm: 1320 px content grid, full-width hero, 74 px navigation, six-column category rail, and four-column product grid match the reference's density and fold.
- Colors and visual tokens: uses CotizApp ink, orange, emerald, sand, border, radius, and focus tokens; no parallel visual system was introduced.
- Image quality and asset fidelity: a dedicated 1891 × 831 generated hero photograph is used at full resolution with a controlled responsive crop. Product images come from the real catalog. No CSS drawings, placeholder shapes, or screenshot crops replace visible assets.
- Copy and content: hero and product-section copy match the selected direction while avoiding unsupported claims such as “main hardware stores.” Taxonomy labels and prices remain data-backed.

## Interaction checks

- Search form accepts free text and navigates to `/buscar?q=...`.
- Autocomplete continues to open from two characters and selected products navigate to `/producto`.
- Category shortcuts navigate with the real taxonomy category ID.
- Product cards navigate to their product-detail query.
- `/buscar?q=Cemento` renders successfully through SSR.
- `npm run build` passes; only pre-existing stylesheet-budget warnings remain in unrelated dashboards.

## Comparison history

1. Initial implementation kept the prior contained hero, centered copy, abstract background, and carousel. These were P1 mismatches against the selected full-width photographic direction.
2. Added a dedicated hero photograph, moved the composition to a full-width left-aligned layout, flattened the public navigation, and aligned categories with the bottom of the hero.
3. First browser capture showed the hero approximately 45 px too tall and the header still visually detached. Reduced top rhythm and changed the navigation to a flat 74 px bar.
4. Second capture showed the carousel exposing fewer than four complete products, a P1 information-density mismatch. Replaced it with a deterministic responsive four-column product grid.
5. Final combined comparison shows no remaining actionable P0, P1, or P2 issues.

## Follow-up polish

- P3 optional: curate the catalog order editorially once a merchandising rule exists, so the first four products represent more varied categories.

## Final result

final result: passed
