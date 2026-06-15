# XenoCRM Mini — Backend

> CRM API server + Channel Stub for XenoCRM Mini. Built for the Xeno Engineering Internship Assignment 2026.

---

## What is this?

This repo contains two independent services:

| Service | Folder | Port | Purpose |
|---|---|---|---|
| CRM Server | `/` (root) | 3001 | Main API — customers, segments, campaigns, AI, webhooks |
| Channel Stub | `/channel-stub` | 3002 | Simulates WhatsApp/SMS/Email/RCS delivery with async callbacks |

Both are deployed as separate Railway services from this single repository.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express |
| ORM | Prisma |
| Database | Supabase PostgreSQL |
| AI | Groq API |
| Package manager | Bun |
| Deploy | Railway (2 services) |

---

## Architecture

```mermaid
graph TD
    F[React Frontend<br/>Vercel :5173] -->|REST| C
    C[CRM Server<br/>Railway :3001] -->|POST /send| S
    S[Channel Stub<br/>Railway :3002] -->|POST /webhook/receipt| C
    C -->|Prisma| D[(Supabase PostgreSQL)]
    C -->|HTTPS| G[Groq API]

    style F fill:#f5f3ff,stroke:#7c3aed,color:#3b0764
    style C fill:#ecfdf3,stroke:#12b76a,color:#064e3b
    style S fill:#fffbeb,stroke:#f59e0b,color:#451a03
    style D fill:#eff4ff,stroke:#0f62fe,color:#1e3a5f
    style G fill:#fef3f2,stroke:#f04438,color:#450a0a
```

---

## Database Schema

```mermaid
erDiagram
    Customer ||--o{ Order : has
    Customer ||--o{ Communication : receives
    Segment ||--o{ Campaign : targets
    Campaign ||--o{ Communication : generates

    Customer {
        string id PK
        string name
        string email
        string city
        string[] tags
        float totalSpend
        datetime lastOrderAt
    }

    Order {
        string id PK
        string customerId FK
        float amount
        string[] items
        datetime createdAt
    }

    Segment {
        string id PK
        string name
        json rules
        int customerCount
    }

    Campaign {
        string id PK
        string segmentId FK
        string channel
        string messageTemplate
        string status
        datetime sentAt
    }

    Communication {
        string id PK
        string campaignId FK
        string customerId FK
        string message
        string status
        string channel
    }

    CommunicationLog {
        string id PK
        string communicationId FK
        string event
        datetime timestamp
    }
```

---

## Channel Stub — Delivery Simulation

```mermaid
sequenceDiagram
    participant C as CRM Server
    participant S as Channel Stub
    participant D as Database

    C->>S: POST /send { communicationId, channel, message }
    S-->>C: 200 { status: queued } immediately

    Note over S: Async simulation begins

    S->>C: POST /webhook/receipt { event: sent }
    C->>D: status → sent

    alt 90% delivered
        S->>C: POST /webhook/receipt { event: delivered }
        C->>D: status → delivered

        alt 25% opened
            S->>C: POST /webhook/receipt { event: opened }
            C->>D: status → opened

            alt 60% of opened clicked
                S->>C: POST /webhook/receipt { event: clicked }
                C->>D: status → clicked
            end
        end
    else 10% failed
        S->>C: POST /webhook/receipt { event: failed }
        C->>D: status → failed
    end
```

---

## API Routes

### Customers
| Method | Route | Description |
|---|---|---|
| GET | `/api/customers` | List customers (search, filter, sort) |
| GET | `/api/customers/:id` | Single customer with orders |
| POST | `/api/customers/import` | Bulk import customers |

### Segments
| Method | Route | Description |
|---|---|---|
| GET | `/api/segments` | List all segments |
| POST | `/api/segments` | Create segment |
| POST | `/api/segments/preview` | Preview matching customer count |
| DELETE | `/api/segments/:id` | Delete segment |

### Campaigns
| Method | Route | Description |
|---|---|---|
| GET | `/api/campaigns` | List campaigns |
| GET | `/api/campaigns/:id` | Single campaign |
| POST | `/api/campaigns` | Create campaign |
| POST | `/api/campaigns/:id/send` | Send campaign to segment |
| GET | `/api/campaigns/:id/stats` | Delivery stats |
| GET | `/api/campaigns/:id/communications` | Individual message statuses |

### Webhook
| Method | Route | Description |
|---|---|---|
| POST | `/api/webhook/receipt` | Receive delivery events from channel stub |

### AI (Groq)
| Method | Route | Description |
|---|---|---|
| POST | `/api/ai/parse-segment` | NL text → segment rules JSON |
| POST | `/api/ai/draft-message` | Generate 3 message variants |
| POST | `/api/ai/chat` | Full chat agent with campaign intent |
| GET | `/api/ai/dashboard-insight` | AI summary of recent campaigns |
| GET | `/api/ai/campaign-insight/:id` | AI insight for a specific campaign |

---

## Environment Variables

### CRM Server (root `.env`)

| Variable | Required | Where to get it | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Supabase → Project Settings → Database → Transaction pooler URI | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Yes | Supabase → Project Settings → Database → Direct connection URI | `postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres` |
| `GROQ_API_KEY` | Yes | Provider API console → API Keys | `groq-xxxxxxxxxxxx` |
| `CHANNEL_STUB_URL` | Yes | Railway channel-stub service URL | `https://xeno-channel-stub.up.railway.app` |
| `FRONTEND_URL` | Yes | Vercel frontend URL | `https://xeno-crm-frontend.vercel.app` |
| `PORT` | No | Set by Railway automatically | `3001` |

### Channel Stub (`channel-stub/.env`)

| Variable | Required | Where to get it | Example |
|---|---|---|---|
| `CRM_URL` | Yes | Railway CRM server URL | `https://xeno-crm-backend.up.railway.app` |
| `PORT` | No | Set by Railway automatically | `3002` |

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/URAYUSHJAIN/xeno-crm-backend.git
cd xeno-crm-backend

# 2. Install CRM server deps
bun install

# 3. Install channel stub deps
cd channel-stub && bun install && cd ..

# 4. Set up environment
cp .env.example .env
# Edit .env — add DATABASE_URL and GROQ_API_KEY

cp channel-stub/.env.example channel-stub/.env
# channel-stub/.env is fine as-is for local dev

# 5. Set up database
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts

# 6. Start both services (two terminals)

# Terminal 1 — CRM Server
bun run dev

# Terminal 2 — Channel Stub
cd channel-stub && bun run dev
```

### Verify both are running

```bash
curl http://localhost:3001/health
# { "status": "ok", "service": "xeno-crm-server" }

curl http://localhost:3002/health
# { "status": "ok", "service": "xeno-channel-stub" }

curl http://localhost:3001/api/customers
# { "customers": [...200 customers], "total": 200 }
```

---

## Railway Deployment

Two services deployed from this single repo:

**Service 1 — CRM Server**
- Root directory: `/` (leave empty)
- Build command: `bun install && npx prisma generate && bun run build`
- Start command: `bun run start`
- Environment variables: DATABASE_URL, GROQ_API_KEY, CHANNEL_STUB_URL, FRONTEND_URL

**Service 2 — Channel Stub**
- Root directory: `channel-stub`
- Build command: `bun install && bun run build`
- Start command: `bun run start`
- Environment variables: CRM_URL

> Deploy channel stub first to get its URL, then set CHANNEL_STUB_URL in the CRM server service.

---

## Seed Data

The seed script generates 200 realistic StyleX Fashion customers:
- Indian names across Mumbai, Delhi, Bangalore, Chennai, Hyderabad
- Spend range ₹500–₹15,000 with realistic distribution
- Tags: VIP (high spenders), loyal, churned (inactive), new
- 1–5 orders per customer spanning 18 months
- 2 pre-built segments: "Win-back: 60+ days inactive" and "VIP customers"

Re-run safely anytime: `npx ts-node prisma/seed.ts`

---

## Related Repositories

| Repo | Description |
|---|---|
| [xeno-crm-frontend](https://github.com/URAYUSHJAIN/xeno-crm-frontend) | React + TypeScript frontend on Vercel |

---

## Assignment

Built for the Xeno Engineering Internship Take-Home Assignment 2026.
Brand: StyleX Fashion (fictional D2C fashion label used for demo data).
