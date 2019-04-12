import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as iFitNet from './net/iFitNet/src/iFitNet'
import {angelArrayToJointMask, compareTwoPose} from "./utils/compare";
import {drawKeypointsWithMask, drawSkeletonWithMask, loadCanvas} from "./utils/canvas";
import {andMask, getConfidenceMask, getDeactivateMask, isBelongMask} from "./utils/confidence";
import {loadVideoList,loadVideo} from "./utils/video";
import {getCameraList,loadCamera} from "./utils/camera";

//DEBUG settings
let DEBUG = 1

//FPS
const stats = new Stats()

/**
 *  get compared pose from poseFIle
 */
function getComparedPose(pose,video,poseFile,startIndex,fps,deactivateMask) {

    let videoTime = video.currentTime;
    let newIndex = startIndex;

    //get now index
    for (let i=startIndex;i<poseFile.length-1;i++) {
        if (poseFile[i].time<videoTime&&poseFile[i+1].time>videoTime){
            newIndex = i;
            break;
        }
    }

    let comparePoses = []
    for (let i = 0;i<fps/2&&i+newIndex<poseFile.length;i++){
        let temp = poseFile[newIndex + i];
        if (temp.vmask ==null){
            temp.vmask = temp.mask
        }
        temp.mask = andMask(temp.vmask,deactivateMask)
        if (isBelongMask(temp.mask,pose.mask)){
            //camera pose mask must larger than file pose mask
            comparePoses.push(temp);
        }
    }

    return [newIndex,comparePoses]
}


/**
 * get min element from array
 * @returns {number}
 */
Array.prototype.min = function(){
    return Math.min.apply({},this)
}

/**
 * remove element from array
 * @param val
 */
Array.prototype.remove = function(val) {
    var index = this.indexOf(val);
    if (index > -1) {
        this.splice(index, 1);
    }
}

/**
 * compare poses
 * @param currentPose
 * @param comparedPoses
 * @param threshHold
 * @returns {*[]}
 */
function comparePoseWithVideo(currentPose,comparedPoses,threshHold){
    let minNoPassNum = 100;
    let lowConfidenceJointsMask = null;
    let overConfidenceJointsMask = null;
    for (let i=0;i<comparedPoses.length;i++){
        let [lowConfidenceAngelArray,overConfidenceAngelArray] = compareTwoPose(currentPose,comparedPoses[i],threshHold);

        let noPassNum = lowConfidenceAngelArray.length;
        let passNum = overConfidenceAngelArray.length;

        // console.log('no pass',noPassNum)

        if (noPassNum==0&&passNum>0){
            overConfidenceJointsMask = andMask(currentPose.mask,angelArrayToJointMask((overConfidenceAngelArray)));
            return [true,0,[],overConfidenceJointsMask];
        }
        if (noPassNum>0 && minNoPassNum>noPassNum){
            minNoPassNum = noPassNum;
            lowConfidenceJointsMask = andMask(currentPose.mask,angelArrayToJointMask((lowConfidenceAngelArray)));
            overConfidenceJointsMask = andMask(currentPose.mask,angelArrayToJointMask((overConfidenceAngelArray)));
        }
    }

    //all pose is invalid
    if (minNoPassNum==100){
        return [false,-1,[]];
    }


    if (DEBUG){
        console.log('minNoPass')
        console.log(minNoPassNum)
        console.log('low confidenceJoint')
        console.log(lowConfidenceJointsMask)
    }


    return [false,minNoPassNum,lowConfidenceJointsMask,overConfidenceJointsMask];
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
    const ccanvas = loadCanvas('coutput',videoConfig.width,videoConfig.height)
    const cctx = ccanvas.getContext('2d');

    //video canvas
    const vcanvas = loadCanvas('voutput',videoConfig.width,videoConfig.height)
    const vctx = vcanvas.getContext('2d');

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
            video = await loadVideo(guiState.changeVideoName,videoConfig,'trainVideo',true)
            poseFile = await loadPoseFile()
            guiState.changeVideoName = null
            videoConfig.videoState = 'ended'
        }

        //listen change camera
        if (guiState.changeCameraDevice){
            camera =await loadCamera(guiState.changeCameraDevice,videoConfig,'camera')
            guiState.changeCameraDevice = null
        }

        //begin fps
        stats.begin()

        //get the pose
        if (net){

            // console.time('poseTime')

            let poses =[]
            let pose = await net.estimateSinglePose(camera, guiState.output.flipHorizontal)

            // console.timeEnd('poseTime')

            if (DEBUG){
                console.log('Estimate...')
                console.log(pose)
            }

            //get mask
            let mask = getConfidenceMask(pose.keypoints,guiState.confidence.minPoseConfidence);
            let deactivateMask = getDeactivateMask(pose.keypoints,guiState.deactivateArray);
            mask = andMask(mask,deactivateMask);
            pose.mask = mask


            if (DEBUG){
                console.log('afterFilter...')
                console.log(pose)
            }

            //draw canvas
            cctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
            vctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
            poses.push(pose)
            if (guiState.output.showVideo){
                if (guiState.output.flipHorizontal) {
                    cctx.save()
                    cctx.scale(-1, 1)
                    cctx.translate(-videoConfig.width, 0)
                    cctx.drawImage(camera,0,0,videoConfig.width,videoConfig.height)
                    cctx.restore()
                }
                else {
                    cctx.drawImage(camera,0,0,videoConfig.width,videoConfig.height)
                    cctx.restore()
                }


                vctx.save()
                // vctx.scale(-1, 1)
                // vctx.translate(-videoConfig.width, 0)
                vctx.drawImage(video,0,0,videoConfig.width,videoConfig.height)
                vctx.restore()
            }

            //get compared poss
            poses.forEach((pose)=>{
                //get compare poses (0-1seconds)
                //todo
                let [newIndex , comparePoses] =getComparedPose(pose,video,poseFile,startIndex,trainingFramePerSecond,deactivateMask)
                startIndex = newIndex

                if (guiState.output.showPoints){
                    drawKeypointsWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                    drawKeypointsWithMask(pose.keypoints,cctx,pose.mask)
                }
                if (guiState.output.showSkeleton){
                    drawSkeletonWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                    drawSkeletonWithMask(pose.keypoints,cctx,pose.mask)
                }

                if (comparePoses.length==0){
                    font.innerText='未检测到所有关键点';
                    video.pause();
                }
                else {
                    let [isPass ,noPassNum , lowConfidenceJointMask,overConfidenceJointsMask] = comparePoseWithVideo(pose,comparePoses,guiState.confidence.compareThreshold)

                    if (DEBUG){
                        console.log('comparePose:');
                        console.log(comparePoses);
                        console.log(isPass)
                        console.log('kps:')
                        console.log(pose.keypoints)
                        console.log('low confidence kps:')
                        console.log(lowConfidenceJointMask)
                    }

                    if (noPassNum==-1){
                        font.innerText = '无有效关键点'
                        video.pause()
                    }
                    else{
                        if (noPassNum==0){
                            font.innerText = '通过'
                            if (isPass&&videoConfig.videoState=='pause'){
                                video.play()
                            }

                            if (guiState.output.showPoints) {
                                drawKeypointsWithMask(pose.keypoints,cctx,overConfidenceJointsMask,'green',4)
                            }

                            if (guiState.output.showSkeleton){
                                drawSkeletonWithMask(pose.keypoints,cctx,overConfidenceJointsMask,'green',3)
                            }
                        }
                        else {
                            font.innerText = '未通过'+ noPassNum.toString()
                            if(!isPass&&videoConfig.videoState=='play') {
                                video.pause()
                            }

                            if (guiState.output.showPoints) {
                                drawKeypointsWithMask(pose.keypoints,cctx,overConfidenceJointsMask,'green',4)
                                drawKeypointsWithMask(pose.keypoints,cctx,lowConfidenceJointMask,'red',5)
                            }

                            if (guiState.output.showSkeleton){
                                drawSkeletonWithMask(pose.keypoints,cctx,overConfidenceJointsMask,'green',3)
                                drawSkeletonWithMask(pose.keypoints,cctx,lowConfidenceJointMask,'red',4)
                            }
                        }
                    }
                }
            })

        }

        //get fps
        stats.update()

        DEBUG = 0
        requestAnimationFrame(poseDetectionFrame)

    }

    stats.end()

    poseDetectionFrame()
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

const IN_SERVER = 0;

let url = IN_SERVER==1? 'https://139.196.138.230' : 'http://localhost'

const videoConfig ={
    videoState:'ended',
    videoFile:{
        bucket:`${url}:1234/static/videos/`,
    },
    poseFile:{
        bucket:`${url}:1234/static/poses/`,
    },
    getVideoListUrl:`${url}:1234/videoList`,
    width:540,
    height:480
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
    let cameras = await getCameraList()

    //load videoList
    let videoList = await loadVideoList(videoConfig)

    //load learning video
    let video = await loadVideo(guiState.video.name,videoConfig,'trainVideo')

    //load poseFile from Backend
    let poseFile = await loadPoseFile()

    // init button
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
        let camera = await loadCamera(cameras[0].id,videoConfig,'camera')

        setupGui(videoList,cameras)
        setupFPS()

        detectPoseInRealTime(net,video,camera,poseFile)
    }
}

runDemo()