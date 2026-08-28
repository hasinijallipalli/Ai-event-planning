import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  Loader2,
  MapPin,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import { createPlan, replan } from "@/lib/plan.functions";
import type { EventPlan } from "@/lib/plan-schema";
import { detectConflicts, suggestSlots } from "@/lib/conflicts";
import {
  EMPTY_CAMPUS_DATASET,
  parseCampusDataset,
  venueById,
  type CampusDataset,
} from "@/lib/campus-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusOps — AI Event Planning & Coordination Agent" },
      {
        name: "description",
        content:
          "Turn a plain-English event brief into a full campus operations plan: venues, crews, schedules, conflict checks, tasks and readiness tracking.",
      },
      { property: "og:title", content: "CampusOps — AI Event Planning Agent" },
      {
        property: "og:description",
        content:
          "Agentic planning for fests, hackathons, workshops and placement drives — with conflict detection and dynamic replanning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SAMPLES = [
  "Two-day technical fest on 12-13 September 2026 for about 800 students, with a keynote, 4 workshops, a robotics expo and a closing cultural night.",
  "24-hour hackathon on 14 September 2026 for 180 participants, needs lab space, overnight security, food at 3 slots and mentor coordination.",
  "Placement drive for Infosys on 14 September 2026, 250 final-year students, aptitude test then interviews, needs waiting lounge and transport for panel.",
];

function Index() {
  const [requirement, setRequirement] = useState("");
  const [disruption, setDisruption] = useState("");
  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [dataset, setDataset] = useState<CampusDataset>(EMPTY_CAMPUS_DATASET);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});
  const [doneChecks, setDoneChecks] = useState<Record<string, boolean>>({});

  const createFn = useServerFn(createPlan);
  const replanFn = useServerFn(replan);

  useEffect(() => {
    void loadSampleDataset();
  }, []);

  async function loadSampleDataset() {
    try {
      const response = await fetch("/datasets/campus-operations.sample.json");
      const nextDataset = parseCampusDataset(await response.json());
      setDataset(nextDataset);
    } catch (error) {
      console.error(error);
      toast.error("Dataset load failed", {
        description: "Upload a JSON or CSV dataset to continue.",
      });
    }
  }

  const planning = useMutation({
    mutationFn: (text: string) => createFn({ data: { requirement: text, dataset } }),
    onSuccess: (p) => {
      setPlan(p as EventPlan);
      setDoneTasks({});
      setDoneChecks({});
      toast.success("Operational plan generated", { description: (p as EventPlan).eventTitle });
    },
    onError: (e: Error) => toast.error("Planning failed", { description: e.message }),
  });

  const replanning = useMutation({
    mutationFn: (text: string) => replanFn({ data: { plan: plan!, disruption: text, dataset } }),
    onSuccess: (p) => {
      setPlan(p as EventPlan);
      setDisruption("");
      toast.success("Plan re-optimised", { description: "Stakeholders should be re-briefed." });
    },
    onError: (e: Error) => toast.error("Replanning failed", { description: e.message }),
  });

  const busy = planning.isPending || replanning.isPending;

  const report = useMemo(() => {
    if (!plan) return null;
    return detectConflicts(
      {
        venueId: plan.recommendedVenueId,
        date: plan.date,
        start: plan.startTime,
        end: plan.endTime,
        attendees: plan.expectedAttendees,
        indoorPreferred: plan.indoorPreferred,
      },
      dataset,
    );
  }, [dataset, plan]);

  const slots = useMemo(
    () => (plan ? suggestSlots(plan.recommendedVenueId, plan.date, 180, dataset) : []),
    [dataset, plan],
  );

  const taskDone = plan ? plan.tasks.filter((_, i) => doneTasks[`t${i}`]).length : 0;
  const checkDone = plan ? plan.checklist.filter((_, i) => doneChecks[`c${i}`]).length : 0;
  const totalItems = plan ? plan.tasks.length + plan.checklist.length : 0;
  const readiness = totalItems
    ? Math.round(
        ((taskDone + checkDone) / totalItems) *
          100 *
          (report?.conflicts.some((c) => c.severity === "critical") ? 0.8 : 1),
      )
    : 0;

  const venue = plan ? venueById(dataset, plan.recommendedVenueId) : undefined;
  const hasDataset = dataset.venues.length > 0 && dataset.supportTeams.length > 0;

  function changeVenue(venueId: string) {
    const nextVenue = venueById(dataset, venueId);
    if (!plan || !nextVenue) return;

    setPlan({
      ...plan,
      recommendedVenueId: nextVenue.id,
      venueRationale: `${nextVenue.name} was selected from the alternative options. It seats ${nextVenue.capacity} and is available for the current event window in the uploaded dataset.`,
    });

    toast.success("Venue changed", {
      description: `Plan now uses ${nextVenue.name}.`,
    });
  }

  return (
    <div className="min-h-screen hero-gradient">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <Database className="h-4 w-4" />
            Dataset-trained campus operations
          </div>
          <h1 className="mt-3 text-4xl font-bold md:text-5xl">
            <span className="text-gradient">CampusOps</span> Event Planning Agent
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Describe your fest, hackathon, workshop or placement drive in plain English. The agent
            builds the operational plan from your uploaded campus resource, booking and support-team
            dataset.
          </p>
        </header>

        <section className="surface-panel p-5 md:p-6">
          <label className="text-sm font-semibold" htmlFor="requirement">
            Event requirement intake
          </label>
          <Textarea
            id="requirement"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            rows={4}
            placeholder="e.g. Two-day technical fest in September for 800 students with keynote, workshops and a cultural night..."
            className="mt-3 resize-none bg-secondary/40"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRequirement(s)}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
              >
                {s.slice(0, 46)}…
              </button>
            ))}
          </div>
          <Button
            className="mt-4"
            disabled={busy || requirement.trim().length < 5 || !hasDataset}
            onClick={() => planning.mutate(requirement)}
          >
            {planning.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Planning…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate operational plan
              </>
            )}
          </Button>
        </section>

        {!plan && !planning.isPending && (
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: MapPin,
                t: "Venue intelligence",
                d: `${dataset.venues.length} uploaded venues with booking calendar and capacity rules.`,
              },
              {
                icon: AlertTriangle,
                t: "Conflict detection",
                d: "Clash, capacity and weather risks flagged with ranked alternatives.",
              },
              {
                icon: RefreshCw,
                t: "Dynamic replanning",
                d: "Rain, VIP changes or a double booking — the plan rebuilds itself.",
              },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="surface-panel p-5">
                <Icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </section>
        )}

        {plan && (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="surface-panel p-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge className="mb-2">{plan.eventType}</Badge>
                    <h2 className="text-2xl font-semibold">{plan.eventTitle}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat
                    icon={CalendarClock}
                    label="Window"
                    value={`${plan.date} · ${plan.startTime}–${plan.endTime}`}
                  />
                  <Stat
                    icon={MapPin}
                    label="Venue"
                    value={venue?.name ?? plan.recommendedVenueId}
                  />
                  <Stat icon={Users} label="Attendees" value={String(plan.expectedAttendees)} />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{plan.venueRationale}</p>
              </div>

              <div className="surface-panel p-5">
                <h3 className="font-semibold">Event readiness</h3>
                <div className="mt-4 text-4xl font-bold text-gradient">{readiness}%</div>
                <Progress value={readiness} className="mt-3" />
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>
                    Tasks closed: {taskDone}/{plan.tasks.length}
                  </li>
                  <li>
                    Checklist cleared: {checkDone}/{plan.checklist.length}
                  </li>
                  <li>Open conflicts: {report?.conflicts.length ?? 0}</li>
                </ul>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() =>
                    toast.success("Briefing dispatched", {
                      description: `Sent to ${plan.teams.length} teams and ${plan.permissions.length} approving authorities.`,
                    })
                  }
                >
                  <Megaphone className="h-4 w-4" /> Notify stakeholders
                </Button>
              </div>
            </section>

            {report && (report.conflicts.length > 0 || report.alternatives.length > 0) && (
              <section className="mt-4 surface-panel p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Conflict check
                </h3>
                {report.conflicts.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> No venue, capacity or weather conflicts
                    detected.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {report.conflicts.map((c) => (
                      <li
                        key={c.message}
                        className="rounded-lg border border-border bg-secondary/30 p-3 text-sm"
                      >
                        <Badge
                          variant={c.severity === "critical" ? "destructive" : "secondary"}
                          className="mr-2"
                        >
                          {c.severity}
                        </Badge>
                        {c.message}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-semibold">Alternative venues</h4>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {report.alternatives.map((a) => (
                        <li
                          key={a.venue.id}
                          className="flex flex-col gap-2 rounded-lg bg-secondary/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            <span className="text-foreground">{a.venue.name}</span> - {a.reason}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => changeVenue(a.venue.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Use venue
                          </Button>
                        </li>
                      ))}
                      {report.alternatives.length === 0 && (
                        <li>No alternative venue free in this window.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Alternative slots (same venue)</h4>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {slots.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                      {slots.length === 0 && <li>Venue fully committed that day.</li>}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-4 surface-panel p-5">
              <Tabs defaultValue="resources">
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="schedule">Run sheet</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="checklist">Checklist</TabsTrigger>
                  <TabsTrigger value="risks">Risks & approvals</TabsTrigger>
                  <TabsTrigger value="brief">Brief</TabsTrigger>
                </TabsList>

                <TabsContent value="resources" className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Wrench className="h-4 w-4 text-accent" /> Equipment
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm">
                      {plan.equipment.map((e, i) => (
                        <li
                          key={i}
                          className="flex justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2"
                        >
                          <span>
                            {e.item} <span className="text-muted-foreground">×{e.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">{e.owner}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-accent" /> Teams
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm">
                      {plan.teams.map((t, i) => (
                        <li key={i} className="rounded-lg bg-secondary/30 px-3 py-2">
                          <div className="flex justify-between">
                            <span>{t.team}</span>
                            <span className="text-muted-foreground">{t.headcount} pax</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{t.responsibility}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4">
                  <ul className="space-y-2">
                    {plan.schedule.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-4 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                      >
                        <span className="w-24 shrink-0 font-mono text-accent">{s.time}</span>
                        <span className="flex-1">{s.activity}</span>
                        <span className="text-muted-foreground">{s.owner}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                  <ul className="space-y-2">
                    {plan.tasks.map((t, i) => {
                      const key = `t${i}`;
                      return (
                        <li
                          key={key}
                          className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={!!doneTasks[key]}
                            onCheckedChange={(v) => setDoneTasks((s) => ({ ...s, [key]: !!v }))}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <span
                              className={doneTasks[key] ? "line-through text-muted-foreground" : ""}
                            >
                              {t.title}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {t.owner} · due {t.due}
                            </div>
                          </div>
                          <Badge variant={t.priority === "high" ? "destructive" : "secondary"}>
                            {t.priority}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </TabsContent>

                <TabsContent value="checklist" className="mt-4">
                  <ul className="grid gap-2 md:grid-cols-2">
                    {plan.checklist.map((c, i) => {
                      const key = `c${i}`;
                      return (
                        <li
                          key={key}
                          className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={!!doneChecks[key]}
                            onCheckedChange={(v) => setDoneChecks((s) => ({ ...s, [key]: !!v }))}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-xs uppercase tracking-wide text-accent">
                              {c.category}
                            </div>
                            <span
                              className={
                                doneChecks[key] ? "line-through text-muted-foreground" : ""
                              }
                            >
                              {c.item}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </TabsContent>

                <TabsContent value="risks" className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-accent" /> Permissions
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm">
                      {plan.permissions.map((p, i) => (
                        <li key={i} className="rounded-lg bg-secondary/30 px-3 py-2">
                          <div>{p.approval}</div>
                          <p className="text-xs text-muted-foreground">
                            {p.authority} · lead time {p.leadTime}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-warning" /> Risks
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm">
                      {plan.risks.map((r, i) => (
                        <li key={i} className="rounded-lg bg-secondary/30 px-3 py-2">
                          <div>{r.risk}</div>
                          <p className="text-xs text-muted-foreground">
                            Mitigation: {r.mitigation}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="brief" className="mt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardList className="h-4 w-4 text-accent" /> Stakeholder briefing
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {plan.stakeholderBrief}
                  </p>
                </TabsContent>
              </Tabs>
            </section>

            <section className="mt-4 surface-panel p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <RefreshCw className="h-4 w-4 text-accent" /> Dynamic replanning
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Conditions changed? Describe it and the agent rebuilds the plan around it.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={disruption}
                  onChange={(e) => setDisruption(e.target.value)}
                  placeholder="Heavy rain forecast, auditorium taken by convocation, 200 extra registrations…"
                  className="bg-secondary/40"
                />
                <Button
                  variant="secondary"
                  disabled={busy || disruption.trim().length < 3}
                  onClick={() => replanning.mutate(disruption)}
                >
                  {replanning.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Replan
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/30 px-3 py-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
