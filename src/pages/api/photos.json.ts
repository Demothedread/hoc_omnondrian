import { getPhotos } from '../../lib/site/content';
export async function GET() {
  return Response.json(await getPhotos());
}
