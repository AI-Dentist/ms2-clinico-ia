<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository for MS2 (Atención Clínica, Expedientes Odontológicos e Inteligencia Artificial).

## Authentication & JWT Security Policy

MS2 validates incoming Bearer JWT tokens via `KeycloakJwtOdontologoContextAdapter` against the platform's Keycloak identity provider or configured public key.

### Configuration Variables

| Variable Name | Required | Default Value | Description / Synthetic Public Example |
|---|---|---|---|
| `KEYCLOAK_URL` | No | `http://localhost:8080` | Base URL of Keycloak instance (e.g. `http://localhost:8080` or `https://auth.example.com`). |
| `KEYCLOAK_REALM` | No | `dental-platform` | Realm name containing clinical practitioners and roles (e.g. `dental-platform`). |
| `KEYCLOAK_ISSUER` | No | `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}` | Trusted token issuer (`iss` claim). Synthetic example: `http://localhost:8080/realms/dental-platform`. |
| `KEYCLOAK_AUDIENCE` | No | `ms2-clinico-ia` | Target resource audience (`aud` claim). Must match `ms2-clinico-ia` exactly or be present in the audience list. **Resource audience is never the realm name**. |
| `KEYCLOAK_PUBLIC_KEY` | No | `undefined` | Optional RS256 SPKI public key PEM for offline verification without JWKS. |
| `JWT_SECRET` | No | `undefined` | Optional HS256 symmetric secret for test environments. |

### Strict Claims Enforcement
- **Issuer (`iss`)**: Tokens must be issued by the configured trusted issuer. Mismatched or absent `iss` claims are rejected immediately.
- **Audience (`aud`)**: The token must explicitly target `ms2-clinico-ia` (as a string or within an array of audiences). Tokens targeted solely to the realm (e.g. `dental-platform`) or other microservices without `ms2-clinico-ia` are rejected.
- **Fail-Closed Policy**: Claim validation failures throw `AutenticacionRequeridaError` (HTTP 401) immediately and never degrade to weaker fallback or unverified decoding.

## Canonical Practitioner Resolution (MS1 Identity Integration)

In this microservice architecture, Keycloak manages user identities (`sub: UUID`), while MS1 (ERP) manages master practitioner records (`odontologoId: UUID`).

- **Query Contract**: MS2 resolves the canonical practitioner ID via `GraphqlMs1CanonicalDoctorResolverAdapter` executing:
  ```graphql
  query ObtenerMiOdontologoId {
    obtenerMiOdontologoId
  }
  ```
- **Caller Token Forwarding**: The incoming caller's validated Bearer token is strictly forwarded (`Authorization: Bearer <token>`) to `MS1_GRAPHQL_URL`. Static service tokens (`MS1_BEARER_TOKEN`) are **never** used for self-identity.
- **Identity Decoupling**: Resolves `sub != doctorPK`. The canonical doctor UUID returned by MS1 is stored in the clinical entity as `odontologoId` and emitted in flat messages for billing (`ConsultaFinalizadaMensajePlanoDto`), while the authenticated user subject (`sub`) is preserved as `keycloakSubject` for distinct audit semantics.
- **Fail-Closed Guarantee**: Missing, null, unlinked, inactive, non-UUID, timeout, network or HTTP/GraphQL errors fail closed immediately (HTTP 401), preventing any write to the clinical repository or transactional outbox.
- **Historical Record Limitation**: Historical records created prior to this integration retain their immutable stored values; existing documents are not migrated or rewritten. Newly opened consultations strictly enforce and store the canonical practitioner UUID.

## Doctor Context Provider Wiring & Lazy Secure Resolution

In clinical modules (`OdontogramasModule`, `ConsultasOdontologicasModule`, `HistoriasClinicasModule`, and `EstudiosModule`), the practitioner identity context port (`ODONTOLOGO_CONTEXT_PORT`) dynamically selects the concrete adapter based on `ODONTOLOGO_AUTH_ADAPTER`:

- **Production Mode (`ODONTOLOGO_AUTH_ADAPTER=keycloak`)**:
  - Resolves strictly to `KeycloakJwtOdontologoContextAdapter`.
  - **Lazy Wiring**: The synthetic `MockOdontologoContextAdapter` is **never** registered in Nest DI `providers` or `inject` arrays, ensuring Nest DI never constructs the mock class or triggers its security environment checks during application startup.
- **Unset Adapter Defaults**:
  - `ConsultasOdontologicasModule`, `HistoriasClinicasModule`, and `EstudiosModule` default to `'keycloak'` when unset, safely resolving Keycloak in production.
  - `OdontogramasModule` retains a different unset-adapter behavior: it requires explicit `ODONTOLOGO_AUTH_ADAPTER=keycloak`; when unset, it routes to mock resolution which fails closed in non-development environments.
- **Development & Testing Mode (`ODONTOLOGO_AUTH_ADAPTER=mock`)**:
  - Lazily instantiates `MockOdontologoContextAdapter` only after verifying `NODE_ENV` is explicitly `'development'` or `'test'`.
  - In `production`, `staging`, or unconfigured (`undefined`) environments, any attempt to select the mock fails closed immediately with `CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad`.

## Appointment Validation & Rescheduled Appointments (MS3 Integration - S4)

In coordination with MS3 (Agendamiento & Stock):
- **Rescheduled Eligibility (`REPROGRAMADA`)**: Appointments in state `REPROGRAMADA` are eligible to initiate clinical consultation directly without additional confirmation, provided the patient ID matches the clinical record.
- **Valid Attention States**: `RESERVADA`, `CONFIRMADA`, `EN_ATENCION`, `PROGRAMADA`, `PENDIENTE`, and `REPROGRAMADA`.
- **Closed / Invalid States**: Appointments in states `CANCELADA`, `COMPLETADA`, `NO_ASISTIO`, or unknown states are rejected with descriptive reasons and leave clinical storage and outbox state unchanged.
- **Patient Titularity Matching**: The appointment must belong to the patient titular of the clinical record; mismatches are strictly rejected.

## AI Dental Image Diagnostic & Clinical Studies (Task T4 — Specs S8 & S9)

Deep Learning inference pipeline and clinical study persistence for dental radiograph and intraoral image analysis.

### Model Source & License Attribution
- **Model**: [`liodon-ai/dental-panoramic-detector`](https://huggingface.co/liodon-ai/dental-panoramic-detector) (`best.onnx`, YOLO11-N architecture).
- **License**: **CC-BY-NC-4.0** (Creative Commons Attribution-NonCommercial 4.0 International).
  - *Attribution*: Liodon AI dental panoramic detector dataset and YOLO11 weights.
  - *Non-Commercial*: Authorized for portfolio, educational, research, and non-commercial dental ERP platform demonstration.
- **Input Resolution**: 640×640 RGB (letterboxed with standard padding value `114/255`, normalized `[0, 1]` via TensorFlow.js / sharp).
- **Detection Classes**:
  1. `caries` → mapped to canonical domain label `caries_interproximal_o_oclusal`
  2. `periapical_lesion` → mapped to canonical domain label `lesion_periapical`
  3. `impacted_tooth` → mapped to canonical domain label `pieza_retenida_o_impactada`
- **Explicitly Unsupported Labels**:
  - `reabsorcion_osea_periodontal`
  - `restauracion_o_endodoncia_previa`
  (Declared in `etiquetasNoSoportadas: [...]`; never synthesized or hallucinated).
- **Normal Structure Policy (`estructura_normal`)**:
  - Emitted only when no bounding boxes exceed the confidence threshold (`0.45`).
  - Text explicitly clarifies: *"sin hallazgos detectados por el modelo — no constituye una confirmación clínica"*.
- **Clinical Limitations & Medical Disclaimer**:
  - **Decision Support Only**: This model operates as clinical decision support for licensed dental professionals and does not constitute a definitive medical diagnosis. Clinical exploration, probing, and dentist validation are always required.

### Model Download & Verification Script (Integrity & Dual SHA-256 Check)
Model weights (`best.onnx`, 10.1 MB) are gitignored under `models/dental-panoramic/`.
Run the automated downloader to fetch and verify the pinned SHA-256:
```bash
node scripts/fetch-dental-model.mjs
```
- **Pinned SHA-256**: `4cee38b54203634d895ed30a8910f5d7c4cefe22b18f9116b5561d9dd6e83a71`
- **Environment Variables**:
  - `DENTAL_MODEL_PATH`: Location of the model file (defaults to `models/dental-panoramic/best.onnx`).
  - `DENTAL_MODEL_SHA256`: Expected SHA-256 anchor (defaults to pinned hash).
  - `DENTAL_MODEL_URL`: Optional download URL override (strictly requires `DENTAL_MODEL_SHA256`).
- **Downloader Integrity Verification (`scripts/fetch-dental-model.mjs`)**: Compares the downloaded file against the pinned constant. On mismatch, deletes the downloaded file and exits non-zero. It never writes a hash computed from the received file as the trust anchor.
- **Runtime Model Integrity Verification (`DentalOnnxModelService`)**: Computes the SHA-256 of the model file prior to initializing the ONNX inference session and checks against `DENTAL_MODEL_SHA256` (default: pinned hash). If missing or mismatched, session creation is refused, no fallback model is used, and inference fails closed with HTTP 503 `MODELO_NO_DISPONIBLE`.

### Public REST Endpoints (`/api/expediente/estudios`)

All active endpoints are protected by `OdontologoAuthGuard` and `RolesGuard` (`ODONTOLOGO`, `ADMIN`):

1. **`POST /api/expediente/estudios/analizar-imagen`**
   - **Payload**: Multipart `archivo` (JPEG, PNG, WebP) OR JSON `{ imagenBase64, mimeType }`.
   - **Response**: `AnalisisImagenIaDto` (`hallazgos[]`, `etiquetasNoSoportadas`, `confianzaGlobal`, `severidadMaxima`, `aviso`).
   - **Max file size**: Up to 25 MB supported.

2. **`POST /api/expediente/estudios/analizar-radiografia`**
   - Backward-compatible alias for `POST /api/expediente/estudios/analizar-imagen` delegating to YOLO11 ONNX inference.

3. **`POST /api/expediente/estudios`**
   - Persists a new `EstudioClinico` in MongoDB.
   - **Security Guarantee**: `odontologoId` is strictly extracted from the authenticated JWT context (`req.odontologoActual.odontologoId`). Any value passed in the request body is ignored.
   - Supports storing base64 image data up to 25 MB.

4. **`GET /api/expediente/estudios/paciente/:pacienteId`**
   - Retrieves clinical study history for a patient, ordered by `creadoEn: -1`.
   - **Performance Optimization**: Automatically projects out the heavy `imagenBase64` field (`select('-imagenBase64')`) to keep list responses lightweight.

### Retired Legacy Endpoint (`/api/expediente/ia/analizar-radiografia`)

- **`POST /api/expediente/ia/analizar-radiografia`** has been **permanently retired** (`HTTP 410 Gone`).
- The untrained random-weight CNN (`CnnDentalModelService` / `AnalizarRadiografiaUseCase`) was completely excised from production paths.
- Responds with `HTTP 410 Gone` and exact payload without reading or analyzing the uploaded image:
  ```json
  {
    "error": "LEGACY_MODEL_RETIRED",
    "detail": "The untrained CNN endpoint was retired; use the trained detector.",
    "replacement": "/api/expediente/estudios/analizar-imagen"
  }
  ```

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### Native Node ESM Smoke Check

Verifies Node.js native ESM startup compatibility without bootstrapping the full NestJS application, database connections, or requiring `.env` files:

```bash
# 1. Build production artifacts (prerequisite)
$ npm run build

# 2. Run native ESM import smoke check
$ npm run check:native-esm
# or directly:
$ node scripts/check-native-esm.mjs
```

- **Prerequisite**: Compiled artifacts must exist in `./dist` (fails with exit code 1 and actionable guidance if missing).
- **Exit Behavior**:
  - Exit `0`: Native dynamic ESM import of production modules (`MongoUnitOfWorkCierreConsultaAdapter`, `AppModule`) succeeded.
  - Exit `1`: SyntaxError, missing build artifacts, or CommonJS interop named export failure detected.
- **Safety**: Pure offline import check; does not initiate HTTP listeners, database connections, or background relays.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
