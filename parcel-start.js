const proxy = require('http-proxy-middleware')
const Bundler = require('parcel-bundler')
const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')
const config = require('./src/script/utils/config')
var app = express()
var credentials = null

const [IN_SERVER ,PORT] = config.getFrontEnvironment();
//init https
if (IN_SERVER){
    const privateKey  = fs.readFileSync('/home/public/private.pem', 'utf8');
    const certificate = fs.readFileSync('/home/public/file.crt', 'utf8');
    credentials = {key: privateKey, cert: certificate};
}

//proxy
app.use(
    ['/static','/upload','/videoList'],
    proxy({
        target:config.getBackUrl(),
        secure: false
    })
)

//use parcel
var bundler = new Bundler('./src/html/index.html')
app.use(bundler.middleware())

//listen
if (IN_SERVER){
    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(PORT)
}
else {
    app.listen(PORT)
}


