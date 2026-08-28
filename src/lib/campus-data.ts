import { z } from "zod";

export const venueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  indoor: z.boolean(),
  features: z.array(z.string()).default([]),
});

export const bookingSchema = z.object({
  venueId: z.string().min(1),
  title: z.string().min(1),
  date: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  owner: z.string().min(1),
});

export const campusDatasetSchema = z.object({
  venues: z.array(venueSchema).min(1),
  bookings: z.array(bookingSchema).default([]),
  supportTeams: z.array(z.string().min(1)).min(1),
});

export type Venue = z.infer<typeof venueSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type CampusDataset = z.infer<typeof campusDatasetSchema>;

export const EMPTY_CAMPUS_DATASET: CampusDataset = {
  venues: [],
  bookings: [],
  supportTeams: [],
};

export function parseCampusDataset(input: unknown): CampusDataset {
  return campusDatasetSchema.parse(input);
}

export const venueById = (dataset: CampusDataset, id: string) =>
  dataset.venues.find((v) => v.id === id);
