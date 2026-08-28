import { campusDatasetSchema, type CampusDataset, type Venue } from "./campus-data";
import { planSchema, type EventPlan } from "./plan-schema";

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const toMin = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);

function eventTypeFrom(text: string) {
  const value = text.toLowerCase();
  if (value.includes("hackathon")) return "Hackathon";
  if (value.includes("placement") || value.includes("recruitment")) return "Placement Drive";
  if (value.includes("workshop")) return "Workshop";
  if (value.includes("conference")) return "Conference";
  if (value.includes("fest")) return "Technical Fest";
  if (value.includes("cultural")) return "Cultural Event";
  return "Campus Event";
}

function attendeeCountFrom(text: string) {
  const matches = [...text.matchAll(/\b(\d{2,5})\b/g)].map((m) => Number(m[1]));
  return matches.find((n) => n >= 20) ?? 150;
}

function dateFrom(text: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1]!;

  const spoken = text.match(
    /\b(\d{1,2})(?:\s*-\s*\d{1,2})?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i,
  );
  if (spoken) {
    const day = spoken[1]!.padStart(2, "0");
    const month = MONTHS[spoken[2]!.toLowerCase()];
    return `${spoken[3]}-${month}-${day}`;
  }

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 14);
  return nextWeek.toISOString().slice(0, 10);
}

function timeWindowFor(eventType: string, text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("24-hour") || lower.includes("24 hour")) {
    return { startTime: "09:00", endTime: "21:00" };
  }
  if (eventType === "Placement Drive") return { startTime: "08:30", endTime: "18:00" };
  if (eventType === "Cultural Event") return { startTime: "16:00", endTime: "22:00" };
  if (eventType === "Workshop") return { startTime: "10:00", endTime: "16:00" };
  return { startTime: "09:00", endTime: "17:30" };
}

function chooseVenue(
  dataset: CampusDataset,
  date: string,
  startTime: string,
  endTime: string,
  attendees: number,
  indoorPreferred: boolean,
) {
  const ranked = [...dataset.venues].sort((a, b) => {
    const aFits = a.capacity >= attendees ? 0 : 1;
    const bFits = b.capacity >= attendees ? 0 : 1;
    const aIndoor = indoorPreferred && a.indoor ? 0 : 1;
    const bIndoor = indoorPreferred && b.indoor ? 0 : 1;
    return aFits - bFits || aIndoor - bIndoor || a.capacity - b.capacity;
  });

  const free = ranked.find(
    (venue) =>
      venue.capacity >= attendees &&
      (!indoorPreferred || venue.indoor) &&
      !dataset.bookings.some(
        (booking) =>
          booking.venueId === venue.id &&
          booking.date === date &&
          overlaps(startTime, endTime, booking.start, booking.end),
      ),
  );

  return free ?? ranked.find((venue) => venue.capacity >= attendees) ?? ranked[0];
}

function titleFor(eventType: string, requirement: string) {
  if (eventType === "Technical Fest") return "Technical Fest Operations Plan";
  if (eventType === "Hackathon") return "Hackathon Operations Plan";
  if (eventType === "Placement Drive") return "Placement Drive Operations Plan";
  if (eventType === "Workshop") return "Workshop Operations Plan";
  return `${eventType} Operations Plan`;
}

function equipmentFor(eventType: string, venue: Venue) {
  const common = [
    { item: "Registration desks", quantity: 3, owner: "Volunteer Corps" },
    { item: "Directional signages", quantity: 12, owner: "Media & Communications" },
    { item: "Emergency first-aid kits", quantity: 2, owner: "Medical & Safety" },
  ];

  const byType =
    eventType === "Hackathon"
      ? [
          {
            item: "Workstations / laptop zones",
            quantity: Math.min(venue.capacity, 180),
            owner: "AV / Technical Crew",
          },
          { item: "High-speed LAN nodes", quantity: 24, owner: "AV / Technical Crew" },
          { item: "Overnight food counters", quantity: 3, owner: "Hospitality & Catering" },
        ]
      : eventType === "Placement Drive"
        ? [
            { item: "Aptitude test seating blocks", quantity: 4, owner: "T&P Cell" },
            { item: "Interview panels", quantity: 8, owner: "Placement Centre" },
            { item: "Candidate waiting tokens", quantity: 250, owner: "Volunteer Corps" },
          ]
        : [
            { item: "Stage microphone kit", quantity: 4, owner: "AV / Technical Crew" },
            {
              item: "Projection screens",
              quantity: venue.features.includes("Projector") ? 1 : 2,
              owner: "AV / Technical Crew",
            },
            { item: "Power backup units", quantity: 2, owner: "Transport & Logistics" },
          ];

  return [...byType, ...common];
}

function teamsFor(dataset: CampusDataset, attendees: number) {
  return dataset.supportTeams.slice(0, 7).map((team, index) => ({
    team,
    headcount: Math.max(2, Math.ceil(attendees / [45, 75, 90, 120, 100, 150, 130][index]!)),
    responsibility:
      [
        "Registration, crowd flow and help desk coverage",
        "Gate control, ID checks and emergency escalation",
        "Audio, projection, network and backup equipment",
        "Movement plan, vendor loading and parking",
        "Meals, water stations and guest hospitality",
        "Medical desk, fire safety and incident log",
        "Announcements, signage and stakeholder updates",
      ][index] ?? "Operational support",
  }));
}

function scheduleFor(eventType: string, startTime: string) {
  if (eventType === "Hackathon") {
    return [
      {
        time: startTime,
        activity: "Registration, kit issue and network check",
        owner: "Volunteer Corps",
      },
      { time: "10:00", activity: "Problem statement briefing", owner: "Faculty Coordinator" },
      { time: "11:00", activity: "Team formation and build sprint 1", owner: "Mentor Desk" },
      { time: "15:00", activity: "Mentor review round", owner: "Technical Jury" },
      {
        time: "20:00",
        activity: "Dinner and progress checkpoint",
        owner: "Hospitality & Catering",
      },
      { time: "09:00", activity: "Final submissions", owner: "Technical Jury" },
      { time: "11:00", activity: "Demo judging and awards", owner: "Event Lead" },
    ];
  }

  if (eventType === "Placement Drive") {
    return [
      {
        time: startTime,
        activity: "Recruiter arrival and room readiness check",
        owner: "T&P Cell",
      },
      {
        time: "09:00",
        activity: "Candidate registration and document screening",
        owner: "Volunteer Corps",
      },
      { time: "10:00", activity: "Company pre-placement talk", owner: "Recruiter Panel" },
      { time: "11:00", activity: "Aptitude test batch 1", owner: "Exam Cell" },
      { time: "13:00", activity: "Shortlist processing", owner: "T&P Cell" },
      { time: "14:00", activity: "Technical and HR interviews", owner: "Recruiter Panel" },
      { time: "17:30", activity: "Final selection briefing", owner: "T&P Cell" },
    ];
  }

  return [
    {
      time: startTime,
      activity: "Venue access, registration desk setup and AV check",
      owner: "Operations Lead",
    },
    { time: "09:30", activity: "Guest arrival and participant check-in", owner: "Volunteer Corps" },
    { time: "10:00", activity: "Opening briefing and safety announcement", owner: "Event Lead" },
    { time: "11:00", activity: "Primary event block", owner: "Program Team" },
    { time: "13:00", activity: "Lunch and venue reset", owner: "Hospitality & Catering" },
    {
      time: "14:00",
      activity: "Workshops, demos or parallel sessions",
      owner: "Faculty Coordinators",
    },
    {
      time: "16:30",
      activity: "Feedback, certificates and closing notes",
      owner: "Media & Communications",
    },
  ];
}

function daysBefore(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() - days);
  return parsed.toISOString().slice(0, 10);
}

function buildPlan(requirement: string, dataset: CampusDataset, changeNote?: string): EventPlan {
  const eventType = eventTypeFrom(requirement);
  const expectedAttendees = attendeeCountFrom(requirement);
  const date = dateFrom(requirement);
  const { startTime, endTime } = timeWindowFor(eventType, requirement);
  const indoorPreferred = !/open air|outdoor|cultural night|ground|quadrangle/i.test(requirement);
  const venue = chooseVenue(dataset, date, startTime, endTime, expectedAttendees, indoorPreferred);

  if (!venue) {
    throw new Error("Dataset must include at least one venue.");
  }

  const plan: EventPlan = {
    eventTitle: titleFor(eventType, requirement),
    eventType,
    summary: changeNote
      ? `Replanned against latest dataset and disruption: ${changeNote}`
      : `Generated from the uploaded campus operations dataset using ${dataset.venues.length} venues, ${dataset.bookings.length} bookings and ${dataset.supportTeams.length} support teams.`,
    date,
    startTime,
    endTime,
    expectedAttendees,
    indoorPreferred,
    recommendedVenueId: venue.id,
    venueRationale: `${venue.name} is selected from the runtime dataset because it seats ${venue.capacity}, matches the event requirements and has the best available window.`,
    equipment: equipmentFor(eventType, venue),
    teams: teamsFor(dataset, expectedAttendees),
    schedule: scheduleFor(eventType, startTime),
    tasks: [
      {
        title: "Freeze event scope and owner matrix",
        owner: "Event Lead",
        due: daysBefore(date, 10),
        priority: "high",
      },
      {
        title: "Confirm venue booking in campus calendar",
        owner: "Operations Lead",
        due: daysBefore(date, 9),
        priority: "high",
      },
      {
        title: "Publish participant communication plan",
        owner: "Media & Communications",
        due: daysBefore(date, 8),
        priority: "medium",
      },
      {
        title: "Allocate volunteers by gate, desk and session",
        owner: "Volunteer Corps",
        due: daysBefore(date, 7),
        priority: "high",
      },
      {
        title: "Complete AV, network and power dry run",
        owner: "AV / Technical Crew",
        due: daysBefore(date, 5),
        priority: "high",
      },
      {
        title: "Confirm food, water and waste counters",
        owner: "Hospitality & Catering",
        due: daysBefore(date, 4),
        priority: "medium",
      },
      {
        title: "Run security and emergency walkthrough",
        owner: "Medical & Safety",
        due: daysBefore(date, 3),
        priority: "high",
      },
      {
        title: "Send final stakeholder briefing",
        owner: "Event Lead",
        due: daysBefore(date, 1),
        priority: "medium",
      },
    ],
    permissions: [
      {
        approval: "Venue booking confirmation",
        authority: "Campus Administration",
        leadTime: "7 days",
      },
      {
        approval: "Security and crowd-control clearance",
        authority: "Chief Security Officer",
        leadTime: "5 days",
      },
      {
        approval: "Electrical and AV load approval",
        authority: "Maintenance Department",
        leadTime: "4 days",
      },
      {
        approval: "Student communication approval",
        authority: "Dean Student Affairs",
        leadTime: "3 days",
      },
    ],
    checklist: [
      { category: "Venue", item: "Room layout, entry flow and emergency exits verified" },
      { category: "Venue", item: "Backup venue or alternate slot documented" },
      { category: "Equipment", item: "Projection, mic, network and power tested" },
      { category: "People", item: "Volunteer duty roster published" },
      { category: "People", item: "Owner assigned for every schedule block" },
      { category: "Safety", item: "Medical desk and incident escalation contacts ready" },
      { category: "Permissions", item: "All approvals recorded before final go/no-go" },
      { category: "Communications", item: "Participant instructions and maps sent" },
      { category: "Communications", item: "Stakeholder briefing shared with departments" },
      { category: "Operations", item: "Day-before readiness review completed" },
    ],
    risks: [
      {
        risk: "Venue clash found in live booking data",
        mitigation: "Move to the highest-ranked alternative venue or slot.",
      },
      {
        risk: "Attendance exceeds venue capacity",
        mitigation: "Split sessions, cap registration or move to a larger venue.",
      },
      {
        risk: "AV or network failure",
        mitigation: "Keep backup projector, hotspot and power units at control desk.",
      },
      {
        risk: "Crowd congestion at entry",
        mitigation: "Stagger reporting time and add queue volunteers.",
      },
    ],
    stakeholderBrief: `${eventType} is scheduled on ${date} from ${startTime} to ${endTime} at ${venue.name} for about ${expectedAttendees} attendees. The plan uses the uploaded campus dataset for venue capacity, booking conflicts and support-team assignment. Operations should confirm the venue, finish AV and safety dry runs, publish participant instructions and keep alternates ready for clashes or capacity changes. Team leads must update task status before the final readiness review.`,
  };

  return planSchema.parse(plan);
}

export async function runPlanner(
  requirement: string,
  datasetInput: CampusDataset,
): Promise<EventPlan> {
  const dataset = campusDatasetSchema.parse(datasetInput);
  return buildPlan(requirement, dataset);
}

export function replanPrompt(plan: EventPlan, disruption: string) {
  return `${plan.eventTitle}. ${plan.summary}. ${disruption}`;
}

export async function runReplanner(
  plan: EventPlan,
  disruption: string,
  datasetInput: CampusDataset,
): Promise<EventPlan> {
  const dataset = campusDatasetSchema.parse(datasetInput);
  const extra = disruption.match(/\b(\d{2,5})\s+(?:extra|more|additional|new)\b/i);
  const expectedAttendees = extra
    ? plan.expectedAttendees + Number(extra[1])
    : plan.expectedAttendees;
  const revised = buildPlan(
    `${plan.eventType} on ${plan.date} for ${expectedAttendees} attendees. ${disruption}`,
    dataset,
    disruption,
  );

  return {
    ...revised,
    eventTitle: plan.eventTitle,
    date: plan.date,
    expectedAttendees,
  };
}
