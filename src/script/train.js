import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as iFitNet from "./net/iFitNet/src/iFitNet";
import {loadCanvas, drawKeypointsWithMask, drawSkeletonWithMask} from "./utils/canvas";
import {andMask, getConfidenceMask, getDeactivateMask} from "./utils/confidence";
import {loadVideoList,loadVideo} from "./utils/video";
import * as cocoSsd from '@tensorflow-models/coco-ssd';

//DEBUG settings
let DEBUG = 1
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
function detectPoseInRealTime(net,ssd,video) {

    const canvas = loadCanvas('output',videoConfig.width,videoConfig.height)
    const ctx = canvas.getContext('2d');

    const bcanvas = loadCanvas('box',videoConfig.width,videoConfig.height)
    const bctx = bcanvas.getContext('2d');

    async function detectPerson() {
        console.time('detect')
        let objs =await ssd.detect(canvas)
        objs.forEach(obj=>{
            if (obj.class=='person'){
                let [x,y,w,h] = obj.bbox
                let centerX = x+w/2;
                let centerY = y+h/2;
                let max = w>h ? w:h;
                x = centerX - max/2;
                y = centerY - max/2;
                ctx.strokeRect(x,y,max,max)
                guiState.person = [x,y,max,max]
            }
        })
        console.timeEnd('detect')
    }

    async function poseDetectionFrame() {

        if (guiState.changeVideoName){
            video = await loadVideo(guiState.changeVideoName,videoConfig,'trainVideo',true)
            guiState.changeVideoName = null
            allPose = []
            videoConfig.videoState = 'ended'
        }

        stats.begin()

        let poses =[]
        let videoTime = video.currentTime
        let pose = await net.estimateSinglePose(video,  guiState.output.flipHorizontal)

        if (DEBUG){
            console.log('Estimate...')
            console.log(pose)
        }

        //filter deactivate keypoints
        // pose.keypoints = filterDeactivateKeypoints(pose.keypoints,guiState.confidence.minPoseConfidence,guiState.deactivateArray)

        //get mask
        let mask = getConfidenceMask(pose.keypoints,guiState.confidence.minPoseConfidence);
        let deactivateMask = getDeactivateMask(pose.keypoints,guiState.deactivateArray);
        mask = andMask(mask,deactivateMask);
        pose.mask = mask

        if (DEBUG){
            console.log('mask:')
            console.log(pose.mask)
        }

        pose.time = videoTime
        poses.push(pose)

        if (videoConfig.videoState=='play'){
            allPose.push(pose)
        }

        ctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
        if (guiState.output.showVideo){
            ctx.save();
            if (guiState.output.showVideo){
                ctx.drawImage(video,0,0,videoConfig.width,videoConfig.height)
            }
            ctx.restore();
        }

        {
            bctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
            bctx.putImageData(ctx.getImageData(...guiState.person),0,0,...guiState.person)
        }

        //draw keypoints
        poses.forEach((pose)=>{
            if (guiState.output.showPoints){
                drawKeypointsWithMask(pose.keypoints,ctx,pose.mask)
            }
            if (guiState.output.showSkeleton){
                drawSkeletonWithMask(pose.keypoints,ctx,pose.mask)
            }
        })

        stats.update()

        if (DEBUG==1){
            DEBUG=0
        }

        requestAnimationFrame(poseDetectionFrame)

    }


    stats.end()

    setInterval(detectPerson,400)

    poseDetectionFrame()
}

const IN_SERVER = 0;

let url = IN_SERVER==1? 'https://139.196.138.230' : 'http://localhost'

const videoConfig ={
    videoState:'ended',
    videoFile:{
        bucket:`${url}:1234/static/videos/`,
    },
    getVideoListUrl:`${url}:1234/videoList`,
    jsonUpdateUrl:`${url}:1234/upload`,
    formDataUpdateUrl:`${url}:1234/videos/upload?courseId=1&intro=1`,
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
    person:[0, 0, videoConfig.width, videoConfig.height],
    video:{
        name:'jianshencrop.mp4'
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
        Pelvis:true,
        thorax:true,
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
        c.onChange(function () {
            let index = Joints.indexOf(k.toString())
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

}

async function runDemo(){

    //load ssd model
    let ssd = await cocoSsd.load()

    //load pose model
    let net =await iFitNet.load()
    
    let videoList = await loadVideoList(videoConfig)

    if (DEBUG){
        console.log(typeof(videoList))
    }

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

    detectPoseInRealTime(net,ssd,video)
}

runDemo()