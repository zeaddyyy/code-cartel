# Security baseline

RTSP URLs and credentials belong only to the AI/backend side; the browser must
use HLS or WebRTC preview metadata and never receive RTSP credentials. Helmet
is enabled on the API. Production deployment should add authenticated RBAC
roles (ADMIN, OPERATOR, ANALYST, VIEWER), TLS termination, rate limits,
immutable audit logs, secret-manager integration, least-privilege database
roles, and network separation between camera, inference, API, and operator
zones. Sentinel access is read-only and the service never publishes streams.
