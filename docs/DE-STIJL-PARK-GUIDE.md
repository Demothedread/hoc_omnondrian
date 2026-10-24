// DESCRIPTION: Explains the portfolio park, its illustrated journey and document authoring workflow.
// INPUTS: The implemented local Astro site, CMS fields and supported source documents.
// OUTPUTS: Visitor controls and editor instructions with explicit current limitations.
// DEPENDENCIES: Local Astro server on port 4322, Keystatic, Motion and mammoth.

# De Stijl park guide

The live checkout is `/Users/munchhausen/Projects/Hocomnia`. Older variants remain in `/Users/munchhausen/Projects/illusional-site`; edits to those variants do not change this server.

Run `npm run dev` here and open `http://127.0.0.1:4322/`. The configured port is 4322; a busy port is an error instead of silently moving to another site.

## Exploring

- Park map selects any destination. The adjacent index selects a post, project section or résumé station directly.
- Destination names rack into focus on bezeled, glossy title plates. The camera travels beneath them; the plate enlarges past the viewer and clears as the content settles. A new destination cancels the previous plate.
- Projects contain consistently proportioned magazine spreads embedded within their world field. Select a section in the index, use ←/→ or the sequence controls, and scroll inside long content.
- Gallery retains the painted-cover reveal and particle/photo viewer. Writing reveals along a print-like blue rule. Site links have a brief illumination effect. About opens the introduction and illustrated greeting.
- Résumé entries are numbered stations. Professional and personal entries follow the CMS order. The guide can offer a related destination, remain with the viewer on that detour, and continue to the next résumé station. Dismiss the guide or reopen it with “Meet your guide”.
- The painting continues as a repeating ground with nested miniature compositions. Drag or use arrow keys to pan beyond the original board. Repeated named destination regions bring you back into the original content; the Park map always provides direct navigation.
- Open a project’s section index and choose **Read continuously** for its report view. Escape closes an open map/index menu before traveling to a parent.
- Browser Back/Forward follows visited locations; Esc goes to the parent. Reduced motion uses direct views and brief static plates. The Controls panel also offers a reduced-motion preview.

## Uploading and composing projects

1. Open `/studio` or choose **Controls → Project Studio**.
2. Choose/drop `.md`, `.markdown`, `.mdoc`, `.docx` or `.txt`, or paste source text. DOCX parsing happens in the browser; images are retained in the preview.
3. Review the actual site-native magazine spreads. The title/introduction opens the project. Drag section rows or use their ↑/↓ buttons to change reading order; section source Markdown is retained, including links, labels and image references.
4. Choose the title, URL, opening mode and word budget. **Save local draft** creates a new CMS entry while the local dev server runs. Existing URLs are rejected rather than overwritten. Embedded raster images are extracted into `public/images/projects/`.
5. Open **Controls → Content CMS**, select the new project, review its text and clear **Draft** when ready to include it in the park. A static deployment needs the normal rebuild to reflect changes.
6. **Download .mdoc** exports the current order on either local or static copies. **Start a new project** clears the working preview and leaves saved entries intact.

Use real Word heading styles, or labeled Markdown:

```markdown
# Project title

Opening paragraph.

CONTEXT
## The first section

Paragraphs and lists.

> A quotation.
> — Its source

## Evidence

Metric label: 34%

![Descriptive image text](/images/projects/image.jpg "Image caption")
```

`##` headings define reorderable source sections. Long sections can continue into multiple spreads. The original mapper also recognizes numbered headings and short standalone headings in plain text. The studio preserves source text; the current visual mapper does not provide full table, code-block or Word-layout fidelity.

## Editing the host and stations

In **About**, edit **Guide greeting** or optionally replace the **Guide illustration**. The original generated PNG is `public/images/host/jonathan-park-host.png`; its complete prompt and provenance are in `docs/host-avatar-generation.md`.

In **Resumé**, order sections and entries, choose **Professional** or **Personal**, write **Guide commentary**, and optionally set **Related destination** to a park path such as `gallery`, `ideas` or `projects/tesla`. Paths are validated against the rendered map before the guide offers them. Roles and education are still starter content and need actual biographical details.

## Current limits

- PDF/PPTX intake and OCR are still pending. DOCX/Markdown/text intake is implemented.
- Local draft saving is intentionally available only from the same site on this computer. Static copies support preview and export, and do not expose a filesystem write endpoint.
- Studio working previews are restored from browser session storage after development reloads. Very large embedded-image documents can exceed that browser quota; explicit save/export remains available.
- Résumé sections and stations now have permanent URL fields. Existing entries were assigned their current URLs, preserving old links through renaming/reordering. Set a unique permanent URL for each new section/station; changing that URL or moving a station between sections still changes its address.
- Motion settings still use the existing copy-settings/CMS handoff. Named preset saving and frame-time profiling remain in the QA backlog.
