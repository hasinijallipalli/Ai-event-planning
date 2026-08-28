import { venueById, type CampusDataset, type Venue } from "./campus-data";

const toMin = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const formatTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export type Conflict = {
  severity: "critical" | "warning";
  kind: "venue-booked" | "capacity" | "weather-risk";
  message: string;
};

export type ConflictReport = {
  conflicts: Conflict[];
  alternatives: { venue: Venue; reason: string }[];
};

export function detectConflicts(
  input: {
    venueId: string;
    date: string;
    start: string;
    end: string;
    attendees: number;
    indoorPreferred?: boolean;
  },
  dataset: CampusDataset,
): ConflictReport {
  const conflicts: Conflict[] = [];
  const venue = venueById(dataset, input.venueId);
  const start = toMin(input.start);
  const end = toMin(input.end);

  const clashing = dataset.bookings.filter(
    (booking) =>
      booking.venueId === input.venueId &&
      booking.date === input.date &&
      toMin(booking.start) < end &&
      start < toMin(booking.end),
  );

  for (const booking of clashing) {
    conflicts.push({
      severity: "critical",
      kind: "venue-booked",
      message: `${venue?.name ?? input.venueId} is already booked for "${booking.title}" (${booking.owner}) from ${booking.start} to ${booking.end}.`,
    });
  }

  if (venue && input.attendees > venue.capacity) {
    conflicts.push({
      severity: "critical",
      kind: "capacity",
      message: `Expected ${input.attendees} attendees exceeds ${venue.name} capacity of ${venue.capacity}.`,
    });
  }

  if (venue && !venue.indoor && input.indoorPreferred) {
    conflicts.push({
      severity: "warning",
      kind: "weather-risk",
      message: `${venue.name} is an open venue; a wet-weather fallback is required.`,
    });
  }

  const alternatives = dataset.venues
    .filter((candidate) => candidate.id !== input.venueId)
    .filter((candidate) => candidate.capacity >= input.attendees)
    .filter(
      (candidate) =>
        !dataset.bookings.some(
          (booking) =>
            booking.venueId === candidate.id &&
            booking.date === input.date &&
            toMin(booking.start) < end &&
            start < toMin(booking.end),
        ),
    )
    .sort((a, b) => a.capacity - b.capacity)
    .slice(0, 3)
    .map((candidate) => ({
      venue: candidate,
      reason: `Free on ${input.date} ${input.start}-${input.end}, seats ${candidate.capacity}${candidate.indoor ? ", indoor" : ", open air"}.`,
    }));

  return { conflicts, alternatives };
}

export function suggestSlots(
  venueId: string,
  date: string,
  durationMin: number,
  dataset: CampusDataset,
) {
  const booked = dataset.bookings
    .filter((booking) => booking.venueId === venueId && booking.date === date)
    .map((booking) => [toMin(booking.start), toMin(booking.end)] as const)
    .sort((a, b) => a[0] - b[0]);

  const dayStart = 8 * 60;
  const dayEnd = 21 * 60;
  const slots: string[] = [];
  let cursor = dayStart;

  for (const [bookingStart, bookingEnd] of [...booked, [dayEnd, dayEnd] as const]) {
    if (bookingStart - cursor >= durationMin) {
      slots.push(
        `${formatTime(cursor)} - ${formatTime(Math.min(bookingStart, cursor + durationMin))}`,
      );
    }
    cursor = Math.max(cursor, bookingEnd);
  }

  return slots.slice(0, 3);
}
