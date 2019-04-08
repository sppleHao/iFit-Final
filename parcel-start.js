const proxy = require('http-proxy-middleware')
const Bundler = require('parcel-bundler')
const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')
var app = express()

const IN_SERVER = 0


var credentials = null
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
        target: IN_SERVER==1? '://139.196.138.230:3000' : 'http://localhost:3000',
        secure: false
    })
)

//use parcel
var bundler = new Bundler('./src/html/index.html')
app.use(bundler.middleware())

//listen
if (IN_SERVER){
    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(1234)
}
else {
    app.listen(Number(process.env.PORT || 1234))
}


