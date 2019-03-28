import * as tf from '@tensorflow/tfjs'
import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as iFitNet from "./net/iFitNet/src/iFitNet";
import {drawKeypoints,drawSkeleton} from "./utils/canvas";
import {filterDeactivateKeypoints} from "./utils/confidence";

//camera and cavans size
const VIDEO_WIDTH = 600
const VIDEO_HEIGHT =600

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
function detectPoseInRealTime(net,video) {
    const canvas = document.getElementById('output');
    const ctx = canvas.getContext('2d');

    canvas.width = VIDEO_WIDTH
    canvas.height= VIDEO_HEIGHT



    async function poseDetectionFrame() {

        if (guiState.changeVideoName){
            video = await loadVideo(guiState.changeVideoName)
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
        pose.keypoints = filterDeactivateKeypoints(pose.keypoints,guiState.confidence.minPoseConfidence,guiState.deactiveArray)

        if (DEBUG){
            console.log('afterFilter...')
            console.log(pose)
        }

        pose.time = videoTime
        poses.push(pose)

        if (videoConfig.videoState=='play'){
            allPose.push(pose)
        }

        ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
        if (guiState.output.showVideo){
            ctx.save();
            if (guiState.output.showVideo){
                ctx.drawImage(video,0,0,VIDEO_WIDTH,VIDEO_HEIGHT)
            }
            ctx.restore();
        }

        //todo draw boxes , keypoints and skeleton
        poses.forEach((pose)=>{
            if (guiState.output.showPoints){
                drawKeypoints(pose.keypoints,ctx,'red',4)
            }
            if (guiState.output.showSkeleton){
                drawSkeleton(pose.keypoints,ctx)
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

const videoConfig ={
    videoState:'ended',
    videoFile:{
        bucket:'http://localhost:1234/static/videos/',
    },
    getVideoListUrl:'http://localhost:1234/videoList',
    jsonUpdateUrl:'http://localhost:1234/upload',
    formDataUpdateUrl:'http://localhost:1234/videos/upload?courseId=1&intro=1'
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

async function loadVideoList() {
    let jResult = null
    await $.ajax({
        type:'get',
        url:videoConfig.getVideoListUrl,
    }).done(async function (result) {
        jResult = JSON.parse(result)
        console.log(jResult)
    }).fail(function (jqXHR) {
        alert('Error:' + jqXHR.status);
        return []
    });

    return jResult
}

/**
 * load comic models
 */
function setupVideo(videoName) {
    const video = document.getElementById('video');
    video.width = VIDEO_WIDTH;
    video.height = VIDEO_WIDTH;

    video.src = videoConfig.videoFile.bucket+videoName;

    return video
}

async function loadVideo(videoName) {
    const video = await setupVideo(videoName)

    return video
}

const guiState = {
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
    deactiveArray:[]
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
                guiState.deactiveArray.remove(index)
            }
            else {
                guiState.deactiveArray.push(index)
            }
            if(DEBUG) {
                console.log(guiState.deactiveArray)
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

    //load pose model
    let net =await iFitNet.load()
    
    let videoList = await loadVideoList()

    if (DEBUG){
        console.log(typeof(videoList))
    }

    let video = await loadVideo(guiState.video.name)

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

    detectPoseInRealTime(net,video)
}

runDemo()