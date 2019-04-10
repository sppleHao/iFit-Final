export function filterDeactivateKeypoints(kepoints,minConfidence,deactivateArray) {
    for (let i =0;i<deactivateArray.length;i++){
        kepoints[deactivateArray[i]].active=false
    }

    kepoints.map((kp)=>{
        if (kp.score<minConfidence){
            kp.active = false
        }
    })

    return kepoints
}

/**
 * get mask which higher than confidence
 * @param kps
 * @param minConfidence
 * @returns {*}
 */
export function getConfidenceMask(kps,minConfidence) {
    return kps.map(kp=>{
        return kp.score >minConfidence;
    });
}

export function getDeactivateMask(kps,deactivateArray) {
    let mask = [];
    for (let i =0;i<kps.length;i++){
        mask.push(true);
    }
    for (let i =0;i<deactivateArray.length;i++){
        mask[deactivateArray[i]]=false
    }
    return mask;
}

/**
 * is mask1 ⊆ mask2
 * @param mask1 (file pose mask)
 * @param mask2 (camera pose mask)
 * @returns (boolean)
 */
export function isBelongMask(mask1,mask2){
    if (mask1.length==mask2.length) {
        for (let i = 0 ;i<mask1.length;i++){
            if (mask1[i]&&!mask2[i]){
                //if mask1 have but mask2 didn't have, mask1 is not belongs mask2
                return false;
            }
        }
        return true;
    }
    else {
        return false;
    }
}

/**
 * operation and for masks
 * @param mask1
 * @param mask2
 * @returns {*}
 */
export function andMask(mask1,mask2) {
    if (mask1.length==mask2.length){
        let mask = [];
        for (let i=0;i<mask1.length;i++){
            mask.push(mask1[i]&&mask2[i]);
        }
        return mask;
    }
    else {
        return null;
    }
}