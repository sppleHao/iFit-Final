import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as loadModel from "./net/iFitNet/src/loadModel"
import {drawKeypointsWithMask, drawSkeletonWithMask, loadCanvas} from "./utils/canvas";
import {andMask, getConfidenceMask, getDeactivateMask, isBelongMask} from "./utils/confidence";
import {loadVideoList,loadVideo} from "./utils/video";
import {getCameraList,loadCamera} from "./utils/camera";
import {getFrontUrl} from "./utils/config";
import {compareTwoPoseWithScores} from "./utils/compareWithScore";

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
 *
 * @param currentPose
 * @param comparedPoses
 * @param threshHold
 * @returns {compareOutput}
 */
function comparePoseWithVideo(currentPose,comparedPose,lambda){
    let result = compareTwoPoseWithScores(currentPose,comparedPose,lambda);
    console.log(result)
    return result
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
function detectPoseInRealTime(net,model,camera,poseFile) {
    let font = document.getElementById('font')

    //camera canvas
    const ccanvas = loadCanvas('coutput',videoConfig.width,videoConfig.height)
    const cctx = ccanvas.getContext('2d');

    //video canvas
    const vcanvas = loadCanvas('voutput',videoConfig.width,videoConfig.height)
    const vctx = vcanvas.getContext('2d');

    //config
    let startIndex = 0

    let state = 0;

    if (DEBUG){
        console.log('videoFPS')
    }

    //loop
    async function poseDetectionFrame() {

        if (videoConfig.videoState=='ended'){
            startIndex = 0
        }

        if (guiState.changeVideoName){
            model = await loadVideo(guiState.changeVideoName,videoConfig,'trainVideo',true)
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
            let poses =[]
            let pose = await net.estimateSinglePose(camera, guiState.output.flipHorizontal)

            // console.timeEnd('poseTime')

            if (DEBUG){
                console.log('Estimate...')
                console.log(pose)
            }

            //get mask
            let confidenceMask = getConfidenceMask(pose.keypoints,guiState.confidence.minPoseConfidence);
            let deactivateMask = getDeactivateMask(pose.keypoints,guiState.deactivateArray);
            pose.confidenceMask = confidenceMask
            pose.deactivateMask = deactivateMask

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
                vctx.drawImage(model,0,0,videoConfig.width,videoConfig.height)
                vctx.restore()
            }

            //get compared poss
            poses.forEach((pose)=>{
                //get compare poses (0-1seconds)

                if (state == 0){
                    //play model
                    if (videoConfig.videoState=='pause'){
                        state=1
                    }
                }
                else if(state == 1){ //if model play end
                    //pose equals to start pose
                    let comparePose = poseFile[startIndex];

                    //draw pose in camera canvas
                    if (guiState.output.showPoints){
                        drawKeypointsWithMask(comparePose.keypoints,cctx,comparePose.mask)
                    }
                    if (guiState.output.showSkeleton){
                        drawSkeletonWithMask(comparePose.keypoints,cctx,comparePose.mask)
                    }

                    if (startIndex==0){
                        //compare pose
                        let result = comparePoseWithVideo(pose,comparePose,guiState.confidence.lambda)
                        let score = result.getPoseSimilarityScore()
                        if (score>guiState.confidence.compareThreshold){
                            console.log(score)
                            startIndex++;
                            //voice:pass
                        }
                        else {
                            //voice
                        }

                        // font.innerText = score.toString()
                    }
                    else if (startIndex==poseFile.length-1){
                        //compare pose and change state
                        let result = comparePoseWithVideo(pose,comparePose,guiState.confidence.minPoseConfidence);
                        let score = result.getPoseSimilarityScore()
                        if (score>guiState.confidence.compareThreshold){
                            //show pass or score todo

                            //change state
                            state = 0;
                            startIndex=0;
                            model.play();
                        }
                        else {
                            //voice
                        }

                        font.innerText = score.toString()
                    }
                    else {
                        //show pose track
                        if (startIndex<poseFile.length-1) {
                            startIndex++;
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
    net:'HRNet',
    video:{
        name:'model1.mov'
    },
    confidence:{
        minPoseConfidence:0.15,
        compareThreshold:0.4,
        lambda:0.7
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

const url = getFrontUrl()

const videoConfig ={
    videoState:'ended',
    videoFile:{
        bucket:`${url}/static/videos/`,
    },
    poseFile:{
        bucket:`${url}/static/poses/`,
    },
    getVideoListUrl:`${url}/videoList`,
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
    gui.domElement.style = 'position:absolute;top:50px;right:0px';

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
    let net =await loadModel.load()

    //get camera list
    let cameras = await getCameraList()

    //load videoList
    let videoList = await loadVideoList(videoConfig)

    //load 3d model
    let model = await loadVideo(guiState.video.name,videoConfig,'model',true)

    model.addEventListener('play',function () {
        videoConfig.videoState='play';
        setTimeout(()=>{
            model.pause()
        },2600)
    });

    model.addEventListener('pause',function () {
        videoConfig.videoState='pause';
    });

    model.addEventListener('ended',function () {
        videoConfig.videoState='ended';
        model.pause();
    });

    //load pose(skeleton) file from Backend
    let poseFile = await loadPoseFile()

    // init button
    let button = document.getElementById('button');
    button.onclick = function () {
        if(videoConfig.videoState=='pause'||videoConfig.videoState=='ended'){
            model.play();
        }
        else{
            model.pause();
        }
    };

    if (cameras.length>0){
        //load camera
        guiState.camera.deviceName = cameras[0].name
        let camera = await loadCamera(cameras[0].id,videoConfig,'camera')

        setupGui(videoList,cameras)
        setupFPS()

        detectPoseInRealTime(net,model,camera,poseFile)
    }
}

runDemo()