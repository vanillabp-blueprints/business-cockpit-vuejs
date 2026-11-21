import { createSimulatorServer } from './server.ts';

const port = Number(process.env.SIMULATOR_PORT ?? 8090);
const { server } = createSimulatorServer();
server.listen(port, () => console.log(`Simulator of the cockpit listens on http://localhost:${port}`));
