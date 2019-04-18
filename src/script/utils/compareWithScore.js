import * as math from 'mathjs'
const links = [[0,1],[1,2],[2,6],[3,6],[4,3],[5,4],[10,11], [11,12],[12,8],[13,8],[14,13],[15,14],[7,8],[8,9],[7,2],[7,3]]
const angles = [[0,1],[1,14],[4,15],[5,4],[6,7],[7,8],[9,10],[10,11]]

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

let DEBUG = 0;

/*
const joints={
        rightAnkle:0,
        rightKnee:1,
        rightHip:2,
        leftHip:3,
        leftKnee:4,
        leftAnkle:5,
        pelvis:6,
        thorax:7,
        upperNeck:8,
        headTop:9,
        rightWrist:10,
        rightElbow:11,
        rightShoulder:12,
        leftShoulder:13,
        leftElbow:14,
        leftWrist:15
}
*/

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

function euclidean(joint1,joint2) {
    return norm(getTensor(toTuple(joint1.position),toTuple(joint2.position)))
}

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

function getAssociateAngels(kpIndex) {
    let associateAngleIndexes = []
    for (let i= 0;i<jointIndexMap.length;i++){
        if (jointIndexMap[i].indexOf(kpIndex)!=-1){
            associateAngleIndexes.push(i)
        }
    }
    return associateAngleIndexes
}

function computeAngelScore(angleIndex,kps1,kps2){
    let score1 = Math.acos(getAngleCos(kps1,angleIndex))
    let score2 = Math.acos(getAngleCos(kps2,angleIndex))
    // console.log('angle1 cos',getAngleCos(kps1,angleIndex))
    // console.log('angle score',score1,score2)
    return Math.abs(score1-score2)/ Math.PI
}

function getAngleSimilarityScore(kpIndex,cameraPoseKp,videoPoseKp) {
    let score = 0
    let associateAngleIndexes = getAssociateAngels(kpIndex)
    if (associateAngleIndexes.length==0){
        return 1;
    }
    else {
        associateAngleIndexes.forEach(angleIndex=>{
            let angelScore = computeAngelScore(angleIndex,cameraPoseKp,videoPoseKp)
            // console.log(angelScore)
            score += angelScore
        })
        return 1-score/associateAngleIndexes.length
    }
}

function getJointSimilarityScores(cameraPoseKp,videoPoseKp) {
    let distances = []
    let count =cameraPoseKp.length
    for (let i=0;i<count;i++){
        let j1 = cameraPoseKp[i]
        let j2 = videoPoseKp[i]
        let distance = euclidean(j1,j2)
        distances.push(distance)
    }

    let mean = math.mean(distances)
    let stddev = math.std(distances)


    let scores = distances.map((x)=>{
        let score = 1- math.erf((x-mean)/stddev/math.sqrt(2));
        return score>0? score/2 :0
    })

    return scores
}

function computePartSimilarityScores(cameraPose,videoPose,lambda){
    let partSimilarityScores = []
    let jointSimilarityScores = getJointSimilarityScores(cameraPose.keypoints,videoPose.keypoints)

    for (let i =0 ; i< cameraPose.keypoints.length;i++){
        let angleSimilarityScore = getAngleSimilarityScore(i,cameraPose.keypoints,videoPose.keypoints)
        let jointSimilarityScore = jointSimilarityScores[i]
        let partSimilarityScore = (cameraPose.keypoints[i].score) * (lambda * angleSimilarityScore + (1-lambda) * jointSimilarityScore)
        partSimilarityScores.push(partSimilarityScore)
        // console.log('con',cameraPose.keypoints[i].score,'angleSimilarityScore',angleSimilarityScore,'jointSimilarityScore',jointSimilarityScore,'partSimilarityScore',partSimilarityScore)
    }

    // return jointSimilarityScores

    return partSimilarityScores
}

/**
 * compute similarity with two poses
 * @param cameraPose
 * @param videoPose
 * @param lambda
 * @returns {*[]}
 */
export function compareTwoPoseWithScores(cameraPose,videoPose,lambda){
    // console.log('cameraPose',cameraPose)
    // console.log('videoPose',videoPose)
    // console.log(jointIndexMap)

    let partSimilarityScores = computePartSimilarityScores(cameraPose,videoPose,lambda);

    let totalSimilarityScore =0;

    partSimilarityScores.forEach(s=>{
        totalSimilarityScore+=s;
    })

    totalSimilarityScore = totalSimilarityScore/partSimilarityScores.length

    return [totalSimilarityScore,partSimilarityScores]
}