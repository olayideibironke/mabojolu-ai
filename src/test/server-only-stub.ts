/**
 * Test stub for the `server-only` marker package.
 *
 * `server-only` exists to make importing a server module from a Client
 * Component a build error. That guard is enforced by the Next bundler, which
 * Vitest does not run, so the bare import fails to resolve under test.
 *
 * Aliasing it to this empty module lets server modules be unit tested while the
 * real guard stays fully in force in `next build`. The protection is not
 * weakened: the alias applies only to the Vitest config.
 */
export {};
