#!/usr/bin/env python3
"""Builds the SquirrelDisk website (site/dist) in English and Spanish.

Run `python3 site/build.py` and open site/dist/index.html. The Pages
workflow runs the same command on every push to main.
"""

import html
import json
import shutil
from pathlib import Path

BASE = "https://hernancasillas.github.io/squirreldisk"
REPO = "https://github.com/hernancasillas/squirreldisk"
HERE = Path(__file__).parent
OUT = HERE / "dist"

STRINGS = {
    "en": {
        "path": "",
        "locale": "en_US",
        "title": "SquirrelDisk – Free Disk Space Analyzer for Mac, Windows & Linux",
        "description": "Free, open source disk usage analyzer. See what's taking up space with a sunburst and treemap, get cleanup suggestions for caches like Xcode DerivedData and node_modules, and free up GBs in seconds. Native on Apple Silicon.",
        "headline": "See what's taking up your disk space",
        "lead": "SquirrelDisk scans your disk in seconds, shows where the space went, and points out the caches and leftovers you can safely delete. Free and open source.",
        "download": "Download",
        "download_for": "Download for {os}",
        "other_platforms": "Other platforms",
        "free_note": "Free · Open source (AGPL-3.0) · No ads, no tracking",
        "features_title": "Everything you need to free up space",
        "features": [
            ("Native on Apple Silicon", "One universal app for M1, M2, M3, M4 and Intel Macs, plus Windows and Linux (x64 and arm64)."),
            ("Fast, parallel scanning", "Millions of files in about a minute, using every CPU core. Live progress, cancel at any time."),
            ("Sunburst and treemap", "Two interactive views with labels and tooltips. Click any folder to zoom in."),
            ("Cleanup suggestions", "Recognizes about 40 kinds of caches and build folders: Xcode DerivedData, simulators, node_modules, Gradle, CocoaPods, Adobe media cache, browser caches, iPhone backups and more."),
            ("Real sizes", "Shows what files really use on disk. Docker images, VM disks and iCloud or OneDrive placeholders no longer show as terabytes."),
            ("Safe cleanup", "Tick what you don't need and move it to the Trash. Nothing is deleted without confirmation."),
            ("Automatic updates", "New versions install with one click, and every update is signed."),
            ("Private", "Runs on your computer. No accounts, analytics or uploads."),
        ],
        "alt_title": "A free alternative to DaisyDisk, WinDirStat and WizTree",
        "alt_text": "SquirrelDisk does the job of DaisyDisk, GrandPerspective and OmniDiskSweeper on macOS, WinDirStat, WizTree, TreeSize and SpaceSniffer on Windows, and Baobab or QDirStat on Linux. It uses one interface on every platform and costs nothing.",
        "table_head": ["", "SquirrelDisk", "DaisyDisk", "WinDirStat", "WizTree"],
        "table_rows": [
            ("Price", "Free", "Paid", "Free", "Free for personal use"),
            ("macOS / Windows / Linux", "✓ / ✓ / ✓", "✓ / – / –", "– / ✓ / –", "– / ✓ / –"),
            ("Native Apple Silicon", "✓", "✓", "–", "–"),
            ("Cleanup suggestions", "✓", "–", "–", "–"),
            ("Open source", "✓", "–", "✓", "–"),
        ],
        "faq_title": "Frequently asked questions",
        "faq": [
            ("How do I find what's taking up space on my Mac?", "Open SquirrelDisk and click Macintosh HD. In about a minute you get a chart of every folder by size. Click a slice to zoom in, or open the Suggestions tab to see caches you can delete safely."),
            ("Is it safe to delete Xcode DerivedData?", "Yes. DerivedData only holds build products and indexes, and Xcode recreates them the next time you build. The first build afterwards is slower. SquirrelDisk marks it as “Safe to delete”."),
            ("Can I delete node_modules folders?", "Yes. Running npm install (or yarn, pnpm or bun) in the project restores them. SquirrelDisk finds every node_modules folder on your disk, so old projects are easy to clean up."),
            ("Does SquirrelDisk work on M1, M2, M3 and M4 Macs?", "Yes. It is a universal app that runs natively on Apple Silicon and on Intel. It doesn't need Rosetta."),
            ("Why does macOS say it can't verify the app?", "SquirrelDisk is open source but not notarized by Apple. The first time you open it, go to System Settings → Privacy & Security and click Open Anyway. You only need to do this once."),
            ("Is SquirrelDisk really free?", "Yes. It is open source under the AGPL-3.0 license, with no ads, subscriptions or tracking."),
        ],
        "cta_title": "Free up space in minutes",
        "footer": "SquirrelDisk is open source software. Originally created by Adileo Barone, maintained by Hernan Casillas and contributors.",
        "source": "Source code",
        "changelog": "Changelog",
        "issues": "Report an issue",
        "switch": "Español",
        "shots": ["Sunburst view of a Mac disk", "Treemap view", "Cleanup suggestions", "Disk list"],
    },
    "es": {
        "path": "es/",
        "locale": "es_ES",
        "title": "SquirrelDisk – Analizador de espacio en disco gratis para Mac, Windows y Linux",
        "description": "Analizador de espacio en disco gratuito y de código abierto. Descubre qué ocupa tu disco con un gráfico solar y un treemap, recibe sugerencias para borrar cachés como DerivedData de Xcode y node_modules, y libera GB en segundos. Nativo en Apple Silicon.",
        "headline": "Descubre qué está ocupando tu disco",
        "lead": "SquirrelDisk analiza tu disco en segundos, te muestra a dónde se fue el espacio y te señala las cachés y restos que puedes borrar sin riesgo. Gratis y de código abierto.",
        "download": "Descargar",
        "download_for": "Descargar para {os}",
        "other_platforms": "Otras plataformas",
        "free_note": "Gratis · Código abierto (AGPL-3.0) · Sin anuncios ni rastreo",
        "features_title": "Todo lo que necesitas para liberar espacio",
        "features": [
            ("Nativo en Apple Silicon", "Una sola app universal para Macs M1, M2, M3, M4 e Intel, además de Windows y Linux (x64 y arm64)."),
            ("Análisis rápido en paralelo", "Millones de archivos en cerca de un minuto, usando todos los núcleos. Progreso en vivo y puedes cancelar cuando quieras."),
            ("Gráfico solar y treemap", "Dos vistas interactivas con etiquetas y detalles al pasar el ratón. Haz clic en una carpeta para entrar."),
            ("Sugerencias de limpieza", "Reconoce unos 40 tipos de cachés y carpetas de compilación: DerivedData y simuladores de Xcode, node_modules, Gradle, CocoaPods, caché de Adobe, cachés de navegadores, respaldos de iPhone y más."),
            ("Tamaños reales", "Muestra lo que los archivos ocupan de verdad. Las imágenes de Docker, los discos de máquinas virtuales y los archivos de iCloud u OneDrive ya no aparecen como terabytes."),
            ("Limpieza segura", "Marca lo que no necesitas y mándalo a la Papelera. Nada se borra sin confirmación."),
            ("Actualizaciones automáticas", "Las versiones nuevas se instalan con un clic y cada actualización va firmada."),
            ("Privado", "Funciona en tu equipo. Sin cuentas, analíticas ni subidas."),
        ],
        "alt_title": "Una alternativa gratis a DaisyDisk, WinDirStat y WizTree",
        "alt_text": "SquirrelDisk hace lo mismo que DaisyDisk, GrandPerspective y OmniDiskSweeper en macOS, WinDirStat, WizTree, TreeSize y SpaceSniffer en Windows, y Baobab o QDirStat en Linux. Usa la misma interfaz en todas las plataformas y no cuesta nada.",
        "table_head": ["", "SquirrelDisk", "DaisyDisk", "WinDirStat", "WizTree"],
        "table_rows": [
            ("Precio", "Gratis", "De pago", "Gratis", "Gratis para uso personal"),
            ("macOS / Windows / Linux", "✓ / ✓ / ✓", "✓ / – / –", "– / ✓ / –", "– / ✓ / –"),
            ("Nativo en Apple Silicon", "✓", "✓", "–", "–"),
            ("Sugerencias de limpieza", "✓", "–", "–", "–"),
            ("Código abierto", "✓", "–", "✓", "–"),
        ],
        "faq_title": "Preguntas frecuentes",
        "faq": [
            ("¿Cómo sé qué ocupa espacio en mi Mac?", "Abre SquirrelDisk y haz clic en Macintosh HD. En cerca de un minuto verás un gráfico de todas las carpetas por tamaño. Haz clic en una sección para entrar, o abre la pestaña Sugerencias para ver las cachés que puedes borrar sin riesgo."),
            ("¿Es seguro borrar el DerivedData de Xcode?", "Sí. DerivedData solo guarda compilaciones e índices, y Xcode los vuelve a crear la siguiente vez que compilas. La primera compilación será más lenta. SquirrelDisk lo marca como “Seguro de borrar”."),
            ("¿Puedo borrar las carpetas node_modules?", "Sí. Al correr npm install (o yarn, pnpm o bun) en el proyecto se restauran. SquirrelDisk encuentra todas las carpetas node_modules de tu disco, así que limpiar proyectos viejos es fácil."),
            ("¿Funciona en Macs M1, M2, M3 y M4?", "Sí. Es una app universal que corre de forma nativa en Apple Silicon y en Intel. No necesita Rosetta."),
            ("¿Por qué macOS dice que no puede verificar la app?", "SquirrelDisk es de código abierto pero no está notarizada por Apple. La primera vez que la abras, ve a Ajustes del Sistema → Privacidad y seguridad y haz clic en Abrir de todos modos. Solo se hace una vez."),
            ("¿SquirrelDisk es gratis de verdad?", "Sí. Es de código abierto con licencia AGPL-3.0, sin anuncios, suscripciones ni rastreo."),
        ],
        "cta_title": "Libera espacio en minutos",
        "footer": "SquirrelDisk es software de código abierto. Creado originalmente por Adileo Barone, mantenido por Hernan Casillas y colaboradores.",
        "source": "Código fuente",
        "changelog": "Novedades",
        "issues": "Reportar un problema",
        "switch": "English",
        "shots": ["Vista solar de un disco de Mac", "Vista treemap", "Sugerencias de limpieza", "Lista de discos"],
    },
}

E = html.escape


def page(lang: str) -> str:
    s = STRINGS[lang]
    other = "es" if lang == "en" else "en"
    url = f"{BASE}/{s['path']}"
    root = "" if lang == "en" else "../"
    # Screenshots of the app in the page's language.
    shot_dir = f"{root}img/" if lang == "en" else f"{root}img/es/"
    ld_app = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "SquirrelDisk",
        "description": s["description"],
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "macOS, Windows, Linux",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "license": "https://www.gnu.org/licenses/agpl-3.0.html",
        "url": url,
        "downloadUrl": f"{REPO}/releases/latest",
        "image": f"{BASE}/img/sunburst.jpg",
        "screenshot": f"{BASE}/img/sunburst.jpg",
        "codeRepository": REPO,
        "inLanguage": lang,
    }
    ld_faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in s["faq"]
        ],
    }
    features = "\n".join(
        f'<div class="feature"><h3>{E(t)}</h3><p>{E(d)}</p></div>' for t, d in s["features"]
    )
    head_cells = "".join(f"<th>{E(h)}</th>" for h in s["table_head"])
    rows = "\n".join(
        "<tr>" + "".join(f"<td>{E(c)}</td>" if i else f"<th scope=\"row\">{E(c)}</th>" for i, c in enumerate(r)) + "</tr>"
        for r in s["table_rows"]
    )
    faq = "\n".join(f"<details><summary>{E(q)}</summary><p>{E(a)}</p></details>" for q, a in s["faq"])
    shots = s["shots"]
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(s['title'])}</title>
<meta name="description" content="{E(s['description'])}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{BASE}/">
<link rel="alternate" hreflang="es" href="{BASE}/es/">
<link rel="alternate" hreflang="x-default" href="{BASE}/">
<link rel="icon" type="image/png" href="{root}img/icon.png">
<meta name="theme-color" content="#0a0f1e">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SquirrelDisk">
<meta property="og:title" content="{E(s['title'])}">
<meta property="og:description" content="{E(s['description'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}/img/og.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:locale" content="{s['locale']}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{E(s['title'])}">
<meta name="twitter:description" content="{E(s['description'])}">
<meta name="twitter:image" content="{BASE}/img/og.png">
<script type="application/ld+json">{json.dumps(ld_app, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(ld_faq, ensure_ascii=False)}</script>
<link rel="stylesheet" href="{root}style.css">
</head>
<body>
<header class="nav">
  <a class="brand" href="{url}"><img src="{root}img/icon.png" alt="" width="28" height="28">SquirrelDisk</a>
  <nav>
    <a href="{REPO}">GitHub</a>
    <a href="{root}{STRINGS[other]['path']}" hreflang="{other}" lang="{other}">{E(s['switch'])}</a>
  </nav>
</header>
<main>
<section class="hero">
  <h1>{E(s['headline'])}</h1>
  <p class="lead">{E(s['lead'])}</p>
  <div class="actions">
    <a class="btn primary" id="download" href="{REPO}/releases/latest" data-label="{E(s['download_for'])}">{E(s['download'])}</a>
    <a class="btn" href="{REPO}/releases/latest">{E(s['other_platforms'])}</a>
  </div>
  <p class="note">{E(s['free_note'])}</p>
  <img class="shot" src="{shot_dir}sunburst.jpg" alt="{E(shots[0])}" width="1600" height="1003">
</section>

<section>
  <h2>{E(s['features_title'])}</h2>
  <div class="features">
{features}
  </div>
</section>

<section class="gallery">
  <img src="{shot_dir}suggestions.jpg" alt="{E(shots[2])}" loading="lazy" width="1600" height="1003">
  <img src="{shot_dir}treemap.jpg" alt="{E(shots[1])}" loading="lazy" width="1600" height="1003">
</section>

<section>
  <h2>{E(s['alt_title'])}</h2>
  <p>{E(s['alt_text'])}</p>
  <div class="table-wrap"><table>
    <thead><tr>{head_cells}</tr></thead>
    <tbody>
{rows}
    </tbody>
  </table></div>
</section>

<section>
  <h2>{E(s['faq_title'])}</h2>
  <div class="faq">
{faq}
  </div>
</section>

<section class="cta">
  <h2>{E(s['cta_title'])}</h2>
  <a class="btn primary" href="{REPO}/releases/latest">{E(s['download'])}</a>
</section>
</main>
<footer>
  <p>{E(s['footer'])}</p>
  <p><a href="{REPO}">{E(s['source'])}</a> · <a href="{REPO}/blob/main/CHANGELOG.md">{E(s['changelog'])}</a> · <a href="{REPO}/issues">{E(s['issues'])}</a></p>
</footer>
<script>
// Point the main button straight at the right file for this computer.
(function () {{
  var ua = navigator.userAgent, os = /Mac/.test(ua) ? "macOS" : /Win/.test(ua) ? "Windows" : /Linux/.test(ua) && !/Android/.test(ua) ? "Linux" : null;
  if (!os) return;
  var btn = document.getElementById("download");
  btn.textContent = btn.dataset.label.replace("{{os}}", os);
  var arm = /aarch64|arm64/i.test(ua);
  var pick = {{
    macOS: function (n) {{ return /universal\\.dmg$/.test(n); }},
    Windows: function (n) {{ return /x64-setup\\.exe$/.test(n); }},
    Linux: function (n) {{ return arm ? /aarch64\\.AppImage$/.test(n) : /amd64\\.AppImage$/.test(n); }}
  }}[os];
  fetch("https://api.github.com/repos/hernancasillas/squirreldisk/releases/latest")
    .then(function (r) {{ return r.ok ? r.json() : null; }})
    .then(function (rel) {{
      var a = rel && rel.assets.filter(function (x) {{ return pick(x.name); }})[0];
      if (a) btn.href = a.browser_download_url;
    }})
    .catch(function () {{}});
}})();
</script>
</body>
</html>
"""


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "es").mkdir(parents=True)
    shutil.copytree(HERE / "img", OUT / "img")
    shutil.copy(HERE / "style.css", OUT / "style.css")
    (OUT / "index.html").write_text(page("en"), encoding="utf-8")
    (OUT / "es" / "index.html").write_text(page("es"), encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    (OUT / "sitemap.xml").write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>{BASE}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="{BASE}/"/>
    <xhtml:link rel="alternate" hreflang="es" href="{BASE}/es/"/>
  </url>
  <url>
    <loc>{BASE}/es/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="{BASE}/"/>
    <xhtml:link rel="alternate" hreflang="es" href="{BASE}/es/"/>
  </url>
</urlset>
""",
        encoding="utf-8",
    )
    print(f"Built {OUT}")


if __name__ == "__main__":
    main()
