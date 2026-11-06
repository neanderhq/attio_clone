import application from './.open-next/worker.js';

export default {
  async fetch(request, env, ctx) {
    const databaseDisposers = [];
    const requestContext = {
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException: ctx.passThroughOnException.bind(ctx),
      props: ctx.props,
      exports: ctx.exports,
      databaseDisposers,
    };
    try {
      return await application.fetch(request, env, requestContext);
    } finally {
      // These clones access PostgreSQL in API handlers, not deferred SSR streams.
      ctx.waitUntil(Promise.all(databaseDisposers.map(dispose => dispose())));
    }
  },
};
