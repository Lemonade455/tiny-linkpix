# Tiny-LinkPix

En lätt, självhostad bilduppladdare med **egna URL-sluggar**  
→ `https://din.domän/min-bild`

## Funktioner
- Token-skyddad uppladdning (`UPLOAD_TOKEN`)
- Egna slugs: `https://BASE_URL/:slug`
- SQLite-databas (persistens)
- MIME- och storleksvalidering
- Rate-limiting, Helmet, loggning
- Multi-arch (amd64/arm64) – funkar på Raspberry Pi 5

## Snabbstart (Docker Compose)
```bash
docker compose up --build -d
```

Öppna: `http://localhost:8080`

## API
**POST /api/upload**
- Body: `token`, `slug`, `file` (multipart) – alternativt header `x-upload-token`
- Svar: `{ ok: true, url: "https://BASE_URL/:slug" }`

## Miljövariabler
Se `.env.example`

## Hälsa
`GET /healthz` → `{ ok: true }`

## License
MIT
