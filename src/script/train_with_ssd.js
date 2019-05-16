import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as loadModel from "./net/iFitNet/src/loadModel"
import {loadCanvas, drawKeypointsWithMask, drawSkeletonWithMask,drawPoint} from "./utils/canvas";
import {andMask, getConfidenceMask, getDeactivateMask} from "./utils/confidence";
import {loadVideoList,loadVideo} from "./utils/video";
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import {getFrontUrl} from "./utils/config";

//DEBUG settings
let DEBUG = 0
//FPS
const stats = new Stats()

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
}

let allPose = []

/**
 *  Detect Poses
 * @param camera Video Element
 * @param model
 */
function detectPoseInRealTime(iFitNet,ssd,video) {

    const canvas = loadCanvas('output',videoConfig.width,videoConfig.height)
    const ctx = canvas.getContext('2d');

    const originCanvas = loadCanvas('origin',videoConfig.width,videoConfig.height)
    const octx = originCanvas.getContext('2d');

    let detection = setInterval(detectPersons,guiState.personDetection.interval)

    async function detectPersons() {
        // console.time('detect')
        if (guiState.personDetection.open){
            let objs =await ssd.detect(originCanvas)

            let maxBoxArea = 0;
            let maxBox = []

            for(let i =0;i<objs.length;i++){
                const obj = objs[i];
                if (obj.class=='person'){

                        let [x,y,w,h] = obj.bbox.map(p=>{
                            return Math.floor(p)
                        })
                        let centerX = x + w/2;
                        let centerY = y + h/2;
                        let maxSide = w>h ? w:h;
                        let boxMinX = centerX - maxSide/2 > 0 ? centerX - maxSide/2 : 0 ;
                        let boxMinY = centerY - maxSide/2 > 0 ? centerY - maxSide/2 : 0 ;
                        let boxMaxX = centerX + maxSide/2 < videoConfig.width ? centerX + maxSide/2 : videoConfig.width;
                        let boxMaxY = centerY + maxSide/2 < videoConfig.height ? centerY + maxSide/2 : videoConfig.height;
                        let boxW = boxMaxX - boxMinX
                        let boxH = boxMaxY - boxMinY
                        let boxArea = boxW * boxH
                        if (boxArea>maxBoxArea){
                            maxBoxArea = boxArea
                            maxBox = [boxMinX,boxMinY,boxW,boxH]
                        }

                }

                if (i==objs.length-1){
                    guiState.person = maxBox
                }
            }
        }

        // console.timeEnd('detect')
    }

    async function poseDetectionFrame() {

        if (guiState.changeVideoName){
            video = await loadVideo(guiState.changeVideoName,videoConfig,'trainVideo',true)
            guiState.changeVideoName = null
            allPose = []
            videoConfig.videoState = 'ended'
        }

        if (guiState.changePersonDetectionInterval){
            clearInterval(detection);
            // console.log(detection)
            detection = setInterval(detectPersons,guiState.changePersonDetectionInterval)
            guiState.changePersonDetectionInterval = null
        }

        if (guiState.changeNetwork){
            iFitNet.dispose()
            iFitNet = await loadModel.load(guiState.changeNetwork)
            guiState.changeNetwork = null
        }

        stats.begin()

        let poses =[]
        let videoTime = video.currentTime

        if (guiState.personDetection.open){
            octx.clearRect(0, 0, videoConfig.width, videoConfig.height)
            if (guiState.output.showVideo){
                octx.save();
                if (guiState.output.showVideo){
                    octx.drawImage(video,0,0,videoConfig.width,videoConfig.height)
                }
                octx.restore();
            }
        }

        // console.log("box",guiState.person)
        //draw image in canvas

        if (guiState.person.length>0&&guiState.personDetection.open){
            let box = guiState.person
            let imData = octx.getImageData(...box)
            let pose = await iFitNet.estimateSinglePose(imData,guiState.output.flipHorizontal)
            pose.keypoints.forEach(keypoint=>{
                keypoint.position.x += box[0];
                keypoint.position.y += box[1];
            })

            //get mask
            let mask = getConfidenceMask(pose.keypoints,guiState.confidence.minPoseConfidence);
            let deactivateMask = getDeactivateMask(pose.keypoints,guiState.deactivateArray);
            mask = andMask(mask,deactivateMask);
            pose.mask = mask
            pose.time = videoTime
            poses.push(pose)

            if (DEBUG){
                console.log('Estimate...')
                console.log(pose)
                console.log('mask:')
                console.log(pose.mask)
            }
        }
        else {
            let pose = await iFitNet.estimateSinglePose(video,guiState.output.flipHorizontal)

            //get mask
            let mask = getConfidenceMask(pose.keypoints,guiState.confidence.minPoseConfidence);
            let deactivateMask = getDeactivateMask(pose.keypoints,guiState.deactivateArray);
            mask = andMask(mask,deactivateMask);
            pose.mask = mask
            pose.time = videoTime
            poses.push(pose)

            if (DEBUG){
                console.log('Estimate...')
                console.log(pose)
                console.log('mask:')
                console.log(pose.mask)
            }
        }


        //draw image in canvas
        ctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
        if (guiState.output.showVideo){
            ctx.save();
            if (guiState.output.showVideo){
                ctx.drawImage(video,0,0,videoConfig.width,videoConfig.height)
            }
            ctx.restore();
        }

        //draw keypoints
        poses.forEach((pose)=>{
            if (guiState.output.showPoints){
                drawKeypointsWithMask(pose.keypoints,ctx,pose.mask)
            }
            if (guiState.output.showSkeleton){
                drawSkeletonWithMask(pose.keypoints,ctx,pose.mask)
            }
            if (guiState.personDetection.open){
                if (guiState.person.length>0){
                    ctx.strokeRect(...guiState.person)
                }
            }
            if (videoConfig.videoState=='play'){
                allPose.push(pose)
            }
        })

        stats.update()

        if (DEBUG==1){
            DEBUG=0
        }

        requestAnimationFrame(poseDetectionFrame)

    }


    stats.end()

    poseDetectionFrame()
}

const url = getFrontUrl()

const videoConfig ={
    videoState:'ended',
    videoFile:{
        bucket:`${url}/static/videos/`,
    },
    getVideoListUrl:`${url}/videoList`,
    jsonUpdateUrl:`${url}/upload`,
    formDataUpdateUrl:`${url}/videos/upload?courseId=1&intro=1`,
    width:550,
    height:480
}

/**
 * send poses file to back use Json
 */
function sendPoseJsonToBackUseJson(poses) {
    console.log(poses)
    let videoName = guiState.video.name.split('.')[0]
    $.ajax({
        type: 'post',
        contentType: 'application/json',
        url: videoConfig.jsonUpdateUrl+`?name=${videoName}`,
        data: JSON.stringify(poses)
    }).done(function (r) {
        console.log('success!');
        alert('上传成功!');
    }).fail(function (jqXHR) {
        // Not 200:
        alert('Error:' + jqXHR.status);
    });
}

/**
 * send poses file to back
 */
function sendPoseJsonToBackUseFormData(poses) {
    let formData = new FormData()
    formData.append('video','1')
    formData.append('poseFile',poses)

    $.ajax({
        type: 'post',
        contentType: false, // 注意这里应设为false
        processData: false,
        cache: false,
        url: videoConfig.formDataUpdateUrl,
        data: formData
    }).done(function (r) {
        console.log('success!');
    }).fail(function (jqXHR) {
        // Not 200:
        alert('Error:' + jqXHR.status);
    });
}

const guiState = {
    net:'HRNet',
    person:[],
    video:{
        name:'out1.mp4'
    },
    confidence:{
        minPoseConfidence:0.15,
    },
    joints:{
        rightAnkle:true,
        rightKnee:true,
        rightHip:true,
        leftHip:true,
        leftKnee:true,
        leftAnkle:true,
        Pelvis:false,
        thorax:false,
        upperNeck:true,
        headTop:true,
        rightWrist:true,
        rightElbow:true,
        rightShoulder:true,
        leftShoulder:true,
        leftElbow:true,
        leftWrist:true
    },
    output:{
        showVideo:true,
        showSkeleton:true,
        showPoints:true,
        flipHorizontal:false,
    },
    personDetection:{
        open:false,
        interval:200,
    },
    deactivateArray:[]
}

const Joints = [
    'rightAnkle',
    'rightKnee',
    'rightHip',
    'leftHip',
    'leftKnee',
    'leftAnkle',
    'Pelvis',
    'thorax',
    'upperNeck',
    'headTop',
    'rightWrist',
    'rightElbow',
    'rightShoulder',
    'leftShoulder',
    'leftElbow',
    'leftWrist'
]

Array.prototype.remove = function(val) {
    var index = this.indexOf(val);
    if (index > -1) {
        this.splice(index, 1);
    }
}

/**
 * set up gui config
 * @param cameras
 */
function setupGui(videoList) {

    const gui = new dat.GUI({width:300})

    let net = gui.addFolder('NetWork')
    const netController = net.add(guiState,'net',{'iFitNet-Fast':'HRNet','iFitNet':'Hourglass'})

    netController.onChange(function (network) {
        guiState.changeNetwork = network;
    })

    let videos = gui.addFolder('Video Source Controller')
    const videoController = videos.add(guiState.video,'name',videoList)

    videoController.onChange(function (name) {
        guiState.changeVideoName = name
    })

    let confidence = gui.addFolder('Confidence Controller')
    confidence.add(guiState.confidence,'minPoseConfidence',0.0,1.0)

    let joints = gui.addFolder('Joint Controller')
    for (let k in guiState.joints){
        let c = joints.add(guiState.joints,k.toString())
        let index = Joints.indexOf(k.toString())

        if (guiState.joints[k]){
            guiState.deactivateArray.remove(index)
        }
        else {
            console.log(index)
            guiState.deactivateArray.push(index)
        }

        c.onChange(function () {
            if (guiState.joints[k]){
                guiState.deactivateArray.remove(index)
            }
            else {
                guiState.deactivateArray.push(index)
            }
            if(DEBUG) {
                console.log(guiState.deactivateArray)
            }
        })
    }

    let output = gui.addFolder('Output')
    output.add(guiState.output, 'showVideo')
    output.add(guiState.output, 'showSkeleton')
    output.add(guiState.output, 'showPoints')
    output.add(guiState.output,'flipHorizontal')

    let person = gui.addFolder('PersonDetection')
    person.add(guiState.personDetection, 'open')
    let interval = person.add(guiState.personDetection, 'interval',100,300)
    interval.onChange(function (number) {
        guiState.changePersonDetectionInterval = parseInt(number)
    })

}

async function runDemo(){

    //load ssd model
    let ssd = await cocoSsd.load()

    //load pose model
    let iFitNet =await loadModel.load('HRNet')

    //load trained videos
    let videoList = await loadVideoList(videoConfig)

    let video = await loadVideo(guiState.video.name,videoConfig,'trainVideo',true)

    // control video state
    video.addEventListener('play',function () {
        videoConfig.videoState='play';
    });

    video.addEventListener('pause',function () {
        videoConfig.videoState='pause';
    });

    video.addEventListener('ended',function () {
        videoConfig.videoState='ended';
        if (DEBUG){
            console.log(allPose)
        }
        sendPoseJsonToBackUseJson(allPose)
        // sendPoseJsonToBackUseFormData(allPose)
        allPose = []
        video.pause();
    });

    setupGui(videoList)
    setupFPS()

    detectPoseInRealTime(iFitNet,ssd,video)
}

runDemo()