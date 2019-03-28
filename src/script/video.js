import * as tf from '@tensorflow/tfjs'
import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as iFitNet from './net/iFitNet/src/iFitNet'
import {compareTwoPose} from "./utils/compare";
import {drawKeypoints,drawSkeleton,drawKeypointsWithMask,drawSkeletonWithMask} from "./utils/canvas";
import  {filterDeactivateKeypoints} from "./utils/confidence";

//camera and cavans size
const VIDEO_WIDTH = 600 //540
const VIDEO_HEIGHT = 600 //600

//DEBUG settings
let DEBUG = 1

//FPS
const stats = new Stats()

/**
 *  get compared pose from poseFIle
 */
function getComparedPose(video,poseFile,startIndex,fps,seconds=1,length=3) {

    let videoTime = video.currentTime
    let newIndex = startIndex

    //get now index
    for (let i=startIndex;i<poseFile.length-1;i++) {
        if (poseFile[i].time<videoTime&&poseFile[i+1].time>videoTime){
            newIndex = i
            break;
        }
    }

    let comparePoses = []
    for (let i = 0;i<fps/2&&i+newIndex<poseFile.length;i++){
        comparePoses.push(poseFile[newIndex + i])
    }

    return [newIndex,comparePoses]
}

Array.prototype.min = function(){
    return Math.min.apply({},this)
}

/**
 * compare webcam pose with comparedPoses
 */
function comparePoseWithVideo(currentPose,comparedPoses,threshHold){
    let noPassNumberArray = [];
    let jointsArray = [];
    for (let i=0;i<comparedPoses.length;i++){
        let [noPassNum,lowConfidenceJointsBoolean] = compareTwoPose(currentPose,comparedPoses[i],threshHold);
        if (noPassNum==0){
            return [true,0,[]];
        }
        if (noPassNum>0){
            noPassNumberArray.push(noPassNum);
            jointsArray.push(lowConfidenceJointsBoolean);
        }
    }

    if (noPassNumberArray.length==0){
        return [false,-1,[]];
    }

    let minNoPassNum = noPassNumberArray.min();
    let index = noPassNumberArray.indexOf(minNoPassNum);

    if (DEBUG){
        console.log('minNoPass')
        console.log(minNoPassNum)
        console.log(jointsArray[index])
    }


    return [false,minNoPassNum,jointsArray[index]];
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
}

/**
 *  Detect Poses
 * @param camera Video Element
 * @param model
 */
function detectPoseInRealTime(net,video,camera,poseFile) {
    let font = document.getElementById('font')

    //camera canvas
    const ccanvas = document.getElementById('coutput');
    const cctx = ccanvas.getContext('2d');

    //video canvas
    const vcanvas = document.getElementById('voutput')
    const vctx = vcanvas.getContext('2d');

    //set canvas
    ccanvas.width = VIDEO_WIDTH
    ccanvas.height= VIDEO_HEIGHT
    vcanvas.width = VIDEO_WIDTH
    vcanvas.height = VIDEO_HEIGHT

    //config
    let startIndex = 0
    let trainingFramePerSecond  = parseInt(poseFile.length) /parseInt(video.duration)

    if (DEBUG){
        console.log('videoFPS')
        console.log(trainingFramePerSecond)
    }


    //loop
    async function poseDetectionFrame() {

        if (videoConfig.videoState=='ended'){
            startIndex = 0
        }

        if (guiState.changeVideoName){
            video = await loadVideo(guiState.changeVideoName)
            poseFile = await loadPoseFile()
            guiState.changeVideoName = null
            videoConfig.videoState = 'ended'
        }

        //listen change camera
        if (guiState.changeCameraDevice){
            camera =await loadCamera(guiState.changeCameraDevice)
            guiState.changeCameraDevice = null
        }

        //begin fps
        stats.begin()

        //get the pose
        if (net){
            let poses =[]
            let pose = await net.estimateSinglePose(camera, guiState.output.flipHorizontal)

            if (DEBUG){
                console.log('Estimate...')
                console.log(pose)
            }

            //filter deactivate keypoints
            pose.keypoints = filterDeactivateKeypoints(pose.keypoints,guiState.confidence.minPoseConfidence,guiState.deactivateArray)

            if (DEBUG){
                console.log('afterFilter...')
                console.log(pose)
            }

            //draw canvas
            cctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
            vctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
            poses.push(pose)
            if (guiState.output.showVideo){
                if (guiState.output.flipHorizontal) {
                    cctx.save()
                    cctx.scale(-1, 1)
                    cctx.translate(-VIDEO_WIDTH, 0)
                    cctx.drawImage(camera,0,0,VIDEO_WIDTH,VIDEO_HEIGHT)
                    cctx.restore()
                }
                else {
                    cctx.drawImage(camera,0,0,VIDEO_WIDTH,VIDEO_HEIGHT)
                    cctx.restore()
                }


                vctx.save()
                // vctx.scale(-1, 1)
                // vctx.translate(-VIDEO_WIDTH, 0)
                vctx.drawImage(video,0,0,VIDEO_WIDTH,VIDEO_HEIGHT)
                vctx.restore()
            }

            //get compared poss
            poses.forEach((pose)=>{
                //get compare poses (0-1seconds)
                let [newIndex , comparePoses] =getComparedPose(video,poseFile,startIndex,trainingFramePerSecond)
                startIndex = newIndex
                let [isPass ,noPassNum , lowConfidenceJointsBoolean] = comparePoseWithVideo(pose,comparePoses,guiState.confidence.compareThreshold)

                let poseFileMask = poseFile[startIndex].keypoints.map(kp=>{
                    if (kp.active){
                        return true;
                    }
                    else {
                        return false;
                    }
                })

                if (DEBUG){
                    console.log('comparePose:');
                    console.log(comparePoses);
                    console.log(isPass)
                    console.log(noPassNum)
                    console.log('kps:')
                    console.log(pose.keypoints)
                    console.log('low confidence kps:')
                    console.log(lowConfidenceJointsBoolean)
                }

                if (guiState.output.showPoints){
                    drawKeypoints(poseFile[startIndex].keypoints,vctx)
                    drawKeypoints(pose.keypoints,cctx)
                }
                if (guiState.output.showSkeleton){
                    drawSkeleton(poseFile[startIndex].keypoints,vctx)
                    drawSkeleton(pose.keypoints,cctx)
                }

                if (noPassNum!=-1){
                    drawKeypointsWithMask(pose.keypoints,cctx,'yellow',3,poseFileMask)
                    drawSkeletonWithMask(pose.keypoints,cctx,'yellow',3,poseFileMask)
                    if (noPassNum==0){
                        font.innerText = noPassNum.toString()
                        if (isPass&&videoConfig.videoState=='pause'){
                            video.play()
                        }
                    }
                    else {
                        font.innerText = noPassNum.toString()
                        if(!isPass&&videoConfig.videoState=='play') {
                            video.pause()
                        }
                        drawKeypointsWithMask(pose.keypoints,cctx,'red',5,lowConfidenceJointsBoolean)
                        drawSkeletonWithMask(pose.keypoints,cctx,'red',4,lowConfidenceJointsBoolean)
                    }
                }
                else {
                    //invalid poses
                    video.pause()
                }
                DEBUG = 0
            })
        }

        //get fps
        stats.update()

        requestAnimationFrame(poseDetectionFrame)

    }


    stats.end()

    poseDetectionFrame()
}

/**
 *  get all camera devices
 */
async function getCameras() {

    let cameras =navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
            let cameras = []
            devices.forEach(function(device) {
                if (device.kind=='videoinput'){
                    let camera = {
                        name:device.label,
                        id:device.deviceId
                    }
                    cameras.push(camera)
                }
            })
            return cameras
        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        })

    return cameras
}

/**
 * set camera steams
 */
async function setupCamera(deviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const video = document.getElementById('camera');
    video.width = VIDEO_WIDTH;
    video.height = VIDEO_HEIGHT;

    if (deviceId!=null){
        const stream =await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: { exact: deviceId },
                width:VIDEO_WIDTH,
                height:VIDEO_HEIGHT
            }
        })

        video.srcObject = stream;
    }
    else {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
                facingMode: 'user',
                width: VIDEO_WIDTH,
                height: VIDEO_HEIGHT,
            },
        })

        video.srcObject = stream;
    }

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video)
        }
    })
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
    const video = document.getElementById('trainVideo');
    video.width = VIDEO_WIDTH/5;
    video.height = VIDEO_WIDTH/5;

    video.src = videoConfig.videoFile.bucket+videoName;

    return video
}

/**
 * load video
 * @returns {Promise<void>}
 */
async function loadVideo(videoName) {
    const video = await setupVideo(videoName)
    return video
}

/**
 * load camera
 */
async function loadCamera(deviceId=null) {
    const camera = await setupCamera(deviceId)
    camera.play()

    return camera
}

const guiState = {
    video:{
        name:'jianshencrop.mp4'
    },
    confidence:{
        minPoseConfidence:0.15,
        compareThreshold:0.25
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
        flipHorizontal:true
    },
    camera:{
        deviceName:null
    },
    network:{
        usePoseNet:false
    },
    deactivateArray:[]
}

const videoConfig ={
    ip:'139.196.138.230',
    videoState:'ended',
    videoFile:{
        bucket:`http://${ip}/static/videos/`,
    },
    poseFile:{
        bucket:`http://${ip}:1234/static/poses/`,
    },
    getVideoListUrl:`http://${ip}:1234/videoList`,
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

/**
 * remove element froma array
 * @param val
 */
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
function setupGui(videoList,cameras) {

    //gui state
    const gui = new dat.GUI({width:300});
    gui.domElement.style = 'position:absolute;top:200px;right:0px';

    let videos = gui.addFolder('Video Source Controller')
    const videoController = videos.add(guiState.video,'name',videoList)

    videoController.onChange(function (name) {
        guiState.changeVideoName = name
    })

    let confidence = gui.addFolder('Confidence Controller');
    confidence.add(guiState.confidence,'minPoseConfidence',0.0,1.0);
    confidence.add(guiState.confidence,'compareThreshold',0.0,1.0);

    //deactivate joints
    let joints = gui.addFolder('Joint Controller');
    for (let k in guiState.joints){
        let c = joints.add(guiState.joints,k.toString());
        c.onChange(function () {
            let index = Joints.indexOf(k.toString());
            if (guiState.joints[k]){
                guiState.deactivateArray.remove(index);
            }
            else {
                guiState.deactivateArray.push(index);
            }
            if(DEBUG) {
                console.log(guiState.deactivateArray);
            }
        })
    }

    //show control
    let output = gui.addFolder('Output');
    output.add(guiState.output, 'showVideo');
    output.add(guiState.output, 'showSkeleton');
    output.add(guiState.output, 'showPoints');
    output.add(guiState.output,'flipHorizontal')

    //camera control
    let cameraNames = [];
    let cameraIds = [];
    cameras.forEach(({name,id})=>{
        cameraNames.push(name);
        cameraIds.push(id);
    })
    let camera = gui.addFolder('Camera');
    const cameraController =  camera.add(guiState.camera,'deviceName',cameraNames);

    //camera listener
    cameraController.onChange(function(name) {
        guiState.changeCameraDevice = cameraIds[cameraNames.indexOf(name)];
    });
}

/**
 * load pose file from backend
 * @returns {Promise<*>}
 */

async function loadPoseFile(){
    let fileName = guiState.video.name.split('.')[0] + '.json'
    let url = videoConfig.poseFile.bucket+ fileName;
    let pose = await $.getJSON(url,(data)=>{
        return data;
    })

    if (DEBUG){
        console.log('pose file:');
        console.log(pose);
    }

    return pose;
}

async function runDemo(){

    //load pose model
    let net =await iFitNet.load()

    //get camera list
    let cameras = await getCameras()

    //load videoList
    let videoList = await loadVideoList()

    //load learning video
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
        video.pause();
    });

    //load poseFile from Backend
    let poseFile = await loadPoseFile()

    //init button
    let button = document.getElementById('button');
    button.onclick = function () {
        if(videoConfig.videoState=='pause'||videoConfig.videoState=='ended'){
            video.play();
        }
        else{
            video.pause();
        }
    };

    if (cameras.length>0){
        //load camera
        guiState.camera.deviceName = cameras[0].name
        let camera = await loadCamera(cameras[0].id)

        setupGui(videoList,cameras)
        setupFPS()

        detectPoseInRealTime(net,video,camera,poseFile)
    }
}

runDemo()