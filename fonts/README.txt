FONTS
=====

HEADINGS now use "Anton" (loaded automatically from Google Fonts) with
"Impact" as the local fallback — nothing for you to do here. Anton is
the web version of that bold Impact look and renders identically for
every visitor on any device, which plain Impact does not.
(Prefer literal Impact instead? In styles.css, find --font-head and put
"Impact" before "Anton".)

BODY text uses Avenir. Macs/iPhones already ship with Avenir Next, so
most visitors see it natively. To guarantee it everywhere, drop a
licensed web font file here:

    fonts/Avenir-Regular.woff2

styles.css already points at that exact filename. Different name or
format (.woff/.ttf/.otf)? Just update the @font-face block at the top
of styles.css.
