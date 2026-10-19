import { getProjects } from '../../lib/site/content';
export async function GET() {
  const projects = await getProjects();
  return Response.json(projects.map(({ slug, title, kind, format, summary, slides }) => ({ slug, title, kind, format, summary, url: `${import.meta.env.BASE_URL}projects/${slug}`, slides })));
}
