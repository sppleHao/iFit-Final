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
import {angelArrayToJointMask} from "./utils/utils";
import {angelVoice, simpleVoice} from "./utils/voice";

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
    for (let i = 0;i<3&&i+newIndex<poseFile.length;i++){
        let temp = poseFile[newIndex + i];
        if (temp.vmask ==null){
            temp.vmask = temp.mask
        }
        temp.mask = andMask(temp.vmask,deactivateMask)
        // if (isBelongMask(temp.mask,pose.mask)){
            //camera pose mask must larger than file pose mask
            comparePoses.push(temp);
        // }
    }

    return [newIndex,comparePoses]
}

/**
 * get max element from array
 * @returns {number}
 */
Array.prototype.max = function(){
    return Math.max.apply({},this)
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
 */
function comparePoseWithVideoPoses(currentPose,comparedPoses,threshHold){
    let results = [];
    let poseSimilarityScores = []
    for (let i=0;i<comparedPoses.length;i++){
        let result = compareTwoPoseWithScores(currentPose,comparedPoses[i],guiState.confidence.lambda)
        console.log('result',result)
        results.push(result)
        poseSimilarityScores.push(result.getPoseSimilarityScore())
    }


    let maxTotalSimilarityScore = poseSimilarityScores.max()
    let finalResult = results[poseSimilarityScores.indexOf(maxTotalSimilarityScore)]

    return finalResult;
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

        if (guiState.personDetection.open){
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
                    vctx.drawImage(video,0,0,videoConfig.width,videoConfig.height)
                    vctx.restore()
                }

                //get compared poss
                poses.forEach((pose)=>{
                    //get compare poses (0-1seconds)
                    //todo
                    let [newIndex , comparePoses] =getComparedPose(pose,video,poseFile,startIndex,trainingFramePerSecond,deactivateMask)
                    startIndex = newIndex

                    let currentMask = andMask(pose.confidenceMask,pose.deactivateMask)

                    if (guiState.output.showPoints){
                        drawKeypointsWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                        drawKeypointsWithMask(pose.keypoints,cctx,currentMask)
                    }
                    if (guiState.output.showSkeleton){
                        drawSkeletonWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                        drawSkeletonWithMask(pose.keypoints,cctx,currentMask)
                    }

                    console.log(comparePoses)

                    let result = comparePoseWithVideoPoses(pose,comparePoses,guiState.confidence.minPoseConfidence);

                    let isPass = true;

                    //draw low confidence joint
                    if (guiState.output.showPoints) {
                        let jointScores =result.getJointSimilarityScores();
                        let mask = []
                        for (let i=0;i<jointScores.length;i++){
                            if (jointScores[i]>0&&jointScores[i]<guiState.confidence.JointCompareThreshold) {
                                isPass = false
                                mask.push(true)
                            }
                            else {
                                mask.push(false)
                            }
                        }
                        drawKeypointsWithMask(pose.keypoints,cctx,mask,'red',8)
                    }

                    //draw low confidence angels
                    if (guiState.output.showSkeleton){
                        let angelSimilarityScores = result.getAngleSimilarityScores();
                        let angelArray = []
                        for (let i=0;i<angelSimilarityScores.length;i++){
                            if (angelSimilarityScores[i]>0&&angelSimilarityScores[i]<guiState.confidence.AngleCompareThreshold) {
                                isPass = false
                                angelArray.push(i)
                            }
                        }

                        // font.innerText = angelArray.toString() + '未通过'
                        let angleLowConfidenceJointMask = angelArrayToJointMask(angelArray);
                        if (angelArray.length>0){
                            let angelIndex = angelArray[angelArray.length-1];
                            let angelState = result.getAngelStateCompareTwoPose(angelIndex);
                            guiState.lowConfidenceAngel = {index:angelIndex,state:angelState};
                        }
                        let mask  = andMask(angleLowConfidenceJointMask,currentMask)
                        drawSkeletonWithMask(pose.keypoints,cctx,mask,'orange')
                    }

                    if (isPass){
                        guiState.lowConfidenceAngel = null
                        // font.innerText = '通过'
                    }

                    if (isPass&&videoConfig.videoState!='ended'){
                        video.play()
                    }
                    else {
                        video.pause()
                    }
                })

            }
            else {
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
            }
        }
        else {
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
                    vctx.drawImage(video,0,0,videoConfig.width,videoConfig.height)
                    vctx.restore()
                }

                //get compared poss
                poses.forEach((pose)=>{
                    //get compare poses (0-1seconds)
                    //todo
                    let [newIndex , comparePoses] =getComparedPose(pose,video,poseFile,startIndex,trainingFramePerSecond,deactivateMask)
                    startIndex = newIndex

                    let currentMask = andMask(pose.confidenceMask,pose.deactivateMask)

                    if (guiState.output.showPoints){
                        drawKeypointsWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                        drawKeypointsWithMask(pose.keypoints,cctx,currentMask)
                    }
                    if (guiState.output.showSkeleton){
                        drawSkeletonWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                        drawSkeletonWithMask(pose.keypoints,cctx,currentMask)
                    }
                    if (guiState.output.drawBoundingBox){
                        //画一个推荐区域的牌子
                        cctx.strokeRect(videoConfig.width*0.1,videoConfig.height*0.1,videoConfig.width*0.8,videoConfig.height*0.8)
                    }

                    console.log(comparePoses)

                    let result = comparePoseWithVideoPoses(pose,comparePoses,guiState.confidence.minPoseConfidence);

                    let isPass = true;

                    //draw low confidence joint
                    if (guiState.output.showPoints) {
                        let jointScores =result.getJointSimilarityScores();
                        let mask = []
                        for (let i=0;i<jointScores.length;i++){
                            if (jointScores[i]>0&&jointScores[i]<guiState.confidence.JointCompareThreshold) {
                                isPass = false
                                mask.push(true)
                            }
                            else {
                                mask.push(false)
                            }
                        }
                        drawKeypointsWithMask(pose.keypoints,cctx,mask,'red',8)
                    }

                    //draw low confidence angels
                    if (guiState.output.showSkeleton){
                        let angelSimilarityScores = result.getAngleSimilarityScores();
                        let angelArray = []
                        for (let i=0;i<angelSimilarityScores.length;i++){
                            if (angelSimilarityScores[i]>0&&angelSimilarityScores[i]<guiState.confidence.AngleCompareThreshold) {
                                isPass = false
                                angelArray.push(i)
                            }
                        }

                        // font.innerText = angelArray.toString() + '未通过'
                        let angleLowConfidenceJointMask = angelArrayToJointMask(angelArray);
                        if (angelArray.length>0){
                            let angelIndex = angelArray[angelArray.length-1];
                            let angelState = result.getAngelStateCompareTwoPose(angelIndex);
                            guiState.lowConfidenceAngel = {index:angelIndex,state:angelState};
                        }
                        let mask  = andMask(angleLowConfidenceJointMask,currentMask)
                        drawSkeletonWithMask(pose.keypoints,cctx,mask,'orange')
                    }

                    if (isPass){
                        guiState.lowConfidenceAngel = null
                        // font.innerText = '通过'
                    }

                    if (isPass&&videoConfig.videoState!='ended'){
                        video.play()
                    }
                    else {
                        video.pause()
                    }
                })

            }
            else {
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
            }
        }


        //get fps
        stats.update()

        DEBUG = 0
        requestAnimationFrame(poseDetectionFrame)

    }

    let voice = setInterval(()=>{
        if (videoConfig.videoState!='play'){

            //if read (5s interval)
            if (guiState.noPassTime==5) {
                if (guiState.lowConfidenceAngel != null) {
                    angelVoice(guiState.lowConfidenceAngel.index, guiState.lowConfidenceAngel.state)
                    guiState.noPassTime=1;
                }
                else{

                }
            }
            else {
                guiState.noPassTime++;
            }
        }
    },1000)

    stats.end()

    poseDetectionFrame()
}

const guiState = {
    video:{
        name:'out2.mp4'
    },
    confidence:{
        minPoseConfidence:0.15,
        AngleCompareThreshold:0.1,
        JointCompareThreshold:0.2,
        lambda:0.7
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
        flipHorizontal:true,
        drawBoundingBox:true
    },
    camera:{
        deviceName:null
    },
    net:'Hourglass',
    noPassTime:1,
    lowConfidenceAngel:null,
    deactivateArray:[],
    personDetection:{
        open:false,
        interval:300,
    },
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

    let confidence = gui.addFolder('Confidence Controller');
    confidence.add(guiState.confidence,'minPoseConfidence',0.0,1.0);
    confidence.add(guiState.confidence,'AngleCompareThreshold',0.0,1.0);
    confidence.add(guiState.confidence,'JointCompareThreshold',0.0,1.0);

    //deactivate joints
    let joints = gui.addFolder('Joint Controller');
    for (let k in guiState.joints){
        let c = joints.add(guiState.joints,k.toString());
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
    output.add(guiState.output,'drawBoundingBox')

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

    let person = gui.addFolder('PersonDetection')
    person.add(guiState.personDetection, 'open')
    let interval = person.add(guiState.personDetection, 'interval',100,300)
    interval.onChange(function (number) {
        guiState.changePersonDetectionInterval = parseInt(number)
    })
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
    let net =await loadModel.load(guiState.net)

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

        // let camera = await loadVideo('test.mp4',videoConfig,'camera')

        setupGui(videoList,cameras)
        setupFPS()

        detectPoseInRealTime(net,video,camera,poseFile)
    }
}

runDemo()