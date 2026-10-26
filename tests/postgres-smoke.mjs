if(!process.env.FARMAKON_TEST_DATABASE_URL)throw new Error('Set FARMAKON_TEST_DATABASE_URL to a dedicated loopback farmakon_v2_test database; DATABASE_URL is never used');
await import('./backend-smoke.mjs');
