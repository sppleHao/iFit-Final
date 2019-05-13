import * as math from 'mathjs'
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

function getTensor([x1,y1],[x2,y2]) {
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
    if (result<0){
        result = 0
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
    return norm(getTensor(toTuple(joint1.position),toTuple(joint2.position)))
}

function getCompareJointTensor(joint1,joint2) {
    return getTensor(toTuple(joint1.position),toTuple(joint2.position))
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
        return getTensor(toTuple(kps[link[0]].position),toTuple(kps[link[1]].position))
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
 * return compare degrees of two angles
 * @param angleIndex
 * @param kps1
 * @param kps2
 * @returns {number}
 */
function computeAngleScore(angleIndex,kps1,kps2){
    let score1 = computeAngle(angleIndex,kps1)
    let score2 = computeAngle(angleIndex,kps2)
    return Math.abs(score1-score2)/ Math.PI
}

/**
 * compute joint's associate angel similarity score
 * @param kpIndex
 * @param cameraPoseKp
 * @param videoPoseKp
 * @returns {number}
 */
function getAngleSimilarityScore(kpIndex,cameraPoseKp,videoPoseKp) {
    let score = 0
    let associateAngleIndexes = getAssociateAngles(kpIndex)
    if (associateAngleIndexes.length==0){
        return 1;
    }
    else {
        associateAngleIndexes.forEach(angleIndex=>{
            let angelScore = computeAngleScore(angleIndex,cameraPoseKp,videoPoseKp)
            // console.log(angelScore)
            score += angelScore
        })
        return 1 - score/associateAngleIndexes.length
    }
}

/**
 * compute joint position similarity scores
 * @param cameraPoseKp
 * @param videoPoseKp
 * @returns {*[]}
 */
function getJointSimilarityScores(cameraPoseKp,videoPoseKp) {
    let distances = []
    let tensors = []
    let count =cameraPoseKp.length
    for (let i=0;i<count;i++){
        let j1 = cameraPoseKp[i]
        let j2 = videoPoseKp[i]
        let distance = euclidean(j1,j2)
        let tensor = getCompareJointTensor(j1,j2)
        tensors.push(tensor)
        distances.push(distance)
    }

    let mean = math.mean(distances)
    let stddev = math.std(distances)

    let scores = distances.map((x)=>{
        let score = 1- math.erf((x-mean)/stddev/math.sqrt(2));
        return score>0? score/2 :0
    })

    return [scores,tensors]
}

function computePartSimilarityScores(cameraPose,videoPose,lambda){
    let result = new compareOutput();

    let jointTotalSimilarityScores = []

    let [jointPositionSimilarityScores,jointPositionTensors] = getJointSimilarityScores(cameraPose.keypoints,videoPose.keypoints)
    let jointAngleSimilarityScores = []

    let cameraPoseAngleDegrees = angles.map(angelIndex=>{
        return computeAngle(angelIndex,cameraPose.keypoints)
    })

    let videoPoseAngleDegrees = angles.map(angelIndex=>{
        return computeAngle(angelIndex,videoPose.keypoints)
    })


    for (let i =0 ; i< cameraPose.keypoints.length;i++){
        let jointAngleSimilarityScore = getAngleSimilarityScore(i,cameraPose.keypoints,videoPose.keypoints)
        let jointPositionSimilarityScore = jointPositionSimilarityScores[i]
        let jointTotalSimilarityScore = (cameraPose.keypoints[i].score) * (lambda * jointAngleSimilarityScore + (1-lambda) * jointPositionSimilarityScore)

        jointAngleSimilarityScores.push(jointAngleSimilarityScore)
        jointTotalSimilarityScores.push(jointTotalSimilarityScore)
    }

    result.setPoses(cameraPose,videoPose)
    result.setLambda(lambda);
    result.setJointPositionSimilarityScoresAndTensor(jointPositionSimilarityScores,jointPositionTensors);
    result.setJointAngleSimilarityScores(jointPositionSimilarityScores);
    result.setAngleDegrees(cameraPoseAngleDegrees,videoPoseAngleDegrees);
    result.setJointTotalSimilarityScores(jointTotalSimilarityScores);

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
    // console.log('cameraPose',cameraPose)
    // console.log('videoPose',videoPose)
    // console.log(jointIndexMap)

    let result = computePartSimilarityScores(cameraPose,videoPose,lambda);

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
        this.jointPositionScores = scores
        this.jointPositionTensors = tensors
    }
    setJointAngleSimilarityScores(scores){
        this.jointAngleScores = scores
    }
    setJointTotalSimilarityScores(scores){
        this.jointTotalSimilarityScores = scores
    }
    setAngleDegrees(cameraAngle,compareAngle){
        this.cameraAngle = cameraAngle;
        this.compareAngle = compareAngle;
    }
    setLambda(lambda){
        this.lambda = lambda
    }
}