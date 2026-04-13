import http from 'node:http';

function createServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pid: process.pid, port, mode: process.env.SF_MODE }));
    });
    server.listen(port, () => {
      console.log(`Server running on port ${port}, PID: ${process.pid}`);
      resolve(server);
    });
  });
}

export default async ({ mode }) => {
  const port = 4444;

  if (mode === 'with-signal-handling') {
    const server = await createServer(port);

    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed gracefully.');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed gracefully.');
        process.exit(0);
      });
    });

    // Keep process alive
    await new Promise(() => {});

  } else if (mode === 'without-signal-handling') {
    const server = await createServer(port);

    // No signal handlers — relies on shell-flow to force kill
    // Keep process alive
    await new Promise(() => {});

  } else if (mode === 'long-running') {
    const server = await createServer(port);

    // Simulate heavy work — ignores SIGTERM (only SIGKILL can stop it)
    let counter = 0;
    setInterval(() => {
      counter++;
      // Busy work to simulate a process that won't stop gracefully
      const start = Date.now();
      while (Date.now() - start < 100) { /* busy loop */ }
      if (counter % 10 === 0) {
        console.log(`Long-running task iteration: ${counter}`);
      }
    }, 200);

    // Keep process alive
    await new Promise(() => {});

  } else {
    console.log(`Unknown mode: ${mode}`);
    process.exit(1);
  }
}