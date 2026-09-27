import type { MetadataRoute } from "next";

/** Lets a driver add the lot to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grandma's Truck Lot",
    short_name: "Truck Lot",
    description: "Truck parking in Gainesville, TX. See what's open tonight, reserve, and get your gate code.",
    start_url: "/",
    display: "standalone",
    background_color: "#23262B",
    theme_color: "#23262B",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
