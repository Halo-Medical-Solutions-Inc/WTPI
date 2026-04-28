# WTPI AI Receptionist

AI-powered receptionist for **West Texas Pain Institute** — handles inbound calls via Twilio + VAPI and writes structured call data to a Halo dashboard.

Production URL: https://wtpi.halohealth.app

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (async via asyncpg)
- Redis

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Fill in your credentials
alembic upgrade head
python scripts/seed_initial_data.py
uvicorn app.main:app --reload
```

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Configuration

### Required Services

- **PostgreSQL**: Database for calls, users, sessions, invitations, audit logs (use the `postgresql+asyncpg://` URL scheme)
- **Redis**: Pub/sub for real-time websocket updates
- **Twilio**: Inbound call handling (number: +1 915-621-2512)
- **VAPI**: AI voice agent for call conversations
- **Claude API**: Post-call data extraction
- **SMTP (Gmail)**: Email invitations and password resets

### Optional: Slack (Platform Support alerts)

When set, the same alert is posted to a Slack channel (e.g. `#support`) when: (1) someone sends a message or thread reply in **Platform Support**, or (2) a user whose email is **not** `@halohealth.app` sends a message in a **direct or group** conversation that includes at least one `@halohealth.app` member (incoming to Halo staff).


| Variable                   | Description                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`          | Bot User OAuth token (`xoxb-...`) with `chat:write` (and `chat:write.public` if the bot is not invited to the channel). |
| `SLACK_SUPPORT_CHANNEL_ID` | Channel ID for `#support` (starts with `C`).                                                                            |


Leave both empty to disable Slack notifications.

### Practice Configuration (already set for WTPI)

- Practice name: **West Texas Pain Institute**
- Region: `America/Denver` (El Paso, Mountain Time)
- Phone (published): (915) 313-4443
- VAPI inbound: +1 (915) 621-2512
- Locations: East / Northeast / West (all El Paso)
- Providers: Dr. Raul Lopez (MD), Ilyana Yee (NP), Monica Ogaz (NP), Lucia Fisher (NP), Amanda Lopez (PA)

### Customization touch-points

1. `backend/app/prompts.py` — voice agent system prompt (`BASE_WTPI_PROMPT`)
2. `backend/app/services/extraction_schema.py` — provider list and post-call extraction schema
3. `backend/app/services/analytics_service.py` — provider list and phone-number labels
4. `backend/.env` — credentials and `FROM_NAME`
5. Run `python scripts/seed_initial_data.py` to create the practice + admin users

## Database Migrations

```bash
cd backend
alembic upgrade head
```

## Scripts


| Script                     | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `seed_initial_data.py`     | Create practice + first admin users     |
| `seed_fake_calls.py`       | Generate test call data                 |
| `count_calls.py`           | Display call statistics                 |
| `inspect_call.py`          | View details of a specific call         |
| `send_bulk_invitations.py` | Invite multiple users                   |
| `backfill_display_data.py` | Rebuild display_data for existing calls |
