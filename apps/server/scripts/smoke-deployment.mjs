import assert from "node:assert/strict"
import { fork } from "node:child_process"
import { once } from "node:events"
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"

const packageDir = resolve(process.argv[2] ?? "deploy-package")
const { apps } = createRequire(import.meta.url)(
  join(packageDir, "ecosystem.config.cjs")
)
const directory = await mkdtemp(join(tmpdir(), "folio-deployment-smoke-"))

try {
  // Match the uploaded artifact: no workspace node_modules or real credentials.
  await cp(packageDir, directory, { recursive: true })
  const origin = "https://smoke.folio.invalid"
  await writeFile(
    join(directory, ".env"),
    [
      "DATABASE_URL=postgresql://probe:probe@127.0.0.1:9/probe",
      "BETTER_AUTH_SECRET=synthetic-startup-probe-secret-1234567890",
      "BETTER_AUTH_URL=http://localhost:3000",
      `CORS_ORIGIN=${origin}`,
      "JAPANESE_ANALYZER_ENABLED=false"
    ].join("\n")
  )

  for (const app of apps) {
    await test(
      `${app.name} starts using only its .env file`,
      {
        timeout: 15_000
      },
      async (t) => {
        const reservation = createServer().listen(0, "127.0.0.1")
        await once(reservation, "listening")
        const { port } = reservation.address()
        await new Promise((resolve) => reservation.close(resolve))

        const child = fork(resolve(directory, app.script), [], {
          // PM2 cluster workers initially inherit the daemon's working directory.
          cwd: app.exec_mode === "cluster" ? tmpdir() : directory,
          execArgv: app.node_args
            .split(/\s+/)
            .map((argument) => argument.replace(app.cwd, directory)),
          // Critical settings must come from .env, never the CI runner's environment.
          env: {
            NODE_ENV: "production",
            PORT: String(port),
            COLLAB_PORT: String(port)
          },
          silent: true
        })
        let output = ""
        const collectOutput = (data) => {
          output = (output + data).slice(-16_000)
        }
        child.stdout.on("data", collectOutput)
        child.stderr.on("data", collectOutput)
        t.after(async () => {
          if (child.exitCode !== null || child.signalCode !== null) return
          const exited = once(child, "exit")
          child.kill("SIGTERM")
          const forceStop = setTimeout(() => child.kill("SIGKILL"), 2000)
          await exited
          clearTimeout(forceStop)
        })

        const ready = once(child, "message")
        const exited = once(child, "exit").then(([code, signal]) => {
          throw new Error(`${app.name} exited (${code ?? signal}):\n${output}`)
        })
        const [message] = await Promise.race([ready, exited])
        assert.equal(message, "ready")

        if (app.name === "folio-server") {
          const baseURL = `http://127.0.0.1:${port}`
          const health = await fetch(`${baseURL}/health`, { signal: t.signal })
          assert.equal(health.status, 200)
          const healthBody = await health.json()
          assert.equal(healthBody.status, "ok")

          const preflight = await fetch(`${baseURL}/rpc/entries/list`, {
            method: "OPTIONS",
            headers: {
              Origin: origin,
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "content-type"
            },
            signal: t.signal
          })
          assert.equal(preflight.status, 204)
          assert.equal(
            preflight.headers.get("access-control-allow-origin"),
            origin
          )
          assert.equal(
            preflight.headers.get("access-control-allow-credentials"),
            "true"
          )
        }
      }
    )
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}
