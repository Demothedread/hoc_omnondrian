import { getResume } from '../../lib/site/content';
export async function GET() {
  return Response.json(await getResume());
}
