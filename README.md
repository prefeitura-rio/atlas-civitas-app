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
VITE_API_BASE_URL=http://localhost:8000
```

## Como rodar
```
npm install
npm run dev
```

Acesse: `http://localhost:5173`

## Funcionalidades principais
- Camadas no mapa: Câmeras, Radares, Câmeras Inteligentes e LPR
- Busca por endereço ou coordenadas (restrita ao RJ)
- Pin de busca temporário no mapa
- Dock de controles com toggles de camadas
- Admin com CRUD de usuários e sincronizações
