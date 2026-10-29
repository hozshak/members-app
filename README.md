# Members – die App zur Mitglieder-Software

Native App (React Native, Expo SDK 58) für alle Installationen der Mitglieder-Software (`C:/Projekte/mitglieder-software`).
Beim ersten Start wählt man die Community, danach meldet man sich mit E-Mail und Passwort der Website an.

## Wie die App mit der Software spricht

- Dieselben Schnittstellen wie der Mitgliederbereich der Website (`/api/member/…`).
- Anmeldung: `POST /api/auth/login` mit `X-Client: members-app` liefert den Sitzungs-Token (kein Cookie). Die App legt ihn
  im sicheren Speicher des Handys ab und schickt ihn als `Authorization: Bearer …` – auch bei Bildern und Videos.
  Gegenstück in der Software: `worker/core/lib/app-client.ts` (ab Commit 4bc2188). **Ältere Installationen kennen das
  nicht** – erst die Software aktualisieren.
- Videos: wie auf der Website ein Stream-Token pro Video (`…/play`), Fortschritt alle 15 s, 90-%-Regel für „erledigt“.
- Kaufen, Preise und Abos gibt es in der App bewusst nicht (Apple-Regeln für In-App-Käufe).

## Entwickeln am PC

Drei Server (Konfiguration in `C:/install/.claude/launch.json`):

1. `mitglieder-api` – die Software lokal auf Port 8788 (Testdaten aus dem E2E-Lauf in `.wrangler/e2e-state`)
2. `members-expo` – Expo/Metro auf Port 8081
3. `members-app` – `scripts/dev-proxy.mjs` auf Port 8090: App und Software unter einer Adresse

Dann im Browser `http://localhost:8090` öffnen und als Adresse `http://localhost:8090` eingeben. Videos laufen im Browser
nicht (er kann den Login nicht mitschicken) – auf dem Handy schon.

## Auf dem Handy testen (Expo Go)

`npx expo start --tunnel` im Projektordner, dann den QR-Code mit der App „Expo Go“ scannen (iPhone: Kamera-App).

## Prüfen

```bash
npx tsc --noEmit
npx expo lint
```
