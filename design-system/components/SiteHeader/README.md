# SiteHeader

The top bar on every page: `.np-header` on `pine`, with the round logo badge, the name in Cinzel, the nav and one small primary button.

Always set `data-theme="dark"` on the header so the button and focus ring use their forest values in both themes. The nav collapses below 720px; provide your own menu button there.

Consumer provides: nav links (mark the current one `aria-current="page"`), the estimate link.
