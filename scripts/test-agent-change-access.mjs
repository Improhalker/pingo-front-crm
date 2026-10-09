// Production HTTP integration fixture. The session API is simulated; no real accounts or database are used.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../', import.meta.url))
const serve = process.argv.includes('--serve')
const fixtureOrigin = 'http://127.0.0.1:4310'
const cookieName = 'agent-change-test-role'
const source = JSON.parse(
  await readFile(join(root, 'data/agent-changes.json'), 'utf8'),
)
const mock = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', fixtureOrigin)
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-XSRF-TOKEN, X-Requested-With',
  )
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end()
    return
  }
  const role = request.headers.cookie?.match(
    /(?:^|; )agent-change-test-role=(\w+)/,
  )?.[1]
  const user = (selected) => ({
    data: {
      id: 'fixture-only',
      name:
        selected === 'master' ? 'Master de teste' : 'Administrador de teste',
      email: `${selected}@test.invalid`,
      is_platform_administrator: selected === 'master',
      organizations: [],
    },
  })
  const reply = (status, value) => {
    response.statusCode = status
    response.end(JSON.stringify(value))
  }
  if (request.url === '/sanctum/csrf-cookie') {
    response.setHeader(
      'Set-Cookie',
      'XSRF-TOKEN=fixture-csrf; Path=/; SameSite=Lax',
    )
    response.writeHead(204).end()
    return
  }
  if (request.url?.endsWith('/auth/login') && request.method === 'POST') {
    const buffers = []
    for await (const chunk of request) buffers.push(chunk)
    const input = JSON.parse(Buffer.concat(buffers).toString('utf8'))
    const selected =
      input.email === 'master@test.invalid'
        ? 'master'
        : input.email === 'admin@test.invalid'
          ? 'admin'
          : undefined
    if (
      !selected ||
      input.password !== 'fixture-only' ||
      (request.url.includes('/platform/') && selected !== 'master')
    ) {
      reply(422, { message: 'Credenciais de teste inválidas.' })
      return
    }
    response.setHeader(
      'Set-Cookie',
      `${cookieName}=${selected}; HttpOnly; Path=/; SameSite=Lax`,
    )
    reply(200, user(selected))
    return
  }
  if (request.url === '/api/v1/auth/logout') {
    response.setHeader(
      'Set-Cookie',
      `${cookieName}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax`,
    )
    reply(200, { data: { message: 'Sessão de teste encerrada.' } })
    return
  }
  if (request.url === '/api/v1/auth/me') {
    if (role === 'down') {
      reply(503, {})
      return
    }
    if (!['master', 'admin', 'operator'].includes(role)) {
      reply(401, {})
      return
    }
    reply(200, user(role))
    return
  }
  if (request.url?.startsWith('/api/v1/platform/organizations')) {
    if (role !== 'master') {
      reply(403, {})
      return
    }
    reply(200, {
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    })
    return
  }
  reply(404, {})
})

let frontend
async function stop() {
  frontend?.kill()
  mock.closeAllConnections()
  await new Promise((resolve) => mock.close(resolve))
}
try {
  await new Promise((resolve, reject) => {
    mock.once('error', reject)
    mock.listen(0, '127.0.0.1', resolve)
  })
  const apiBase = `http://127.0.0.1:${mock.address().port}`
  frontend = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '4310',
      PORT: '4310',
      NUXT_PUBLIC_API_BASE: apiBase,
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let startupError = ''
  frontend.stderr.on('data', (chunk) => {
    startupError += chunk.toString()
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(new Error(`Production fixture did not start: ${startupError}`)),
      15000,
    )
    frontend.once('error', reject)
    frontend.once('exit', (code) =>
      reject(new Error(`Production fixture exited: ${code} ${startupError}`)),
    )
    frontend.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Listening')) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })
  const endpoint = `${fixtureOrigin}/api/platform/agent-changes`
  for (const [role, status] of [
    [undefined, 401],
    ['admin', 403],
    ['operator', 403],
    ['down', 503],
  ]) {
    const response = await fetch(endpoint, {
      headers: {
        ...(role ? { Cookie: `${cookieName}=${role}` } : {}),
        'X-Platform-Administrator': 'true',
      },
    })
    assert.equal(response.status, status)
    assert.match(response.headers.get('Cache-Control'), /private, no-store/)
    assert.equal(response.headers.get('Vary'), 'Cookie')
    assert.ok(!(await response.text()).includes(source.changes[0].id))
  }
  const response = await fetch(endpoint, {
    headers: { Cookie: `${cookieName}=master` },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), source)
  for (const path of ['/data/agent-changes.json', '/agent-changes.json']) {
    const body = await (await fetch(`${fixtureOrigin}${path}`)).text()
    assert.ok(
      !body.includes(source.changes[0].id),
      `${path} exposed private records`,
    )
  }
  async function inspectPublic(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name)
      if (item.isDirectory()) await inspectPublic(path)
      else if (/\.(js|json|html|map)$/.test(item.name))
        assert.ok(
          !(await readFile(path, 'utf8')).includes(source.changes[0].id),
          `Private record leaked into ${path}`,
        )
    }
  }
  await inspectPublic(join(root, '.output/public'))
  console.log(
    'HTTP produção: visitante 401; ADMIN/OPERATOR 403; sessão indisponível 503; master 200; sem cache ou vazamento no bundle público.',
  )
  if (serve) {
    console.log(
      `Fixture visual isolada: ${fixtureOrigin}/plataforma/login — master@test.invalid / fixture-only. Sessão simulada; sem banco.`,
    )
    console.log('Pressione Enter ou Ctrl+C para encerrar a fixture.')
    await new Promise((resolve) => {
      process.stdin.resume()
      process.stdin.once('data', resolve)
      process.once('SIGINT', resolve)
      process.once('SIGTERM', resolve)
    })
    process.stdin.pause()
  }
} finally {
  await stop()
}
