-- Turns H1 headings marked with the "section-divider" class into a dedicated,
-- centered title page when building the LaTeX/PDF output. Left untouched for
-- every other format (HTML/EPUB styles the same heading via the
-- .section-divider CSS rule in epub.css instead).

function Header(el)
  if not (FORMAT:match("latex") and el.level == 1 and el.classes:includes("section-divider")) then
    return nil
  end

  local text = pandoc.utils.stringify(el.content)
  local label, title = text:match("^(.-)%s%-%s(.+)$")
  if not label then
    label, title = text, ""
  end

  local tex = string.format([[
\cleardoublepage
\thispagestyle{empty}
\addcontentsline{toc}{section}{%s}
\begin{center}
\vspace*{\fill}
{\sffamily\Large\bfseries\color{Accent}\MakeUppercase{%s}\par}
\vspace{0.8cm}
{\sffamily\Huge\bfseries\color{Dark}%s\par}
\vspace*{\fill}
\end{center}
\clearpage
]], text, label, title)

  return pandoc.RawBlock("latex", tex)
end
