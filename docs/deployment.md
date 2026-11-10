# MS2 production deployment

The image is `docker.io/dental/ms2-clinico-ia:prod` (linux/amd64). It listens on port 8002. Kubernetes liveness uses `GET /api/expediente/health`; readiness uses `GET /api/expediente/health/ready` and requires a connected MongoDB. MongoDB must support transactions (a replica set).

## Environment variable names

Configure these through the deployment's environment and secret mechanism; never commit their values. The following names come from `src/config/env.validation.ts`:

- Server and database: `PORT`, `HOST`, `CORS_ORIGINS`, `MONGODB_URI`.
- Integration selection: `PACIENTE_VALIDATOR_ADAPTER`, `CATALOGO_SERVICIOS_ADAPTER`, `CITA_VALIDATOR_ADAPTER`, `RABBITMQ_PUBLISHER_ADAPTER`, `ODONTOLOGO_AUTH_ADAPTER`.
- MS1: `MS1_GRAPHQL_URL`, `MS1_TIMEOUT_MS`, `MS1_BEARER_TOKEN`.
- MS3: `MS3_HTTP_URL`, `MS3_TIMEOUT_MS`, `MS3_BEARER_TOKEN`.
- Authentication: `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_ISSUER`, `KEYCLOAK_PUBLIC_KEY`, `JWT_SECRET`.
- Messaging and relay: `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_ROUTING_KEY`, `OUTBOX_RELAY_ENABLED`, `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`.

Set applicable endpoints, credentials, issuer, audience and CORS for the production environment. Bearer tokens and optional authentication keys should be supplied only when required by the selected integration. Relay configuration requires a reachable RabbitMQ when enabled.

Four integrations default to mocks: set `PACIENTE_VALIDATOR_ADAPTER=graphql`, `CATALOGO_SERVICIOS_ADAPTER=graphql`, `CITA_VALIDATOR_ADAPTER=http`, and `RABBITMQ_PUBLISHER_ADAPTER=amqp` for real integrations. `ODONTOLOGO_AUTH_ADAPTER` defaults to `keycloak`; keep it as `keycloak` for production. Defaults are not changed by the image.

The image additionally sets `DENTAL_MODEL_PATH` to the SHA-256-verified ONNX model. The model is licensed CC-BY-NC-4.0 (non-commercial use only); verify licensing before production use.

## Radiograph storage

Study attachment endpoints receive files in memory and save metadata including a constructed `/uploads/estudios/<originalname>` URL, not the uploaded file bytes (`src/modules/estudios/infrastructure/http/controllers/estudios.controller.ts:116-135,152-188`; metadata persistence: `src/modules/estudios/infrastructure/persistence/mongo/repositories/mongo-solicitud-estudio.repository.ts:41-46`). Separately, clinical studies can save `imagenBase64` in MongoDB (`src/modules/estudio-clinico/infrastructure/http/controllers/estudio-clinico-ia.controller.ts:198-213`). No S3 storage is provided by this deployment.
