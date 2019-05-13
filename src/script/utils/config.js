const links = [[0,1],[1,2],[4,3],[5,4],[10,11], [11,12],[12,8],[8,13],[13,14],[14,15],[8,9],[8,2],[8,3],[2,3]]
const angles = [[0,1],[2,3],[4,5],[5,6],[6,7],[7,8],[8,9],[6,10],[7,10],[11,12],[1,11],[2,12]]

const jointKeys={
    'rightAnkle':0,
    'rightKnee':1,
    'rightHip':2,
    'leftHip':3,
    'leftKnee':4,
    'leftAnkle':5,
    'pelvis':6,
    'thorax':7,
    'upperNeck':8,
    'headTop':9,
    'rightWrist':10,
    'rightElbow':11,
    'rightShoulder':12,
    'leftShoulder':13,
    'leftElbow':14,
    'leftWrist':15
}

const linkKeys = {
    'right shank':0, //右小腿
    'right thigh':1, //右大腿
    'left thigh':2,
    'left shank':3,
    'right forearm':4, //右大臂
    'right arm':5, //右小臂
    'right clavicle':6, //右锁骨
    'left clavicle':7,
    'left arm':8,
    'left forearm':9,
    'cervical':10, //颈椎
    'upperNeck to rightHip':11,
    'upperNeck to leftHip':12,
    'rightHip to leftHip':13
}

function getLinks(){
    return links;
}

function getAngles() {
    return angles
}

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
    IFitNet_TYPE:'HRNet',
    // IFitNet_TYPE:'Hourglass',
    ENVIRONMENT_FRONT:'dev',  //dev为本地，build为服务器
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

exports.getLinks = getLinks
exports.getAngles = getAngles
exports.getFrontUrl = getFrontUrl
exports.getBackUrl = getBackUrl
exports.getIFitNetType = getIFitNetType
exports.getFrontEnvironment= getFrontEnvironment


