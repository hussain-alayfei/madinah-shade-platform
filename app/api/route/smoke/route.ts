import { POST as routePost } from "../route";

export async function GET() {
  const request = new Request("https://madinah-shade-platform.vercel.app/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: { lat: 24.47175, lon: 39.60683 },
      destination: { lat: 24.4686804, lon: 39.611162 },
      needs: [],
    }),
  });

  return routePost(request);
}
