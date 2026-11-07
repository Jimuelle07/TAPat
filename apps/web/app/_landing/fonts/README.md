# Landing fonts

Both files are cut by the Google Fonts CSS API with its `text=` parameter, to keep the page's preloaded fonts small. They replace 280 KB of full variable files with 51 KB. Both are licensed under the SIL Open Font License 1.1.

| File | Family and settings | Characters |
| --- | --- | --- |
| `bricolage-700.woff2` | Bricolage Grotesque, weight 700, optical size axis kept | Printable ASCII plus `₱ ’ ‘ “ ” – — …` |
| `fraunces-italic-500.woff2` | Fraunces italic, weight 500, optical size axis kept, SOFT 100, WONK 1 | A-Z, a-z and `. , ' ’` |

A headline that needs any other character will show that character in the fallback font. To add one, recut the file:

```
family=Bricolage+Grotesque:opsz,wght@12..96,700&text=...
family=Fraunces:ital,opsz,wght,SOFT,WONK@1,9..144,500,100,1&text=...
```

Request `https://fonts.googleapis.com/css2?<family>&display=swap` with a current browser's User-Agent and download the `woff2` it names.
