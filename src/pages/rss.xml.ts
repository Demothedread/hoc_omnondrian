/** /rss.xml — the writing feed. Posts live in the Ideas region: /ideas/<slug>. */
import rss from '@astrojs/rss';
import { getPosts } from '../lib/site/content';

export async function GET(context: { site: URL }) {
  const posts = await getPosts();
  const base = import.meta.env.BASE_URL;
  return rss({
    title: 'Hoc omnia nihil est — Writing',
    description: 'Writing from the studio of Jonathan Mark Reback.',
    site: context.site,
    items: posts.map((p) => ({ title: p.title, pubDate: new Date(p.date), description: p.summary, link: `${base}ideas/${p.slug}` })),
  });
}
