# @school/brand

Munaxa School's brand lockups: the `Logo` image component and the text `Wordmark`.

These used to exist as byte-identical copies in `apps/admin` and `munaxademo`. They live here
now so there is exactly one definition.

## Why this is not in the platform

`@munaxa/*` owns the **design system** — the components, tokens, themes and icons every product
shares. A product's brand lockup is not shared: Work and Docs have their own. Keeping it here
respects the rule that products never duplicate design-system code, without pushing
product identity into the shared layer.

Everything about how these render other than the artwork itself — colour, typography, spacing,
the `cn` helper — still comes from `@munaxa/ui`.
