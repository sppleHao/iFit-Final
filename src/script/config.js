const front = {
    dev:{
        ip:'localhost',
        port:1234,
        type:'http',
    },
    build:{
        ip:'139.196.138.230',
        port:1234,
        type:'https',
    },
}

const back = {
    dev:{
        ip:'localhost',
        port:3000,
        type:'http',
    },
    build:{
        ip:'139.196.138.230',
        port:3000,
        type:'https',
    },
}

const GLOBAL = {
    IFitNet_TYPE:'Hourglass',
    ENVIRONMENT_FRONT:'dev',
    ENVIRONMENT_BACK:'build',
}

function toUrl(settings) {
    return settings.type+"://"+settings.ip+":"+settings.port;
}

function getFrontUrl(){
    if (GLOBAL.ENVIRONMENT_FRONT=='build'){
        return toUrl(front.build)
    }
    else {
        return toUrl(front.dev)
    }
}

function getBackUrl(){
    if (GLOBAL.ENVIRONMENT_BACK=='build'){
        return toUrl(back.build)
    }
    else {
        return toUrl(back.dev);
    }
}

function getIFitNetType(){
    return GLOBAL.IFitNet_TYPE;
}

function getFrontEnvironment() {
    if (GLOBAL.ENVIRONMENT_FRONT=='build'){
        return [true,front.build.port]
    }
    else {
        return [false,front.dev.port]
    }
}

exports.getFrontUrl = getFrontUrl
exports.getBackUrl = getBackUrl
exports.getIFitNetType = getIFitNetType
exports.getFrontEnvironment= getFrontEnvironment


