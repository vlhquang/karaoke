import { z } from "zod";
import type { Point } from "./model";

export interface MapPlace {
  id: string;
  name: string;
  address: string;
  point: Point;
  zoom: number;
}

const featureSchema = z.object({
  geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-80).max(80)]) }),
  properties: z.object({
    name: z.string().optional(), street: z.string().optional(), housenumber: z.string().optional(), district: z.string().optional(),
    city: z.string().optional(), county: z.string().optional(), state: z.string().optional(), country: z.string().optional(),
    osm_type: z.string().optional(), osm_id: z.union([z.string(), z.number()]).optional(), type: z.string().optional(), osm_value: z.string().optional(),
  }),
});

export function readPlaces(payload: unknown): MapPlace[] {
  const collection = z.object({ features: z.array(z.unknown()) }).parse(payload);
  const places: MapPlace[] = [];
  for (const item of collection.features) {
    const parsed = featureSchema.safeParse(item);
    if (!parsed.success) continue;
    const { properties: p, geometry: { coordinates: [lng, lat] } } = parsed.data;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const name = p.name?.trim() || street || p.district || p.city || p.state;
    if (!name) continue;
    const address = [...new Set([street, p.district, p.city, p.county, p.state, p.country].filter((value): value is string => !!value && value !== name))].join(", ");
    const type = p.type || p.osm_value;
    const zoom = type === "country" ? 6 : type === "state" ? 10 : type === "city" || type === "county" ? 13 : type === "district" || type === "locality" ? 16 : type === "street" ? 18 : 19;
    const id = `${p.osm_type ?? "place"}-${p.osm_id ?? `${lat}-${lng}`}`;
    if (!places.some(place => place.id === id)) places.push({ id, name: name.slice(0, 200), address: address.slice(0, 500), point: [lat, lng], zoom });
  }
  return places;
}
