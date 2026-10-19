"""Bundle the kit's ES modules + CSS into self-contained demo pages.
Strips import lines and `export` keywords; module order matters (dependencies first)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / "src"
L = "lib/illusion/"; C = "lib/cosmos/"
CORE = [L+"config.js", L+"store.js",
        C+"math/spring.js", C+"math/vanwijk.js", C+"math/optics.js", C+"math/schwarzschild.js",
        C+"mondrian.js", C+"blackhole.js",
        L+"backgrounds/droste.js", L+"backgrounds/static-illusions.js", L+"backgrounds/blackhole-bg.js", L+"backgrounds/grid-illusions.js",
        L+"text/motion-defined.js", L+"text/afterimage.js", L+"text/css-effects.js", L+"text/physics-text.js",
        L+"registry.js", L+"stage.js", L+"admin.js"]
COSMOS = CORE + ["lib/stijl/compose.js", "lib/stijl/presentation.js", "lib/stijl/blog.js", "lib/stijl/gallery.js", "lib/site/sample.js", C+"schema.js", C+"sample-content.js", C+"world.js", C+"camera.js", C+"rackfocus.js", C+"shots.js", C+"snapshot.js", C+"warp.js", C+"audio.js", C+"cosmos.js"]

def bundle(files):
    out = []
    seen = {}
    for f in files:
        src = (root / f).read_text()
        src = re.sub(r"^import .*?;\s*$", "", src, flags=re.M)
        src = re.sub(r"^export (const|function|let|class|async function) ", r"\1 ", src, flags=re.M)
        assert "export " not in re.sub(r"//.*|/\*[\s\S]*?\*/|`[\s\S]*?`", "", src), f
        # One script scope: top-level names must be unique across modules.
        for name in re.findall(r"^(?:(?:const|let) ([A-Za-z_$][\w$]*)\s*=|(?:async )?function\*? ([A-Za-z_$][\w$]*)\s*\(|class ([A-Za-z_$][\w$]*)\s)", src, flags=re.M):
            name = next(n for n in name if n)
            assert name not in seen, f"duplicate top-level name {name!r} in {f} and {seen[name]}"
            seen[name] = f
        out.append(f"/* ===== {f} ===== */\n{src}")
    return "\n".join(out)

def css(*names):
    return "\n".join((root / "styles" / n).read_text() for n in names)

S = "lib/stijl/"
SITE = [L+"config.js", S+"compose.js", "lib/site/doc-to-deck.js", S+"presentation.js", S+"assemble.js", S+"deck.js", S+"disintegrate.js", S+"gallery.js", S+"blog.js", "lib/site/sample.js"]
here = pathlib.Path(__file__).parent
CDN_THREE = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
outdir = pathlib.Path("/mnt/user-data/outputs"); outdir.mkdir(parents=True, exist_ok=True)
for tpl, files, styles, name in [
    ("template.html", CORE, ("illusion.css", "illusion-admin.css"), "illusion-lab.html"),
    ("cosmos-template.html", COSMOS, ("illusion.css", "analog.css", "stijl.css", "cosmos.css", "illusion-admin.css"), "cosmos-lab.html"),
    ("site-template.html", SITE, ("illusion.css", "analog.css", "stijl.css"), "site-lab.html"),
]:
    html = (here / tpl).read_text().replace("%%CSS%%", css(*styles)).replace("%%JS%%", bundle(files))
    # ES-module extras keep their imports (resolved by the page's import map).
    html = html.replace("%%MODULE%%", (root / "lib/stijl/particle-globe.js").read_text())
    (outdir / name).write_text(html)
    print("wrote", name, len(html), "bytes")
    # Test copy: swap the three.js CDN tag for a local stand-in (no network in CI).
    shim = here.parent / "test" / "three-shim.js"
    if CDN_THREE in html and shim.exists():
        test = html.replace(CDN_THREE, "<script>" + shim.read_text() + "</script>")
        (pathlib.Path("/home/claude") / ("test-" + name)).write_text(test)
