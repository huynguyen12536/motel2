# Future messaging contracts

No queues or business messages exist in Phase 1.
Before adding consumers, define versioned contracts and durable queues, publisher confirms,
manual acknowledgement, dead-letter/retry routing, bounded prefetch and idempotency keys.
Connection recovery currently uses a bounded interval; future channels must be recreated after reconnect.
