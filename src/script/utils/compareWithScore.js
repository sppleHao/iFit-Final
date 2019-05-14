import * as math from 'mathjs'
import {andMask} from "./confidence";
import {getAngles, getLinks} from "./config";

const links = getLinks();
const angles = getAngles();

let DEBUG = 0;

const jointIndexMap= angles.map((linkIndexes)=>{
    let joints = []
    linkIndexes.forEach(linkIndex=>{
        let link = links[linkIndex]
        link.forEach(jointIndex=>{
            joints.push(jointIndex)
        })
    })
    return joints
})

function toTuple({y, x}) {
    return [y, x];
}

function getTensorMul([x,y],[x2,y2]) {
    return [x*x2,y*y2]
}

function getTensorSub([x1,y1],[x2,y2]) {
    return [x1-x2,y1-y2]
}

/**
 * length
 */
function norm([ax,ay]) {
    return Math.sqrt(ax*ax+ay*ay)
}

/**
 * 1D tensor dot
 */
function dot([ax,ay],[bx,by]) {
    return ax*bx + ay * by
}

/**
 * get angle's cos
 * @param tensor1
 * @param tensor2
 * @returns {number}
 */
function cos(tensor1,tensor2) {
    if ((dot(tensor1,tensor2))==0){
        return 0;
    }
    let result = (dot(tensor1,tensor2))*1.0/ (norm(tensor1)* norm(tensor2))
    if (result>1){
        result = 1
    }
    if (result<-1){
        result = -1
    }
    return  result
}

/**
 * compute two joint euclidean distance
 * @param joint1
 * @param joint2
 * @returns {*}
 */
function euclidean(joint1,joint2) {
    return norm(getTensorSub(toTuple(joint1.position),toTuple(joint2.position)))
}

function getCompareJointTensor(joint1,joint2) {
    return getTensorSub(toTuple(joint1.position),toTuple(joint2.position))
}

/**
 * get angel cos
 * @param kps
 * @param angleIndex
 * @returns {number}
 */
export function getAngleCos(kps,angleIndex) {
    let linkIndexes = angles[angleIndex]
    let tensors = linkIndexes.map((linkIndex)=>{
        let link = links[linkIndex]
        // console.log('link',link,toTuple(kps[link[0]].position),toTuple(kps[link[1]].position))
        return getTensorSub(toTuple(kps[link[0]].position),toTuple(kps[link[1]].position))
    })

    // console.log('tensors',tensors)

    return cos(...tensors)

}

/**
 * get keypoint associate angles
 * @param kpIndex
 * @returns {Array}
 */
function getAssociateAngles(kpIndex) {
    let associateAngleIndexes = []
    for (let i= 0;i<jointIndexMap.length;i++){
        if (jointIndexMap[i].indexOf(kpIndex)!=-1){
            associateAngleIndexes.push(i)
        }
    }
    return associateAngleIndexes
}

function computeAngle(angleIndex,keypoints) {
    return Math.acos(getAngleCos(keypoints,angleIndex))
}

/**
 * 关节点相似度 = 关节点位置分布 * 关节点置信度
 * @param cameraPoseKp
 * @param videoPoseKp
 * @param cameraPoseAngleDegrees
 * @param videoPoseAngleDegrees
 * @returns {number[]}
 */
function getAngleSimilarityScores(cameraPoseKp,videoPoseKp,cameraPoseAngleDegrees,videoPoseAngleDegrees) {
    let angleIndex = 0;
    return angles.map(([linkIndex1,linkIndex2])=>{
        let [j11,j12] = links[linkIndex1];
        let [j21,j22] = links[linkIndex2];

        let scores = [cameraPoseKp[j21].score,cameraPoseKp[j12].score,cameraPoseKp[j21].score,cameraPoseKp[j22].score]
        let minConfidence = math.min(scores)

        if (minConfidence== -1){
            angleIndex++
            return -1;
        }

        //get min score of joint
        let differenceScore = 1 - Math.abs(cameraPoseAngleDegrees[angleIndex] - videoPoseAngleDegrees[angleIndex])/180;

        let medianConfidence = math.median(scores)
        let meanConfidence = math.median(scores)

        angleIndex++

        return differenceScore * meanConfidence;
    })
}

function getMaskJointsPosition(Kps,mask){
    let x_list = []
    let y_list = []
    for (let i=0;i<Kps.length;i++){
        if (mask[i]){
            let out = toTuple(Kps[i].position)
            x_list.push(out[1])
            y_list.push(out[0])
        }
    }

    return [x_list,y_list]
}

function getCenterOfPose(Kps,mask) {

    let [x_list,y_list] = getMaskJointsPosition(Kps,mask)

    let meanx = math.mean(x_list);
    let meany = math.mean(y_list);

    return [meany,meanx]
}

function getSiegeArea(Kps,mask) {
    let [x_list,y_list] = getMaskJointsPosition(Kps,mask)
    
    if (x_list.length>0){
        let minX = math.min(x_list)
        let maxX = math.max(x_list)
        let minY = math.min(y_list)
        let maxY = math.max(y_list)
        return [(maxX-minX)/2,(maxY-minY)/2];
    }
    else {
        return [1,1]
    }



}

function getScaleOfPose(cameraPoseKp,videoPoseKp,mask) {
    let [cx,cy] = getSiegeArea(cameraPoseKp,mask)
    let [vx,vy] = getSiegeArea(videoPoseKp,mask)
    
    return [vx/cx,vy/cy]

}

/**
 * compute joint position similarity scores
 *  关节点相似度 = 关节点位置分布 * 关节点置信度 / 0.6
 * @param cameraPoseKp
 * @param videoPoseKp
 * @returns {*[]}
 */
function getJointSimilarityScores(cameraPoseKp,videoPoseKp,mask) {
    let origin_distances = []
    let tensors = []
    let count =cameraPoseKp.length

    let cameraPoseCenter = getCenterOfPose(cameraPoseKp,mask);
    let videoPoseCenter = getCenterOfPose(videoPoseKp,mask);

    let scale =getScaleOfPose(cameraPoseKp,videoPoseKp,mask)
    // console.log(scale,cameraPoseCenter,videoPoseCenter,tensorOffset)

    for (let i=0;i<count;i++){
        let j1 = cameraPoseKp[i]
        let j2 = videoPoseKp[i]
        // let distance = euclidean(j1,j2)
        let j1Tensor = getTensorSub(toTuple(j1.position),cameraPoseCenter)
        let j2Tensor = getTensorSub(toTuple(j2.position),videoPoseCenter)
        let tensor = getTensorSub(getTensorMul(j1Tensor,scale),j2Tensor)
        tensors.push(tensor)
        // distances.push(distance)
    }

    // let x_list = tensors.map((t)=>{return t[0]})
    // let y_list = tensors.map((t)=>{return t[1]})
    //
    // let medianX = math.median(x_list)
    // let medianY = math.median(y_list)
    //
    // console.log(medianX,medianY)

    let distances = []

    for (let i=0;i<tensors.length;i++){
        let tensor = tensors[i]
        origin_distances.push(norm(tensor))
        if (mask[i]){
            distances.push(norm(tensor))
        }
    }

    console.log(distances)

    let median = math.median(distances)

    let scores = distances.map(d=>{
        return 1 / (1 + Math.exp(Math.abs(d-median)/1.15 / median) )
    })

    // let mean = math.mean(distances)
    // let stddev = math.std(distances)
    // let scores = distances.map( (x)=>{
    //     let score = 1- math.erf((x-mean)/stddev/math.sqrt(2));
    //     return score>0? score/2 :0
    // })

    for (let i =0 ;i<count;i++){
        if (!mask[i]){
            scores.splice(i,0,-1)
        }
        else {
            // scores[i] = scores[i] *  /0.6
        }
    }

    console.log(scores)

    return [scores,origin_distances]
}

/**
 * 姿态相似度 = lambda * 1/J * ∑关节点相似度 + (1-lambda) * 1/A * ∑角度相似度
 * @param jointSimilarityScores
 * @param angelSimilarityScores
 * @param lambda
 * @returns {number}
 */
function getPoseSimilarityScore(jointSimilarityScores,angelSimilarityScores,lambda) {
    return lambda * math.mean(jointSimilarityScores) + (1-lambda) * math.mean(angelSimilarityScores)
}

function computePartSimilarityScores(cameraPose,videoPose,lambda,mask){
    let result = new compareOutput();

    let cameraPoseAngleRadian = angles.map(angle=>{
        let angelIndex = angles.indexOf(angle)
        return computeAngle(angelIndex,cameraPose.keypoints)
    })

    let videoPoseAngleRadian = angles.map(angle=>{
        let angelIndex = angles.indexOf(angle)
        return computeAngle(angelIndex,videoPose.keypoints)
    })

    let cameraPoseAngleDegrees = cameraPoseAngleRadian.map(radian=>{
        return radian * 180 /Math.PI;
    })

    let videoPoseAngleDegrees = videoPoseAngleRadian.map(radian=>{
        return radian * 180 /Math.PI;
    })

    let [jointSimilarityScores,jointPositionTensors] = getJointSimilarityScores(cameraPose.keypoints,videoPose.keypoints,mask)
    let angelSimilarityScores = getAngleSimilarityScores(cameraPose.keypoints,videoPose.keypoints,cameraPoseAngleDegrees,videoPoseAngleDegrees)
    let poseSimilarityScore = getPoseSimilarityScore(jointSimilarityScores,angelSimilarityScores,lambda)

    result.setPoses(cameraPose,videoPose)
    result.setLambda(lambda);
    result.setJointPositionSimilarityScoresAndTensor(jointSimilarityScores,jointPositionTensors);
    result.setAngleSimilarityScores(angelSimilarityScores);
    result.setAngleRadians(cameraPoseAngleRadian,videoPoseAngleRadian);
    result.setAngleDegrees(cameraPoseAngleDegrees,videoPoseAngleDegrees);
    result.setPoseSimilarityScore(poseSimilarityScore);

    return result
}

/**
 * compare two poses
 * @param cameraPose
 * @param videoPose
 * @param lambda
 * @returns {compareOutput}
 */
export function compareTwoPoseWithScores(cameraPose,videoPose,lambda){
    let mask = andMask(cameraPose.mask,videoPose.mask)
    // console.log(cameraPose)
    for (let i=0;i<mask.length;i++) {
        if (!mask[i]) {
            cameraPose.keypoints[i].score = -1
        }
    }
    // console.log(cameraPose)
    let result = computePartSimilarityScores(cameraPose,videoPose,lambda,mask);
    console.log(result)
    return result;
}

export class compareOutput{
    constructor(){
        this.jointNum = 16;
        this.linkNum = links.length;
        this.angelNum = angles.length;
    }
    setPoses(cameraPose,comparePose){
        this.cameraPose = cameraPose;
        this.comparePose = comparePose;
    }
    setJointPositionSimilarityScoresAndTensor(scores,tensors){
        this.jointSimilarityScores = scores
        this.jointPositionTensors = tensors
    }
    setAngleSimilarityScores(scores){
        this.angleSimilarityScores = scores
    }
    setPoseSimilarityScore(score){
        this.poseSimilarityScore = score
    }
    setAngleDegrees(cameraAngle,compareAngle){
        this.cameraAngleDegrees = cameraAngle;
        this.compareAngleDegrees = compareAngle;
    }
    setAngleRadians(cameraAngle,compareAngle){
        this.cameraAngleRadians = cameraAngle;
        this.compareAngleRadians = compareAngle;
    }
    setLambda(lambda){
        this.lambda = lambda
    }
    getPoseSimilarityScore(){
        return this.poseSimilarityScore;
    }
    getJointSimilarityScores(){
        return this.jointSimilarityScores
    }
    getAngleSimilarityScores(){
        return this.angleSimilarityScores
    }
}