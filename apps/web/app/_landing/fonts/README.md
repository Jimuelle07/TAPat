# Landing fonts

The file is cut by the Google Fonts CSS API with its `text=` parameter, to keep the page's preloaded fonts small. It is licensed under the SIL Open Font License 1.1.

| File | Family and settings | Characters |
| --- | --- | --- |
| `bricolage-700.woff2` | Bricolage Grotesque, weight 700, optical size axis kept | Printable ASCII plus `₱ ’ ‘ “ ” – — …` |

A headline that needs any other character will show that character in the fallback font. To add one, recut the file:

```
family=Bricolage+Grotesque:opsz,wght@12..96,700&text=...
```

Request `https://fonts.googleapis.com/css2?<family>&display=swap` with a current browser's User-Agent and download the `woff2` it names.
