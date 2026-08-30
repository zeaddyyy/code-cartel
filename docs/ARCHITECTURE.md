# Architecture

Discovery, stream transport, inference, event processing, persistence, and presentation are separate concerns. Camera workers are isolated so a failed stream cannot terminate others. PostgreSQL/PostGIS stores durable truth; Redis is for ephemeral state; Kafka is the production event-bus target.
