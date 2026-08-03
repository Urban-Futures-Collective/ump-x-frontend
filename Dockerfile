FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# BASE_URL muss zur BUILD-Zeit gesetzt sein: nuxt-oidc-auth setzt authorizationUrl/tokenUrl/
# userInfoUrl/logoutUrl im Modul-Setup aus dieser Variable zusammen (module.mjs) und legt sie
# als eigene runtimeConfig-Keys ab. Zur Laufzeit gesetzt kommt sie zu spät — die Keys existieren
# dann nicht und der Preset-Fallback ist ein RELATIVER Pfad ("protocol/openid-connect/auth"),
# d.h. der Login-Redirect landet auf der eigenen Domain statt bei Keycloak.
# Alle anderen NUXT_OIDC_*-Werte (Client-Secret, Redirect-URIs, Session-Secrets) sind normale
# runtimeConfig-Keys und werden zur Laufzeit gesetzt — siehe docs/deployment.md.
ARG NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL=https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform
ENV NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL=$NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=6500

COPY --from=builder --chown=node:node /app/.output ./.output

EXPOSE 3000

USER node

CMD ["node", ".output/server/index.mjs"]
