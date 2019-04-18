const links = [[0,1],[1,2],[2,6],[3,6],[4,3],[5,4],[10,11], [11,12],[12,8],[13,8],[14,13],[15,14],[7,8],[8,9],[7,2],[7,3]]
const angles = [[0,1],[1,14],[4,15],[5,4],[6,7],[7,8],[9,10],[10,11]]

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
 * get angel's cos
 * @param tensor1
 * @param tensor2
 * @returns {number}
 */
function cos(tensor1,tensor2) {
    return (dot(tensor1,tensor2))*1.0/ (norm(tensor1)* norm(tensor2))
}

function getTensor([x1,y1],[x2,y2]) {
    return [x1-x2,y1-y2]
}


export function getAngelCos(kps,angelIndex) {
    //get two links
    let linkIndexs = angles[angelIndex]
    // console.log(linkIndexs)
    let tensors = linkIndexs.map((linkIndex)=>{
        let link = links[linkIndex]
        return getTensor(toTuple(kps[link[0]].position),toTuple(kps[link[1]].position))
    })

    return cos(tensors[0],tensors[1])

}

/**
 * compare two angels
 * @param kps1
 * @param kps2
 * @param angelIndex
 * @param threshHold
 * @returns {boolean} is pass
 */
function compareTwoAngel(kps1,kps2,angelIndex,threshHold){
    // console.log(angelIndex)
    let score1 = getAngelCos(kps1,angelIndex)
    let score2 = getAngelCos(kps2,angelIndex)
    return Math.abs(score1-score2)<=threshHold
}

/**
 *  kp={
 *      part:xx,
 *      position:{
 *          x:
 *          y:
 *      },
 *      score:xx,
 *      active:boolean
 *  }
 */
function getActiveLinks(cameraKps) {
    let booleanArray = links.map(link=>{
        let joint1 = cameraKps[link[0]]
        let joint2 = cameraKps[link[1]]
        if (joint1.active&&joint2.active){
                return true
        }
        else {
            return false
        }
    })

    return booleanArray
}

function getActiveAngels(linkBooleanArray) {
    let booleanArray = angles.map(angel=>{
        let linkIndex1 = angel[0]
        let linkIndex2 = angel[1]
        if (linkBooleanArray[linkIndex1]&&linkBooleanArray[linkIndex2]){
            return true
        }
        else {
            return false
        }
    })

    return booleanArray
}

/**
 *
 * @param cameraKps
 * @param compareKps
 * @param activeAngels
 * @param threshHold
 * @returns {Array} 0 for low confidence ,1 for pass , -1 for deactivate
 */
function getPassState(cameraKps,compareKps,activeAngelsMask,threshHold) {
    let angels = []
    for (let i =0 ;i<activeAngelsMask.length;i++){
        let isPass = null;
        if (activeAngelsMask[i]){
            isPass = compareTwoAngel(cameraKps,compareKps,i,threshHold)? 1:0;
            angels.push(isPass);
        }
        else {
            //the angel is no active
            isPass= -1;
            angels.push(isPass);
        }
    }
    return angels
}

/**
 * angelToJoint
 */
export function angelArrayToJointMask(angelIndexArray) {
    let jointArray = []
    for(let i=0;i<16;i++){
        jointArray.push(false)
    }
    angelIndexArray.forEach(angelIndex=>{
        let [l1,l2] = angles[angelIndex];
        let [j1,j2] = links[l1];
        let [j3,j4] = links[l2];
        jointArray[j1] = true;
        jointArray[j2] = true;
        jointArray[j3] = true;
        jointArray[j4] = true;
    })

    return jointArray
}

/**
 *
 */
export function getActiveState(kps) {
    return kps.map(kp=>{
        return kp.active
    })
}

/**
 * get Low Confidence Joint
 * @param passState Array for pass (0 for no pass,1 for pass , -1 for no active)
 * @returns {*[]}
 */
function getLowConfidenceJoint(passState) {
    let lowConfidenceAngel = [];
    let overConfidenceAngel = [];

    for(let i=0;i<passState.length;i++){
        if (passState[i]==0){
            lowConfidenceAngel.push(i);
        }
        else if (passState[i]==1){
            overConfidenceAngel.push(i);
        }
    }

    // let lowConfidenceJointMask = angelArrayToJointMask(lowConfidenceAngel);
    // let overConfidenceJointMask = angelArrayToJointMask(overConfidenceAngel);


    return [lowConfidenceAngel,overConfidenceAngel]
}

/**
 * joint mask to angel mask
 * @param jointMask
 * @returns {any[]}
 */
function jointMaskToAngelMask(jointMask) {
    let angelMask = angles.map(([linkIndex1,linkIndex2])=>{

        let link1 = links[linkIndex1]
        let link2 = links[linkIndex2]

        let j11 = link1[0];
        let j12 = link1[1];

        let j21 = link2[0];
        let j22 = link2[1];

        if (jointMask[j11]&&jointMask[j12]&&jointMask[j21]&&jointMask[j22]){
            return true;
        }
        else {
            return false;
        }
    })
    return angelMask
}

/**
 * compare pose (angels)
 * @param cameraPose
 * @param comparePose
 * @param threshHold
 * @returns {*[]}
 *  two array for angels index
 */
export function compareTwoPose(cameraPose,comparePose,threshHold){
    let activeAngelMask = jointMaskToAngelMask(comparePose.mask)

    let passStates = getPassState(cameraPose.keypoints,comparePose.keypoints,activeAngelMask,threshHold)

    if(DEBUG){
        // console.log('jointMask')
        // console.log(comparePose.mask)
        console.log('AngelMask')
        console.log(activeAngelMask)
        // console.log('passState')
        // console.log(passStates)
    }

    let [lowConfidenceAngelArray ,overConfidenceAngelArray] = getLowConfidenceJoint(passStates)

    return [lowConfidenceAngelArray,overConfidenceAngelArray]
}