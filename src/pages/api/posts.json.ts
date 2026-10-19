import { getPosts } from '../../lib/site/content';
export async function GET() {
  const posts = await getPosts();
  return Response.json(posts.map(({ slug, title, date, summary }) => ({ slug, title, date, summary, url: `${import.meta.env.BASE_URL}ideas/${slug}` })));
}
