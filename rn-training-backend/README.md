# rn-training-backend

Simple mock backend for React Native training (axios / react-query). No database — data is stored in JSON files under `data/`.

Quick start

1. Install dependencies:

```bash
cd rn-training-backend
npm install
```

2. Run the server:

```bash
npm start
```

When starting, the server will prompt for your name. Enter the name you want displayed in `GET /profile`.

Replace profile image

- Put your image file as `profile.png` or `profile.jpg` inside the `public/` folder of this project. Example path:

  `rn-training-backend\public\profile.png`

- The server returns a full `imageUrl` in `GET /profile` (e.g. `http://localhost:3000/public/profile.ppg`). The server prefers `profile.jpg`, then `profile.png`. If neither exists `imageUrl` will be `null`.

Endpoints

- `GET /places` — list of mock places
- `GET /places/:id` — place detail; hitting this endpoint will save the place into recently-viewed
- `GET /recently-viewed` — returns last 2 recently viewed items (with place details)
- `GET /profile` — returns `{ name, imageUrl }` using the name entered at startup

API docs

You can view a simple Swagger UI for the API at `http://localhost:3000/docs` after installing dependencies and starting the server.

Examples

- Search for beaches with keyword "kelingking" and paginate (page 1, 5 items):

  `GET /places?q=kelingking&category=beach&page=1&limit=5`

- Editor's pick (top-rated places):

  `GET /editors-pick` — returns a single top-rated place by default


- Onboarding (random selection for onboarding cards):

  `GET /onboarding` — returns a single random place by default

Notes for frontend training

- Use `axios` or `react-query` to call these endpoints.
- The server includes a `fakeLoading` middleware that adds a small random delay to responses to simulate network latency.
