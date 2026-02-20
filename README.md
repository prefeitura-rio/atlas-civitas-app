# CIVITAS Map
Frontend do painel de mapa (câmeras, radares e camadas civitas) usando React + Vite + Mapbox GL.

## Requisitos
- Node.js 18+
- Token do Mapbox
- API backend rodando (por padrão em `http://localhost:8000`)

## Configuração
Crie um arquivo `.env` na raiz:

```
VITE_MAPBOX_TOKEN=seu_token_aqui
VITE_API_URL=http://localhost:8000
```

## Como rodar
```
npm install
npm run dev
```

Acesse: `http://localhost:3000`

## Rodar com Docker
### Build e run com Docker CLI
```bash
docker build \
  --build-arg VITE_API_URL=http://localhost:8000 \
  --build-arg VITE_MAPBOX_TOKEN=seu_token_aqui \
  -t civitasmap-frontend .

docker run --rm -p 3000:80 civitasmap-frontend
```

Acesse: `http://localhost:3000`

### Rodar com Docker Compose
1. Defina no `.env` (ou variáveis no shell):
```bash
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=seu_token_aqui
# opcional (default 3000)
# FRONTEND_PORT=3000
```
2. Suba o container:
```bash
docker compose up --build -d
```
3. Acesse em `http://localhost:3000`

## Funcionalidades principais
- Camadas no mapa: Câmeras, Radares, Câmeras Inteligentes e LPR
- Busca por endereço ou coordenadas (restrita ao RJ)
- Pin de busca temporário no mapa
- Dock de controles com toggles de camadas
- Admin com CRUD de usuários e sincronizações
