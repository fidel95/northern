# To do

## Build the Gutters, Siding and Concrete pages

These three services have no page of their own yet. Until they do, every link
to them (header menu, mobile menu, footer, and the home page tiles, cards and
house diagram) goes to the home page's services section, `/#services`.

When the pages are ready:

1. Create `gutters/index.html`, `siding/index.html` and `concrete/index.html`
   (`doors/index.html` is a good one to copy from).
2. Point the links back at them. In every `.html` file, the temporary links are
   the ones next to the words Gutters, Siding and Concrete that say
   `href="/#services"`. Also update the three `"url"` values for those services
   in the structured data near the top of `index.html`.
3. Add the three new addresses to `sitemap.xml`.
