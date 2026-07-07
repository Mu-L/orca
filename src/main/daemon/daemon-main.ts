import { DaemonServer, type DaemonServerOptions } from './daemon-server'

export type DaemonStartOptions = {
  socketPath: string
  tokenPath: string
  spawnSubprocess: DaemonServerOptions['spawnSubprocess']
  onIdleExit?: DaemonServerOptions['onIdleExit']
  idleExitGraceMs?: DaemonServerOptions['idleExitGraceMs']
}

export type DaemonHandle = {
  shutdown(): Promise<void>
}

export async function startDaemon(opts: DaemonStartOptions): Promise<DaemonHandle> {
  const server = new DaemonServer({
    socketPath: opts.socketPath,
    tokenPath: opts.tokenPath,
    spawnSubprocess: opts.spawnSubprocess,
    onIdleExit: opts.onIdleExit,
    idleExitGraceMs: opts.idleExitGraceMs
  })

  await server.start()

  return {
    shutdown: () => server.shutdown()
  }
}
