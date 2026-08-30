import { POST as routePost } from "../route";

export async function GET() {
  return routePost(
    new Request("https://madinah-shade-platform.vercel.app/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lat: 24.7136, lon: 46.6753 },
        destination: { lat: 24.4686804, lon: 39.611162 },
        needs: [],
      }),
    }),
  );
}
