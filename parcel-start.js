const proxy = require('http-proxy-middleware')
const Bundler = require('parcel-bundler')
const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')

const IN_SERVER = 1
let credentials = null

if (IN_SERVER){
    const privateKey  = fs.readFileSync('/home/public/private.pem', 'utf8');
    const certificate = fs.readFileSync('/home/public/file.crt', 'utf8');
    credentials = {key: privateKey, cert: certificate};
}

let bundler = new Bundler('./src/html/index.html')
let app = express()

app.use(
    ['/static','/upload','/videoList'],
    proxy({
        target: IN_SERVER==1? 'https://139.196.138.230:3000' : 'http://localhost:3000',
        secure: false
    })
)

app.use(bundler.middleware())

if (IN_SERVER){
    const httpServer = http.createServer(app);
    const httpsServer = https.createServer(credentials, app);
    httpServer.listen(2345)
    httpsServer.listen(1234)
}
else {
    app.listen(Number(process.env.PORT || 1234))
}


