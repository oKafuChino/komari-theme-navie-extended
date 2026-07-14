import { createServer } from 'node:http'

const port = 4174
const settings = {
  sakuraEnabled: true,
  cursorTrailEnabled: true,
  rpcTransportMode: 'http',
  dataUpdateInterval: 60,
  backgroundEnabled: false,
  backgroundType: 'image',
  lightBackgroundUrl: '',
  darkBackgroundUrl: '',
  backgroundBlur: 0,
  backgroundOverlay: 0,
}

const client = {
  uuid: 'node-1',
  name: 'Tokyo Edge',
  cpu_name: 'AMD EPYC 7B13',
  virtualization: 'KVM',
  arch: 'x86_64',
  cpu_cores: 4,
  os: 'Debian 12',
  kernel_version: '6.1.0',
  gpu_name: '',
  region: 'JP',
  public_remark: 'Ambient effects preview node',
  mem_total: 4294967296,
  swap_total: 1073741824,
  disk_total: 85899345920,
  weight: 1,
  price: 5,
  billing_cycle: 30,
  auto_renewal: true,
  currency: 'USD',
  expired_at: '2027-07-14T00:00:00Z',
  group: 'Asia',
  tags: 'preview',
  hidden: false,
  traffic_limit: 1099511627776,
  traffic_limit_type: 'sum',
  created_at: '2026-07-14T00:00:00Z',
  updated_at: '2026-07-14T00:00:00Z',
}

const status = {
  client: 'node-1',
  time: '2026-07-14T03:00:00Z',
  cpu: 36,
  gpu: 0,
  ram: 2147483648,
  ram_total: 4294967296,
  swap: 0,
  swap_total: 1073741824,
  load: 0.42,
  load5: 0.35,
  load15: 0.28,
  temp: 46,
  disk: 32212254720,
  disk_total: 85899345920,
  net_in: 1310720,
  net_out: 524288,
  net_total_up: 21474836480,
  net_total_down: 53687091200,
  process: 112,
  connections: 84,
  connections_udp: 12,
  online: true,
  uptime: 864000,
}

function send(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`)
  if (request.method === 'OPTIONS') {
    send(response, 204, {})
    return
  }
  if (request.method === 'GET' && url.pathname === '/public') {
    send(response, 200, {
      status: 'success',
      message: '',
      data: {
        allow_cors: true,
        custom_body: '',
        custom_head: '',
        description: 'Ambient effects preview',
        disable_password_login: false,
        oauth_enable: false,
        oauth_provider: null,
        ping_record_preserve_time: 24,
        private_site: false,
        record_enabled: true,
        record_preserve_time: 24,
        sitename: 'Komari Naive Extended',
        theme: 'NaiveExtended',
        theme_settings: settings,
      },
    })
    return
  }
  if (request.method === 'GET' && url.pathname === '/me') {
    send(response, 200, { logged_in: false, username: '' })
    return
  }
  if (request.method === 'POST' && url.pathname === '/__settings') {
    for (const [key, value] of url.searchParams) {
      if (value === 'true' || value === 'false')
        settings[key] = value === 'true'
      else
        settings[key] = value
    }
    send(response, 200, settings)
    return
  }
  if (request.method === 'POST' && url.pathname === '/rpc2') {
    let body = ''
    request.on('data', chunk => body += chunk)
    request.on('end', () => {
      const rpc = JSON.parse(body)
      const results = {
        'rpc.ping': 'pong',
        'common:getNodes': { 'node-1': client },
        'common:getNodesLatestStatus': { 'node-1': status },
        'common:getRecords': { records: [] },
      }
      send(response, 200, { jsonrpc: '2.0', result: results[rpc.method], id: rpc.id })
    })
    return
  }
  send(response, 404, { error: 'not found' })
})

server.listen(port, '127.0.0.1', () => {
  console.warn(`mock-komari-server http://127.0.0.1:${port}`)
})
