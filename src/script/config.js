const dev = {
    front:{
        ip:'localhost',
        port:1234,
        type:'http',
    },
    back:{
        ip:'localhost',
        port:3000,
        type:'http',
    },
}

const build = {
    front:{
        ip:'139.196.138.230',
        port:1234,
        type:'https',
    },
    back:{
        ip:'139.196.138.230',
        port:3000,
        type:'https',
    },
}

const GLOBAL = {
    IFitNet_TYPE:'Hourglass',
    ENVIRONMENT:'dev',
}

function toUrl(settings) {
    return settings.type+"://"+settings.ip+":"+settings.port;
}

function getFrontUrl(){
    if (GLOBAL.ENVIRONMENT=='build'){
        return toUrl(build.front)
    }
    else {
        return toUrl(dev.front)
    }
}

function getBackUrl(){
    if (GLOBAL.ENVIRONMENT=='build'){
        return toUrl(build.back)
    }
    else {
        return toUrl(dev.back);
    }
}

function getIFitNetType(){
    return GLOBAL.IFitNet_TYPE;
}

function getFrontEnvironment() {
    if (GLOBAL.ENVIRONMENT=='build'){
        return [true,build.front.port]
    }
    else {
        return [false,dev.front.port]
    }
}

exports.getFrontUrl = getFrontUrl
exports.getBackUrl = getBackUrl
exports.getIFitNetType = getIFitNetType
exports.getFrontEnvironment= getFrontEnvironment


