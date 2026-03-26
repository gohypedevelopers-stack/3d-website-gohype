const path = require('path')

require('dotenv').config({
  path: path.join(__dirname, '.env.local'),
  override: true,
})

const compression = require('compression')
const express = require('express')

const app = express()
const port = Number(process.env.PORT || 3000)

const staticDir = (folder) => path.join(__dirname, folder)
const sendStaticFile = (route, file) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file))
  })
}

app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Local dev should not aggressively cache chunk files, otherwise stale
// hashed assets stay in browser cache and cause hydration/API path mismatches.
const staticOptions = { maxAge: 0, etag: true }

app.use(
  '/_next/static',
  express.static(staticDir('static'), staticOptions),
)
app.use('/static', express.static(staticDir('static'), staticOptions))
app.use('/public', express.static(staticDir('public')))
app.use('/logos', express.static(staticDir('logos')))
app.use('/videos', express.static(staticDir('videos')))
app.use('/server/app', express.static(path.join(__dirname, 'server', 'app')))

sendStaticFile('/logo.png', 'logo.png')
sendStaticFile('/user.png', 'user.png')

const chatHandler = require('./api/chat')
const contactHandler = require('./api/contact')

const route = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res)).catch(next)
}

app.all('/api/chat', route(chatHandler))
app.all('/api/contact', route(contactHandler))
// Backward-compatible aliases for stale cached frontend chunks.
app.all('/api/chat.js', route(chatHandler))
app.all('/api/contact.js', route(contactHandler))

const appHtml = path.join(__dirname, 'server', 'app', 'index.html')

app.get('*', (req, res) => {
  // Avoid sending HTML to asset-like requests (e.g. /script.js),
  // which causes "Unexpected token '<'" in browser consoles.
  if (path.extname(req.path)) {
    res.status(404).type('text/plain').send('Not Found')
    return
  }

  res.sendFile(appHtml)
})

app.listen(port, () => {
  console.log(`GoHype static build running at http://localhost:${port}`)
})
