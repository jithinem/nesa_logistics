# Nesa Logistics Route Optimization System

A TypeScript/Express backend for planning logistics routes across a MongoDB
network of hubs. It provides JWT authentication, weighted shortest-path
optimization, route graph cycle detection, fastest-route analytics, synchronous
delivery recalculation after route updates, and authenticated Socket.IO events.

## Technology stack

- Node.js 18+ and TypeScript (strict mode, CommonJS output)
- Express 4, Mongoose 8, and MongoDB
- Zod request validation
- JWT (`jsonwebtoken`) and bcryptjs authentication
- Socket.IO real-time updates
- Vitest, Supertest, and Node's test runner

## Architecture

The application separates the Express app (`src/app.ts`) from the executable
server (`src/server.ts`). The server connects MongoDB, creates the shared HTTP
server, initializes Socket.IO, and handles shutdown signals.

Feature modules follow a routes/controllers/services/models organization.
Controllers validate/receive HTTP input and format responses; services contain
the application and persistence work. Shared middleware handles validation,
authentication, authorization, async errors, and centralized error responses.
The Dijkstra and cycle-detection algorithms are pure TypeScript modules and do
not depend on Express or MongoDB.

```text
src/
  algorithms/       Dijkstra shortest path and DFS cycle detection
  config/           Environment and MongoDB configuration
  middleware/       Authentication, roles, validation, and error handling
  modules/
    analytics/      Fastest available routes aggregation
    auth/           Registration, login, user model, and token verification
    deliveries/     Delivery model and currently reserved API router
    hubs/           Hub model and currently reserved API router
    routes/         Optimization, cycle detection, and route recalculation
  routes/           Versioned API router and health endpoint
  seed/             Deterministic development data
  shared/types/     Shared domain enums and interfaces
  sockets/          Authenticated Socket.IO setup and event publishing
  utils/            API response/error helpers and async handler
tests/
  unit/             Vitest algorithm and recalculation unit tests
  integration/      Supertest API tests against a dedicated MongoDB test DB
  *.test.ts         Existing Node test-runner tests
postman/
  Nesa Logistics.postman_collection.json
  Nesa Logistics Local.postman_environment.json
```

## Installation and configuration

Requirements: Node.js 18 or newer, npm, and MongoDB. Clone the repository, then:

```sh
npm install
Copy-Item .env.example .env
```

Edit `.env` and set a unique `JWT_SECRET` of at least 32 characters. To generate
one locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Never commit `.env` or put production credentials in a container image.

| Variable | Required | Default | Description |
|---|---:|---|---|
| `NODE_ENV` | No | `development` | `development`, `test`, or `production`. Seeding is restricted to development. |
| `PORT` | No | `3000` | HTTP and Socket.IO port, 1–65535. |
| `MONGODB_URI` | Yes | — | Application MongoDB connection string. |
| `MONGODB_TEST_URI` | For integration tests | — | Isolated test DB URI; its database name must end in `_test`. |
| `MONGODB_MAX_POOL_SIZE` | No | `20` | MongoDB maximum connection pool size, 1–100 per application instance. |
| `JWT_SECRET` | Yes | — | HS256 secret, minimum 32 characters. |
| `CORS_ORIGIN` | No | `*` | Comma-separated allowed browser origins, or `*`. |
| `ROUTE_GRAPH_CACHE_TTL_MS` | No | `30000` | In-process route graph cache TTL, 0–3,600,000 ms; zero disables caching. |
| `TRUST_PROXY` | No | `0` | Number of trusted proxy hops; set to match the deployment topology. |

`MONGODB_URI` and `JWT_SECRET` are validated when the application configuration
loads. The same MongoDB database stores hubs, routes, deliveries, and users.

## Database setup and sample data

Start a local MongoDB service or configure a reachable MongoDB URI in `.env`.
The app connects to the configured database when the server starts. Models are
registered by Mongoose; indexes are declared in the schemas and are created by
Mongoose according to its model initialization behavior.

Seed the deterministic development graph:

```sh
npm run seed
```

The seed command requires `NODE_ENV=development`. It upserts 10 hubs by their
unique codes and 30 routes by fixed IDs. It includes alternate paths, cycles,
high traffic, and blocked routes. It does not wipe the database or unrelated
records, and it is safe to rerun.

## Commands

```sh
npm run dev                 # Development server (nodemon + tsx)
npm run build               # Compile strict TypeScript into dist/
npm start                   # Run dist/server.js
npm run seed                # Upsert deterministic development graph
npm test                    # Legacy tests plus Vitest suites
npm run test:unit           # Dijkstra, cycle detection, recalculation unit tests
npm run test:integration    # Supertest API tests against MONGODB_TEST_URI
npm run test:legacy         # Original Node test-runner suite
```

For integration tests, configure `MONGODB_TEST_URI` to a separate disposable
database, for example `mongodb://127.0.0.1:27017/nesa_logistics_test`. The suite
checks that the database name ends in `_test` and inserts/deletes only
test-specific records. Do not point it at a production or development database.
If `MONGODB_TEST_URI` is unset, Vitest skips database integration tests but
still executes the unit suite.

## Authentication and authorization

Register or log in to receive a 15-minute JWT access token. Tokens use HS256 and
are verified with issuer, audience, expiry, user activity, and current database
role checks. Public registration creates an `OPERATOR` only; clients cannot
choose `ADMIN`. Provision an initial admin using a trusted database operator.
After a role change, the user must log in again because stale-role tokens are
rejected.

| Operation | Access |
|---|---|
| Register and login | Public; limited to 10 attempts per IP per 15 minutes |
| Route optimization, cycles, fastest-route analytics | `ADMIN` or `OPERATOR` |
| Update route traffic or status | `ADMIN` only |
| Hub and delivery routers | Authentication/role middleware is present, but no hub/delivery operation handlers are implemented yet |

Operational API requests use `Authorization: Bearer <accessToken>`.

## REST API

The primary API base path is `/api`. Equivalent versioned endpoints are mounted
under `/api/v1` (for example `/api/v1/routes/cycles`). Health probes are
available at `/health`, `/health/live`, and `/health/ready`; `/api/v1/health`
is the original API health response.

Success responses use `{ "success": true, "message": "...", "data": ... }`.
Failures use `{ "success": false, "message": "...", "details": ... }` where
details are available. Validation failures return `400`; missing/invalid
authentication returns `401`; insufficient role returns `403`; missing
resources or available paths return `404`.

### Health

| Method | Path | Access | Behavior |
|---|---|---|---|
| `GET` | `/health` | Public | Liveness, `{ "success": true, "status": "live" }` |
| `GET` | `/health/live` | Public | Liveness alias |
| `GET` | `/health/ready` | Public | `200` when MongoDB is connected, otherwise `503` |
| `GET` | `/api/v1/health` | Public | Original API response `{ "success": true, "message": "Service is healthy." }` |

### Authentication

#### `POST /api/auth/register`

Request body:

```json
{
  "name": "Logistics Operator",
  "email": "operator@example.com",
  "password": "Strong-password-123"
}
```

The password must contain at least 12 characters and no more than 72 UTF-8
bytes. Do not include a role.

#### `POST /api/auth/login`

Request body:

```json
{
  "email": "operator@example.com",
  "password": "Strong-password-123"
}
```

Both endpoints return the access token and a safe user object (no password
hash):

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Logistics Operator",
      "email": "operator@example.com",
      "role": "OPERATOR"
    },
    "accessToken": "<JWT>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

Registration responds with HTTP `201` and message `User registered
successfully.`; login responds with HTTP `200`.

### Route optimization

#### `POST /api/routes/optimize` — `ADMIN` or `OPERATOR`

Request:

```json
{
  "originHub": "507f1f77bcf86cd799439011",
  "destinationHub": "507f1f77bcf86cd799439022"
}
```

Both values must be valid MongoDB ObjectId strings and correspond to active
hubs. Response includes the ordered hub and route details and path totals:

```json
{
  "success": true,
  "message": "Route optimized successfully",
  "data": {
    "hubs": [
      {
        "id": "507f1f77bcf86cd799439011",
        "name": "Newark Logistics Hub",
        "code": "EWR",
        "location": { "latitude": 40.6895, "longitude": -74.1745 }
      },
      {
        "id": "507f1f77bcf86cd799439022",
        "name": "New York Logistics Hub",
        "code": "NYC",
        "location": { "latitude": 40.7128, "longitude": -74.006 }
      }
    ],
    "routes": [
      {
        "id": "650000000000000000000001",
        "sourceHub": "507f1f77bcf86cd799439011",
        "destinationHub": "507f1f77bcf86cd799439022",
        "distance": 25,
        "travelTime": 45,
        "fuelCost": 18,
        "trafficCondition": "HIGH",
        "trafficMultiplier": 1.45,
        "status": "AVAILABLE"
      }
    ],
    "totalDistance": 25,
    "totalTravelTime": 65.25,
    "totalFuelCost": 18,
    "totalCalculatedCost": 43.725
  }
}
```

Values above illustrate the response shape; use IDs from your database. The
algorithm returns the lowest weighted score, not necessarily minimum distance
alone. No available path returns `404`.

### Route updates and delivery recalculation

Route mutations require an `ADMIN`. After saving an update, the service
invalidates the route graph cache, synchronously recalculates active
`PLANNED`/`IN_TRANSIT` deliveries, persists changed results, and emits Socket.IO
events. Completed/cancelled deliveries are not changed.

#### `PATCH /api/routes/:routeId/traffic`

```json
{
  "trafficCondition": "HIGH",
  "trafficMultiplier": 1.7
}
```

Allowed conditions are `LOW`, `MEDIUM`, and `HIGH`; multiplier must be finite
and greater than zero.

#### `PATCH /api/routes/:routeId/status`

```json
{
  "status": "BLOCKED"
}
```

Allowed statuses are `AVAILABLE` and `BLOCKED`. To unblock, set status to
`AVAILABLE`. Both endpoints return the updated route and recalculated delivery
list:

```json
{
  "success": true,
  "message": "Route status updated and active deliveries recalculated.",
  "data": {
    "route": {
      "id": "650000000000000000000001",
      "trafficCondition": "HIGH",
      "trafficMultiplier": 1.7,
      "status": "BLOCKED"
    },
    "deliveries": [
      {
        "id": "507f1f77bcf86cd799439099",
        "status": "PLANNED",
        "routeOptimizationStatus": "NO_AVAILABLE_PATH",
        "currentRoute": [],
        "totalDistance": 0,
        "totalTravelTime": 0,
        "totalFuelCost": 0,
        "totalCalculatedCost": 0
      }
    ]
  }
}
```

When no path exists, the path is cleared and the status is
`NO_AVAILABLE_PATH`; a blocked route is never left assigned.

### Cycle detection

#### `GET /api/routes/cycles` — `ADMIN` or `OPERATOR`

Returns all distinct directed simple cycles among active hubs, including route
records whose status is blocked, along with affected hubs:

```json
{
  "success": true,
  "message": "Route cycles detected.",
  "data": {
    "hasCycle": true,
    "cycles": [
      {
        "hubs": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439022", "507f1f77bcf86cd799439011"],
        "routes": ["650000000000000000000001", "650000000000000000000002"]
      }
    ],
    "affectedHubs": [
      { "id": "507f1f77bcf86cd799439011", "name": "Newark Logistics Hub", "code": "EWR" }
    ]
  }
}
```

### Fastest route analytics

#### `GET /api/analytics/fastest-routes` — `ADMIN` or `OPERATOR`

Returns up to five available routes sorted by `travelTime × trafficMultiplier`
ascending. Blocked routes are excluded. The query calculates, sorts, and limits
in MongoDB before joining hub details:

```json
{
  "success": true,
  "message": "Fastest available routes retrieved successfully.",
  "data": [
    {
      "sourceHub": { "id": "507f1f77bcf86cd799439011", "name": "Newark Logistics Hub", "code": "EWR" },
      "destinationHub": { "id": "507f1f77bcf86cd799439022", "name": "New York Logistics Hub", "code": "NYC" },
      "distance": 25,
      "travelTime": 45,
      "effectiveTravelTime": 65.25,
      "fuelCost": 18,
      "trafficCondition": "HIGH"
    }
  ]
}
```

When no available routes exist, the endpoint responds successfully with an empty
`data` array and message `No available routes found.`

### Hub and delivery APIs

Hub and delivery schemas exist, but the mounted hub and delivery routers
currently have no CRUD, list, or detail handlers. There are therefore no hub or
delivery REST endpoints to call or document yet. Hub IDs can be obtained from
MongoDB after seeding or from the `hubs` array returned by route optimization.

## Algorithms

### Dijkstra route optimization

The reusable Dijkstra implementation uses a binary min-heap and considers only
available routes. Each route's effective travel time is
`travelTime × trafficMultiplier`. With default weights, its edge score is:

```text
0.3 × distance + 0.5 × effectiveTravelTime + 0.2 × fuelCost
```

The weights can be supplied as options to the algorithm. All edge components
and weights must be finite and non-negative so Dijkstra's non-negative edge
assumption is satisfied. The result includes ordered hubs, route IDs, distance,
effective travel time, fuel cost, and total score. For `V` hubs and `E` routes,
the heap-based implementation runs in `O((V + E) log(E + 1))` time and uses
`O(V + E)` auxiliary space.

### Cycle detection

Cycle detection is a pure directed-graph DFS with visited and recursion-stack
tracking. It processes disconnected components and canonicalizes cycle starts
to reduce duplicate rotations. It returns paths of hub IDs and route IDs plus
the affected hub IDs. The number of simple cycles can be exponential; the
implementation has `O(V + E log E + P)` time, where `P` counts DFS route
examinations, and `O(V + E + L)` space, where `L` is the output path size.

### Fastest-route aggregation

The analytics pipeline `$match`es `AVAILABLE`, `$addFields` the effective
travel time, `$sort`s and `$limit`s to five routes, then uses `$lookup` to attach
source/destination hub names and codes. It does not load the full route set into
application memory.

## MongoDB indexes and caching

Schemas declare:

- Unique hub `code` and an `isActive` index.
- Route `{ sourceHub: 1, destinationHub: 1 }` and
  `{ status: 1, sourceHub: 1, destinationHub: 1 }` indexes.
- Delivery `{ status: 1, _id: 1 }` for active-delivery scans and
  `{ originHub: 1, destinationHub: 1 }`.
- Unique user email.

Route graph reads project only needed fields and use `lean()`. The in-process
graph cache coalesces concurrent misses and defaults to a 30-second TTL.
`ROUTE_GRAPH_CACHE_TTL_MS=0` disables it. Traffic/status updates invalidate the
cache after successful route persistence; in-flight reads detect a revision
change and reload. Cache invalidation is process-local: in multi-instance
deployments use a shared invalidation signal (for example Redis Pub/Sub) or
disable caching to avoid another instance using its graph until TTL expiry.

Active delivery recalculation uses a projected, lean query, skips unchanged
deliveries, and persists changed records using ordered batches of up to 500
`bulkWrite` updates. This limits per-record database calls while retaining
synchronous MVP behavior.

## Real-time updates

Socket.IO shares the HTTP server and authenticates handshake tokens using the
same checks as REST requests. Supply `auth: { token: "<JWT>" }` or an
`Authorization: Bearer <JWT>` header during connection. The server emits:

- `route:traffic-updated`
- `route:blocked`
- `route:available`
- `delivery:route-recalculated`

For multi-instance deployments, a Socket.IO Redis Adapter broadcasts across
instances; it does not distribute route graph cache invalidations. Default
Socket.IO polling may also require load-balancer sticky sessions, unless clients
and infrastructure use WebSocket-only transport.

## Background processing and production scaling

The current route-update endpoints intentionally recalculate synchronously.
`recalculateActiveDeliveries` is reusable from a worker and supports an optional
delivery-event callback. If synchronous work causes excessive request latency,
enqueue recalculation jobs through BullMQ/Redis after route updates. Workers can
process bounded batches, retry transient failures, and use an idempotency key
such as route ID plus update version. The API can then return an
accepted/in-progress response; workers persist the outcome and publish
completion events. BullMQ and Redis are not dependencies of the MVP.

The included multi-stage, non-root `Dockerfile` builds the TypeScript service:

```sh
docker build -t nesa-logistics .
docker run --rm --env-file .env -p 3000:3000 nesa-logistics
```

Use a MongoDB hostname reachable from the container, not `localhost` unless
MongoDB shares the container network appropriately. In production, run replicas
behind a load balancer, configure `/health/ready` for readiness and
`/health/live` for liveness, keep JWT secrets outside images, size MongoDB pools
for total replicas, and monitor database, cache, queue, and socket health. The
server handles `SIGINT`/`SIGTERM`, closes sockets and MongoDB, and treats
uncaught exceptions and unhandled rejections as fatal after logging and
initiating bounded graceful shutdown.

## Postman

Import both files from `postman/`:

- `Nesa Logistics.postman_collection.json`
- `Nesa Logistics Local.postman_environment.json`

Select the imported local environment, set `baseUrl`, and run the health check.
Register or log in; the collection's auth requests save `accessToken`
automatically. Set `originHubId` and `destinationHubId` to real IDs after
seeding (hub IDs are generated by MongoDB). The supplied hub IDs are examples
from the local development database and may need to be replaced in another
database. The deterministic route IDs are fixed by the seed and are provided
as sample variables. Route updates need an `ADMIN` token; public registration
creates an `OPERATOR`, so use a trusted administrator account for those
requests.

The collection includes all implemented API requests. Hub and delivery folders
are included as clearly marked placeholders only: those routers currently have
no endpoints, so no fictitious operations are included.
