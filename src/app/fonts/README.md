# Self-hosted fonts

`hanken-grotesk-digits-{400,700}.woff2`: only the digits 0–9 (and space) of
[Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk), SIL Open Font
License 1.1 (`OFL-HankenGrotesk.txt`). Downloaded from Google Fonts with
`css2?family=Hanken+Grotesk:wght@<w>&text=0123456789` on 18 Oct 2026.

Why: Atkinson Hyperlegible (and its 2025 "Next" version) slashes its zero and has
no plain-zero alternate, so times read "19.ØØ". `layout.tsx` loads these with
`unicode-range: U+0030-0039` in front of Atkinson in the font stack, so only the
digits change.
