import { POST as routePost } from "../route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const outside = url.searchParams.get("case") === "outside";
  const body = outside
    ? {
        origin: { lat: 24.7136, lon: 46.6753 },
        destination: { lat: 24.4686804, lon: 39.611162 },
        needs: [],
      }
    : {
        origin: { lat: 24.47175, lon: 39.60683 },
        destination: { lat: 24.4686804, lon: 39.611162 },
        needs: [],
      };

  return routePost(
    new Request("https://madinah-shade-platform.vercel.app/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
