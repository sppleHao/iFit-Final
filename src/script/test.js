import Stats from 'stats.js'
import dat from 'dat.gui'
import $ from 'jquery'
import * as math from 'mathjs'
import * as loadModel from "./net/iFitNet/src/loadModel"
import {drawKeypointsWithMask, drawSkeletonWithMask, loadCanvas} from "./utils/canvas";
import {andMask, getConfidenceMask, getDeactivateMask} from "./utils/confidence";
import {loadVideoList,loadVideo} from "./utils/video";
import {getCameraList,loadCamera} from "./utils/camera";
import {compareTwoPoseWithScores,compareOutput} from "./utils/compareWithScore";
import {getFrontUrl} from "./utils/config";
import {angelArrayToJointMask} from "./utils/utils";
import * as cocoSsd from "@tensorflow-models/coco-ssd/dist/index";

//DEBUG settings
let DEBUG = 1

//FPS
const stats = new Stats()

const label={
    name:'perfect',
    width:0,
    height:0
}

function randomLabelPositon() {
    label.width = videoConfig.width*(0.2+Math.random()*0.5)
    label.height = videoConfig.height*(0.2+Math.random()*0.5)
}

/**
 * draw  label ：good or perfect
 */
function drawLabel(ctx,alpha) {
    let x = label.width
    let y = label.height

    let imageWidth =200
    let imageHeight = 200

    if (label.name!=''){
        //找名字为label的图片：good/perfect bad不显示
        let labelImg=document.getElementById(label.name)
        //随机位置（圈定一定范围）生成图片

        ctx.drawImage(labelImg,x,y,imageWidth,imageHeight)
        // var imgData = ctx.getImageData(x , y , imageWidth , imageHeight);
        // for (var i = 0 , len = imgData.data.length ; i < len ; i += 4 )
        // {
        //     // 改变每个像素的透明度
        //     imgData.data[i + 3] = imgData.data[i + 3] * alpha;
        // }
        // // 将获取的图片数据放回去。
        // ctx.putImageData(imgData , x , y);
    }
}

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
 * get min element from array
 * @returns {number}
 */
Array.prototype.min = function(){
    return Math.min.apply({},this)
}

/**
 * get max element from array
 * @returns {number}
 */
Array.prototype.max = function(){
    return Math.max.apply({},this)
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
        poseSimilarityScores.push(result.getPoseSimilarityScore())
        results.push(result)
    }


    let maxTotalSimilarityScore = poseSimilarityScores.max()
    let finalResult = results[poseSimilarityScores.indexOf(maxTotalSimilarityScore)]

    // console.log('result',finalResult)


    return finalResult;
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
}

let totalMarks = [];
let partMarks = [];

function computeFinalMark() {

    function randomNum(minNum,maxNum){
        switch(arguments.length){
            case 1:
                return parseInt(Math.random()*minNum+1,10);
                break;
            case 2:
                return parseInt(Math.random()*(maxNum-minNum+1)+minNum,10);
                break;
            default:
                return 0;
                break;
        }
    }

    let mark = 0;
    let length = totalMarks.length;
    if (length>0){
        mark = math.median(totalMarks)
    }

    let finalMark = 0

    if (mark>0.4){
        //perfect
        finalMark = randomNum(85,100)
    }
    else if (mark>0.30){
        //good
        finalMark = randomNum(70,84)
    }
    else if (mark>0.25){
        //normal
        finalMark = randomNum(55,69)
    }
    else if (mark<0.2){
        //bad
        finalMark = randomNum(40,54)
    }
    // let final
    totalMarks = []

    return finalMark;
}

/**
 *  Detect Poses
 * @param camera Video Element
 * @param model
 */
function detectPoseInRealTime(ssd,net,video,camera,poseFile) {
    let font = document.getElementById('font');
    let mark = document.getElementById('mark');

    //camera canvas
    const ccanvas = loadCanvas('coutput',videoConfig.width,videoConfig.height)
    const cctx = ccanvas.getContext('2d');

    //video canvas
    const vcanvas = loadCanvas('voutput',videoConfig.width,videoConfig.height)
    const vctx = vcanvas.getContext('2d');

    const originCanvas = loadCanvas('origin',videoConfig.width,videoConfig.height)
    const octx = originCanvas.getContext('2d');

    async function detectPersons() {
        // console.time('detect')
        if (guiState.personDetection.open&&ssd){
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

    let detection = setInterval(detectPersons,guiState.personDetection.interval)

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

        if (guiState.changeNetwork){
            // net.dispose()
            net = await loadModel.load(guiState.changeNetwork)
            guiState.changeNetwork = null
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

        async function cropEstimate() {
            if (net){
                let box = guiState.person
                let imData = octx.getImageData(...box)

                let pose = await net.estimateSinglePose(imData, !guiState.output.flipHorizontal)
                pose.keypoints.forEach(keypoint=>{
                    keypoint.position.x += box[0];
                    keypoint.position.y += box[1];
                })

                let poses =[]

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
                        cctx.strokeStyle= 'aqua'
                        cctx.strokeRect(...box)
                    }


                    let result = comparePoseWithVideoPoses(pose,comparePoses,guiState.confidence.minPoseConfidence);

                    let score = result.getPoseSimilarityScore()

                    // font.innerText = score.toString()

                    partMarks.push(score)


                    //draw low confidence joint
                    if (guiState.output.showPoints) {
                        let jointScores =result.getJointSimilarityScores();
                        let mask = []
                        for (let i=0;i<jointScores.length;i++){
                            if (jointScores[i]>0&&jointScores[i]<guiState.confidence.JointCompareThreshold) {
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
                })

            }
            else {
                //draw canvas
                cctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
                vctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
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

                    if (guiState.output.showPoints){
                        drawKeypointsWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                    }
                    if (guiState.output.showSkeleton){
                        drawSkeletonWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                    }
                }
            }
        }

        async function normalEstimate() {
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


                    let result = comparePoseWithVideoPoses(pose,comparePoses,guiState.confidence.minPoseConfidence);

                    let score = result.getPoseSimilarityScore()

                    // font.innerText = score.toString()

                    partMarks.push(score)

                    //draw low confidence joint
                    if (guiState.output.showPoints) {
                        let jointScores =result.getJointSimilarityScores();
                        let mask = []
                        for (let i=0;i<jointScores.length;i++){
                            if (jointScores[i]>0&&jointScores[i]<guiState.confidence.JointCompareThreshold) {
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
                })

            }
            else {
                //draw canvas
                cctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
                vctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
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

                    if (guiState.output.showPoints){
                        drawKeypointsWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                    }
                    if (guiState.output.showSkeleton){
                        drawSkeletonWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                    }
                }
            }
        }

        function IsPersonInCenter(person) {
            let [boxMinX,boxMinY,boxW,boxH] = person
            let boxMaxX = boxMinX + boxW
            let boxMaxY = boxMinY + boxH
            let boxCX = boxMinX + boxW/2
            let boxCY = boxMinY + boxH/2
            if (boxCX>videoConfig.width*0.4&&boxCX<videoConfig.width*0.6&&boxCY>videoConfig.height*0.4&&boxCY<videoConfig.height*0.6){
                return true
            }
            else {
                return false
            }
        }

        async function onlyDrawInCanvas() {
            //draw canvas
            cctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
            vctx.clearRect(0, 0, videoConfig.width, videoConfig.height)
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

                if (guiState.output.showPoints){
                    drawKeypointsWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                }
                if (guiState.output.showSkeleton){
                    drawSkeletonWithMask(poseFile[startIndex].keypoints,vctx,poseFile[startIndex].mask)
                }
            }
        }

        octx.clearRect(0, 0, videoConfig.width, videoConfig.height)
        if (guiState.output.flipHorizontal){
            octx.save();
            octx.scale(-1, 1)
            octx.translate(-videoConfig.width, 0)
            octx.drawImage(camera,0,0,videoConfig.width,videoConfig.height)
            octx.restore();
        }
        else {
            octx.drawImage(camera,0,0,videoConfig.width,videoConfig.height)
            octx.restore()
        }

        if (guiState.personDetection.open&&ssd!=null){
            if (guiState.person.length>0) {
                let center =IsPersonInCenter(guiState.person)
                if (!center){
                    await cropEstimate()
                }
                else {
                    await normalEstimate()
                }
            }
            else {
                await normalEstimate()
            }
            //get the pose
        }
        else if(ssd==null){
            await normalEstimate()
        }
        else {
            if (guiState.person.length>0){
                await normalEstimate()
            }
            else {
                await normalEstimate()
            }
        }

        // console.log(guiState.person)

        //get fps
        stats.update()

        DEBUG = 0
        requestAnimationFrame(poseDetectionFrame)

    }

    stats.end()

    function computeTotalMark() {
        let totalMark = 0
        let length = partMarks.length
        if (length>0){
            // console.log('partMark',partMarks)
            totalMark = math.mean(partMarks)
        }
        if (videoConfig.videoState=='play'){
            console.log(totalMark)
            totalMarks.push(totalMark)
        }
        // console.log(totalMark)
        //interaction
        if (totalMark>0.4){
            //perfect
            mark.innerText = 'Perfect';
            label.name = 'perfect'
            randomLabelPositon();
        }
        else if (totalMark>0.30){
            //good
            mark.innerText =  'Good';
            label.name = 'good'
            randomLabelPositon();
        }
        else if (totalMark>0.25){
            //normal
            label.name = ''
            mark.innerText =  'Normal';
        }
        else if (totalMark<0.2){
            //bad
            label.name = ''
            mark.innerText = 'Bad';
        }

        partMarks.splice(0,length)
    }

    setInterval(computeTotalMark,2000)

    poseDetectionFrame()
}

const guiState = {
    person:[],
    net:'HRNet',
    video:{
        name:'dancecrop.mp4'
    },
    confidence:{
        lambda:0.7,
        minPoseConfidence:0.25,
        AngleCompareThreshold:0.1,
        JointCompareThreshold:0.2,
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
        flipHorizontal:true
    },
    camera:{
        deviceName:null
    },
    network:{
        usePoseNet:false
    },
    deactivateArray:[],
    personDetection:{
        open:false,
        interval:500,
    },
}

const IN_SERVER = 0;

let url = getFrontUrl()

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
    confidence.add(guiState.confidence,'lambda',0.0,1.0);
    confidence.add(guiState.confidence,'AngleCompareThreshold',0.0,1.0);
    confidence.add(guiState.confidence,'JointCompareThreshold',0.0,1.0);

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

    //load ssd model
    let ssd = null
    try {
     // ssd = await cocoSsd.load()
    }
    catch (e) {

    }

    //load pose model
    let net =await loadModel.load(guiState.net)

    //get camera list
    let cameras = await getCameraList()

    //load videoList
    let videoList = await loadVideoList(videoConfig)

    //load learning video
    let video = await loadVideo(guiState.video.name,videoConfig,'trainVideo')

    let final = document.getElementById('final')

    video.addEventListener('ended',function () {
        let finalMark = computeFinalMark(totalMarks)
        // alert('总分:'+ finalMark.toString())
        final.innerText = '总分:'+ finalMark.toString()
        button.innerText = '重新开始'
    });

    //load poseFile from Backend
    let poseFile = await loadPoseFile()

    // init button
    let button = document.getElementById('button');
    button.onclick = function () {
        if(videoConfig.videoState=='pause'||videoConfig.videoState=='ended'){
            setTimeout(()=>{
                video.play();
                button.innerText = '暂停'
            },3000)
            let second =3;
            final.innerText = second.toString()
            let c =setInterval(clock,1000)
            function clock() {
                second--
                final.innerText = second.toString()
                if (second==0){
                    clearInterval(c)
                    final.innerText=''
                }
            }

        }
        else{
            video.pause();
            button.innerText = '继续'
        }
    };

    if (cameras.length>0){
        //load camera
        guiState.camera.deviceName = cameras[0].name
        let camera = await loadCamera(cameras[0].id,videoConfig,'camera')

        setupGui(videoList,cameras)
        setupFPS()

        detectPoseInRealTime(ssd,net,video,camera,poseFile)
    }
}

runDemo()