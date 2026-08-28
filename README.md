# CampusOps Event Planning Agent

Dataset-driven campus event planning and coordination prototype.

The app turns a plain-English event brief into an operational plan using a
runtime campus dataset instead of fixed records in source code. Upload JSON or
CSV data for venues, existing bookings and support teams, then generate:

- Venue recommendations from capacity and availability.
- Schedule and resource conflict detection.
- Equipment, team allocation, permissions and risk plans.
- Task delegation, readiness tracking and dynamic replanning.

## Development

```sh
npm install
npm run dev
```

Open `http://localhost:8080`.

## Dataset Format

JSON uploads should use this shape:

```json
{
  "venues": [
    {
      "id": "audi-main",
      "name": "Main Auditorium",
      "capacity": 900,
      "indoor": true,
      "features": ["Stage", "PA system", "Projector"]
    }
  ],
  "bookings": [
    {
      "venueId": "audi-main",
      "title": "Convocation Rehearsal",
      "date": "2026-09-12",
      "start": "08:00",
      "end": "13:00",
      "owner": "Registrar Office"
    }
  ],
  "supportTeams": ["Volunteer Corps", "Security", "AV Team"]
}
```

CSV uploads should include a `recordType` column with rows for `venue`,
`booking` and `team`. Supported columns:

```csv
recordType,id,name,capacity,indoor,features,venueId,title,date,start,end,owner,team
venue,audi-main,Main Auditorium,900,true,Stage;PA system;Projector,,,,,,,
booking,,,,,,audi-main,Convocation Rehearsal,2026-09-12,08:00,13:00,Registrar Office,
team,,,,,,,,,,,,Volunteer Corps
```

The bundled sample file lives at `public/datasets/campus-operations.sample.json`
and can be replaced with your college or hackathon dataset.
