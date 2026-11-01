# NetPulse Maroc

Crowdsourced internet quality for Morocco: speed tests, outage reports on a map, and neighbourhood comparisons.

```
frontend/   static website (HTML, CSS, JavaScript)   -> GitHub Pages
backend/    FastAPI API                               -> Render / Railway / a VPS
database/   schema.sql                                -> Supabase (PostgreSQL)
```

## Run it locally
1. **Database:** create a free project at supabase.com, then run `database/schema.sql` in its SQL editor.
2. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env            # then fill in your Supabase URL and service_role key
   uvicorn main:app --reload       # API docs: http://localhost:8000/docs
   ```
3. **Frontend** (new terminal):
   ```bash
   cd frontend
   python -m http.server 8000
   ```
   Open http://localhost:8000. Set `API_URL` (top of `report/report.js` and `speetest/speedtest.js`) to your API address.
   Note: the frontend and the API cannot both use port 8000. Run the API on another port, for example `uvicorn main:app --reload --port 8001`, and use `http://localhost:8001` as `API_URL`.

## Security rules
- `backend/.env` is never committed (see `.gitignore`). Only `.env.example` is.
- The Supabase `service_role` key lives only in `.env` and in your hosting provider's environment variables.
- Reports are stored at about 500 m precision. No names, emails or exact addresses are collected.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Is the API running |
| GET | `/zones` | List neighbourhoods |
| POST | `/measurements` | Save a speed test result |
| POST | `/reports` | Save an outage report |
| GET | `/reports/recent` | Recent reports for the map |
| GET | `/zones/{id}/stats` | Medians per operator and time of day |

Map data: Natural Earth (public domain). Map tiles: OpenStreetMap contributors.