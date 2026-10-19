# Hoc omnia nihil est

The studio of Jonathan Mark Reback, built as one oversized De Stijl painting. The whole site is a single world, larger than any screen: the camera flies from place to place, projects open as slides inside their own fields, posts and reports are read in place, the gallery's painting falls away as you arrive, and scrolling back sucks the screen into a singularity and returns you home. Content is edited in a no-code CMS (Keystatic) and stored as files in this repository.

## Start

```bash
npm install
npm run dev
```

- Site: http://localhost:4321
- CMS: http://localhost:4321/keystatic

Node 18.20 or newer. `npm run build` makes a fully static site in `dist/`; `npm test` runs the checks.

## One world, real addresses

There are no separate pages. Every place in the world has its own address, and every address opens the same world at that place:

| Address | Place |
|---|---|
| `/` | The overview of the whole painting |
| `/projects` | The Projects region |
| `/projects/tesla` | A project: its slides as a nested composition |
| `/projects/tesla/3` | Its third slide, filling the screen |
| `/projects/tesla/report` | Its report, read in place |
| `/gallery`, `/gallery/photo-2` | The gallery (the painting falls away), one photograph |
| `/ideas`, `/ideas/welcome` | The writing; one post, read in place |
| `/about/studio` | About |
| `/resume/experience` | A resumé section |
| `/api/endpoints` | The JSON endpoints (and `/api/projects.json` etc. as plain JSON) |
| `/singularity` | The black hole |

Moving around keeps the address in step, Back and Forward fly between places, and any address can be shared, bookmarked and indexed. Each place is a static HTML page containing the whole world, so search engines and visitors without JavaScript get the content; `/sitemap.xml` and a hidden list of every place come with it. New projects, posts and photos get their places on the next build.

### Moving

| Do | What happens |
|---|---|
| Click a field | The camera flies there. Click again to go in (a photograph opens its viewer; a project starts presenting). |
| `←` `→` | Previous or next slide, photo, or post. A report-format project's `→` opens its report. |
| `Esc` | Up one level. |
| Scroll up, pinch in | The painting yields, then everything is sucked into the singularity and you land at the overview. (Scroll direction is a setting.) |
| Scroll down, spread | Zoom in about the cursor. |
| Drag | Pan, with inertia. |
| Tab | Moves through the places; the camera follows. |

Sound is off until a visitor presses the Sound key. Reduced motion is respected throughout: flights cut, compositions appear finished, the gallery's painting simply fades.

## The CMS

Everything is in the CMS sidebar, under Writing, Pages and Motion:

- **Projects**: write each as a document (below), or build slides by hand.
- **Posts**: the writing. Drafts stay hidden.
- **Gallery**: photos with alt text, captions and weight (bigger field).
- **About**, **Resumé**.
- **Shots**: camera moves for the map (what plays on a click, on load, or when idle).
- **Cosmos**, **Illusions**: look and motion settings (speeds, sound, finish, black hole).

Saving writes files in `src/content/` and images in `public/images/`. Commit them like code.

## Projects become presentations

Write a project in the CMS like a report. When **Build slides from** is "The document", the site reads its structure:

| You write | It becomes |
|---|---|
| `# Title`, or the first short line | the title slide |
| `## Section`, or a short line standing on its own | a new slide |
| `2. Section`, `2.1 Subsection` on their own line | a slide, a subsection |
| `### Subsection` | the title of the paragraph after it |
| A short ALL-CAPS line (or one ending in `:`) right before a heading | a small label above that heading |
| `Revenue: 34%`, `**$1.2M** raised`, `12,400 riders surveyed` | a big number with its caption |
| A list where every item is a figure | several big numbers |
| `> quote` with a last line `— Name` | a pull quote with its source |
| An image with a caption | a figure |
| A list | a list |
| `---` | a slide break |
| A section longer than **Words per slide** | continues on another slide (and rejoins it in the report) |

Open `/outline/<project>` to see every slide and block, with the rule that produced it (`/outline` lists them all). Pasted plain text works too; headings are found from short standalone lines. In plain text, nest with numbering (`2.1 Who comes`) or Markdown `###`, since every unnumbered short line becomes its own section.

A project with **Opens as: Presentation** shows its slides first and keeps a small "Read as report" field; one with **Report** leads with a large report field.

### Importing a document

```bash
npm run import -- path/to/report.docx
npm run import -- notes.md --slug tesla --kind Presentation --format deck
npm run import -- talk.txt --dry        # show the slides it would make; write nothing
```

Reads `.docx` (Word; Google Docs → File → Download → Microsoft Word), `.md`, `.txt` and `.html`. Images in Word files are copied to `public/images/projects/`. The project appears in the CMS under Projects, ready to edit.

## Editing online

Local editing needs nothing else. To edit on the live site (changes commit to GitHub and the site rebuilds):

1. Push this repository to GitHub.
2. In Vercel (or Netlify, with that adapter), import the repository.
3. Set `KEYSTATIC_GITHUB_REPO=owner/repo` and `SITE_URL`, then visit `/keystatic` on the deployment and follow Keystatic's GitHub app setup.

Without `KEYSTATIC_GITHUB_REPO`, the build is static and works on any host. To host under a sub-path, set `base` in `astro.config.mjs`; the world follows it.

## Where things live

```
astro.config.mjs        local (static) or online editing
keystatic.config.ts     the CMS: every collection and form
scripts/import-project.mjs   document → project
src/pages/              index, [...route] (every place), 404, api/*.json, rss.xml, sitemap.xml, outline/*
src/components/cosmos/  WorldPage (one page of the site), CosmosWorld
src/content/            everything edited in the CMS
src/lib/cosmos/         the world: map builder, camera, black hole, warp, sound, shots
src/lib/stijl/          section composer, presentations, gallery, particle viewer
src/lib/site/           CMS adapter, document → slides mapper, samples
src/lib/illusion/       illusion stage (/lab/illusions) and the controls panel
src/styles/global.css   Tailwind v4 plus the site's style layers
test/                   composer, mapper, importer and world checks
docs/                   design notes and decision tables for each layer
demo/                   builds single-file demo pages (python3 demo/build.py)
```

## Checks

`npm test` runs: the section composer (3,000 seeds per layout: every item placed, no overlaps, colour ≤ 37.5%), the document mapper, the importer, and the world (every listed place exists on the map, every internal link resolves, no duplicate ids, every item finds a field, on sample content and on a world of 9 projects, 30 photos and 12 posts).

## Notes

- Projects ship as placeholders: every `[Placeholder]` marks text to replace, and figures read `00`.
- Every place is its own HTML file containing the whole world, so the built site is roughly 150 KB per place before compression (about 9 MB for the samples; gzip cuts each page to about 20 KB). The browser receives only a light copy of the content for scripting.
- The gallery's particle viewer needs WebGPU or WebGL2 and loads only when a photograph is opened; elsewhere the plain photo shows. Photos on another domain need CORS headers for it.
- The ray-traced black hole and the three.js warp need WebGL; without it the trip home is a quick fade.
